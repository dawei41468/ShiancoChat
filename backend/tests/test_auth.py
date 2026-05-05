import pytest
from datetime import datetime, timezone, timedelta
from jose import jwt

from backend.services.auth.tokens import create_access_token, verify_password, get_password_hash
from backend.services.auth.users import UserService
from backend.config import config


class TestRegister:
    async def test_register_success(self, anon_client, clean_db):
        response = await anon_client.post("/api/auth/register", json={
            "name": "New User",
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "department": "agio_rd"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "newuser@example.com"
        assert data["name"] == "New User"
        assert "hashed_password" not in data

    async def test_register_duplicate_email(self, test_user, anon_client):
        response = await anon_client.post("/api/auth/register", json={
            "name": "Another User",
            "email": test_user.email,
            "password": "SecurePass123!",
            "department": "agio_rd"
        })
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]

    async def test_register_weak_password(self, anon_client, clean_db):
        response = await anon_client.post("/api/auth/register", json={
            "name": "Weak User",
            "email": "weak@example.com",
            "password": "123",
            "department": "agio_rd"
        })
        assert response.status_code == 400


class TestLogin:
    async def test_login_success(self, test_user, anon_client):
        response = await anon_client.post("/api/auth/login", data={
            "username": test_user.email,
            "password": "TestPassword123!"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, test_user, anon_client):
        response = await anon_client.post("/api/auth/login", data={
            "username": test_user.email,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        assert "Incorrect" in response.json()["detail"]

    async def test_login_nonexistent_user(self, anon_client):
        response = await anon_client.post("/api/auth/login", data={
            "username": "nobody@example.com",
            "password": "somepassword"
        })
        assert response.status_code == 401


class TestTokenRefresh:
    async def test_refresh_valid_token(self, test_user, anon_client, clean_db):
        # Login to get refresh token
        login_resp = await anon_client.post("/api/auth/login", data={
            "username": test_user.email,
            "password": "TestPassword123!"
        })
        refresh_token = login_resp.json()["refresh_token"]

        # Use refresh token
        response = await anon_client.post("/api/auth/refresh", json={
            "refresh_token": refresh_token
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["refresh_token"] != refresh_token
        assert data["token_type"] == "bearer"

        reuse_response = await anon_client.post("/api/auth/refresh", json={
            "refresh_token": refresh_token
        })
        assert reuse_response.status_code == 401

    async def test_refresh_invalid_token(self, anon_client):
        response = await anon_client.post("/api/auth/refresh", json={
            "refresh_token": "invalid_token"
        })
        assert response.status_code == 401

    async def test_refresh_revoked_token(self, test_user, anon_client, clean_db):
        # Login to get refresh token
        login_resp = await anon_client.post("/api/auth/login", data={
            "username": test_user.email,
            "password": "TestPassword123!"
        })
        refresh_token = login_resp.json()["refresh_token"]

        # Revoke the token
        await UserService.revoke_refresh_token(refresh_token)

        # Try to use revoked token
        response = await anon_client.post("/api/auth/refresh", json={
            "refresh_token": refresh_token
        })
        assert response.status_code == 401


class TestLogout:
    async def test_logout_revokes_tokens(self, test_user, anon_client, clean_db):
        # Login to get tokens
        login_resp = await anon_client.post("/api/auth/login", data={
            "username": test_user.email,
            "password": "TestPassword123!"
        })
        access_token = login_resp.json()["access_token"]
        refresh_token = login_resp.json()["refresh_token"]

        # Logout with access token
        logout_resp = await anon_client.post("/api/auth/logout", headers={
            "Authorization": f"Bearer {access_token}"
        })
        assert logout_resp.status_code == 200

        # Try to refresh — should fail
        refresh_resp = await anon_client.post("/api/auth/refresh", json={
            "refresh_token": refresh_token
        })
        assert refresh_resp.status_code == 401


class TestGetCurrentUser:
    async def test_get_current_user_valid_token(self, test_user, authorized_client):
        response = await authorized_client.get("/api/auth/users/me")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email
        assert data["name"] == test_user.name

    async def test_get_current_user_expired_token(self, anon_client):
        # Create an expired token
        expired_token = create_access_token(
            data={"sub": "test@example.com"},
            expires_delta=timedelta(seconds=-1)
        )
        response = await anon_client.get("/api/auth/users/me", headers={
            "Authorization": f"Bearer {expired_token}"
        })
        assert response.status_code == 401

    async def test_get_current_user_no_token(self, anon_client):
        response = await anon_client.get("/api/auth/users/me")
        assert response.status_code == 401


class TestRefreshTokenEdgeCases:
    async def test_refresh_expired_token(self, anon_client):
        from datetime import datetime, timezone, timedelta
        from jose import jwt
        from backend.config import config

        expired_token = jwt.encode(
            {
                "sub": "test@example.com",
                "jti": "expired-jti",
                "type": "refresh",
                "iat": datetime.now(timezone.utc) - timedelta(days=10),
                "exp": datetime.now(timezone.utc) - timedelta(days=3),
            },
            config.secret_key,
            algorithm="HS256"
        )
        response = await anon_client.post("/api/auth/refresh", json={
            "refresh_token": expired_token
        })
        assert response.status_code == 401

    async def test_refresh_missing_sub(self, anon_client):
        from datetime import datetime, timezone, timedelta
        from jose import jwt
        from backend.config import config

        token = jwt.encode(
            {
                "jti": "test-jti",
                "type": "refresh",
                "iat": datetime.now(timezone.utc),
                "exp": datetime.now(timezone.utc) + timedelta(days=7),
            },
            config.secret_key,
            algorithm="HS256"
        )
        response = await anon_client.post("/api/auth/refresh", json={
            "refresh_token": token
        })
        assert response.status_code == 401

    async def test_refresh_missing_jti(self, anon_client):
        from datetime import datetime, timezone, timedelta
        from jose import jwt
        from backend.config import config

        token = jwt.encode(
            {
                "sub": "test@example.com",
                "type": "refresh",
                "iat": datetime.now(timezone.utc),
                "exp": datetime.now(timezone.utc) + timedelta(days=7),
            },
            config.secret_key,
            algorithm="HS256"
        )
        response = await anon_client.post("/api/auth/refresh", json={
            "refresh_token": token
        })
        assert response.status_code == 401

    async def test_refresh_wrong_type_claim(self, anon_client):
        from datetime import datetime, timezone, timedelta
        from jose import jwt
        from backend.config import config

        token = jwt.encode(
            {
                "sub": "test@example.com",
                "jti": "test-jti",
                "type": "access",
                "iat": datetime.now(timezone.utc),
                "exp": datetime.now(timezone.utc) + timedelta(days=7),
            },
            config.secret_key,
            algorithm="HS256"
        )
        response = await anon_client.post("/api/auth/refresh", json={
            "refresh_token": token
        })
        assert response.status_code == 401

    async def test_refresh_tampered_signature(self, anon_client):
        from datetime import datetime, timezone, timedelta
        from jose import jwt
        from backend.config import config

        valid_token = jwt.encode(
            {
                "sub": "test@example.com",
                "jti": "test-jti",
                "type": "refresh",
                "iat": datetime.now(timezone.utc),
                "exp": datetime.now(timezone.utc) + timedelta(days=7),
            },
            config.secret_key,
            algorithm="HS256"
        )
        tampered = valid_token[:-5] + "XXXXX"
        response = await anon_client.post("/api/auth/refresh", json={
            "refresh_token": tampered
        })
        assert response.status_code == 401


class TestPasswordHashing:
    def test_password_hashing(self):
        password = "TestPassword123!"
        hashed = get_password_hash(password)
        assert verify_password(password, hashed)
        assert not verify_password("wrongpassword", hashed)
