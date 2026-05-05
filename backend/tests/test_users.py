import pytest
from jose import jwt
from backend.config import config
from backend.models import UserRole

pytestmark = pytest.mark.asyncio


class TestUserAdminEndpoints:
    """Tests for admin user management endpoints."""

    async def test_list_all_users_admin(self, admin_client, test_user, admin_user):
        """Admin can list all users."""
        response = await admin_client.get("/api/users")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        emails = {u["email"] for u in data}
        assert test_user.email in emails
        assert admin_user.email in emails
        # Password hashes should not be exposed
        for u in data:
            assert "hashed_password" not in u

    async def test_list_users_pagination(self, admin_client, admin_user, clean_db):
        """Pagination works on user list."""
        from backend.localization.departments import Department
        from backend.services.auth.users import UserService
        # Create extra users
        for i in range(5):
            await UserService.register_user(
                name=f"User {i}",
                email=f"user{i}@example.com",
                password="TestPassword123!",
                department=Department.AGIO_RD,
            )
        response = await admin_client.get("/api/users?limit=3")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

        response = await admin_client.get("/api/users?skip=3&limit=3")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

    async def test_list_users_non_admin_forbidden(self, authorized_client):
        """Regular users cannot list all users."""
        response = await authorized_client.get("/api/users")
        assert response.status_code == 403

    async def test_list_users_anon_forbidden(self, anon_client):
        """Anonymous users cannot list all users."""
        response = await anon_client.get("/api/users")
        assert response.status_code == 401

    async def test_update_user_role_admin(self, admin_client, test_user):
        """Admin can update another user's role."""
        response = await admin_client.patch(
            f"/api/users/{test_user.id}/role",
            json={"role": UserRole.ADMIN}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == UserRole.ADMIN

    async def test_update_own_role_forbidden(self, admin_client, admin_user):
        """Admin cannot change their own role."""
        response = await admin_client.patch(
            f"/api/users/{admin_user.id}/role",
            json={"role": UserRole.USER}
        )
        assert response.status_code == 403

    async def test_update_role_non_admin_forbidden(self, authorized_client, test_user_b):
        """Regular users cannot update roles."""
        response = await authorized_client.patch(
            f"/api/users/{test_user_b.id}/role",
            json={"role": UserRole.ADMIN}
        )
        assert response.status_code == 403

    async def test_delete_user_admin(self, admin_client, test_user):
        """Admin can delete another user."""
        response = await admin_client.delete(f"/api/users/{test_user.id}")
        assert response.status_code == 204

        # Verify user is gone
        response = await admin_client.get("/api/users")
        data = response.json()
        emails = {u["email"] for u in data}
        assert test_user.email not in emails

    async def test_delete_own_account_forbidden(self, admin_client, admin_user):
        """Admin cannot delete their own account."""
        response = await admin_client.delete(f"/api/users/{admin_user.id}")
        assert response.status_code == 403

    async def test_delete_user_non_admin_forbidden(self, authorized_client, test_user_b):
        """Regular users cannot delete other users."""
        response = await authorized_client.delete(f"/api/users/{test_user_b.id}")
        assert response.status_code == 403

    async def test_delete_user_cascades_data(self, admin_client, test_user, clean_db):
        """Deleting a user removes their conversations, messages, and documents."""
        db = clean_db
        # Create conversation and message for test_user
        from backend.models import Conversation, Message
        from datetime import datetime, timezone
        conv = Conversation(
            title="Test Conv",
            user_email=test_user.email,
            created_at=datetime.now(timezone.utc),
            last_updated=datetime.now(timezone.utc),
        )
        await db.conversations.insert_one(conv.dict())
        msg = Message(
            conversation_id=conv.id,
            sender="user",
            text="Hello",
            timestamp=datetime.now(timezone.utc),
        )
        await db.messages.insert_one(msg.dict())

        response = await admin_client.delete(f"/api/users/{test_user.id}")
        assert response.status_code == 204

        # Verify cascading deletion
        assert await db.conversations.find_one({"user_email": test_user.email}) is None
        assert await db.messages.find_one({"conversation_id": conv.id}) is None
