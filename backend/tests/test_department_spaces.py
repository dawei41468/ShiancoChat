import io
from datetime import timedelta

import pytest

from backend.database import db
from backend.localization.departments import Department
from backend.models import UserRole
from backend.routers.tools import ensure_default_tools
from backend.services.auth.tokens import create_access_token
from backend.services.auth.users import UserService
from httpx import AsyncClient as _RealAsyncClient
from httpx import ASGITransport as _ASGITransport
from backend.server import app

pytestmark = pytest.mark.asyncio


async def _make_user(email, department, admin=False):
    user = await UserService.register_user(
        name=email.split("@")[0],
        email=email,
        password="TestPassword123!",
        department=department,
    )
    if admin:
        await db.users.update_one({"email": email}, {"$set": {"role": UserRole.ADMIN}})
        user.role = UserRole.ADMIN
    return user


def _client_for(user):
    token = create_access_token(data={"sub": user.email}, expires_delta=timedelta(minutes=30))
    client = _RealAsyncClient(transport=_ASGITransport(app=app), base_url="http://test")
    client.headers["Authorization"] = f"Bearer {token}"
    return client


class TestDepartmentSpaceAccess:
    async def test_admin_creates_department_space_and_visibility(self, clean_db):
        admin = await _make_user("admin1@example.com", Department.AGIO_RD, admin=True)
        member = await _make_user("member1@example.com", Department.PRODUCTION_DEPT)
        stranger = await _make_user("stranger1@example.com", Department.AGIO_BUSINESS)

        async with _client_for(admin) as ac:
            resp = await ac.post("/api/documents/spaces", json={
                "name": "Production SOPs",
                "scope": "department",
                "department": "production_dept",
            })
            assert resp.status_code == 200
            space_id = resp.json()["id"]
            assert resp.json()["scope"] == "department"
            assert resp.json()["department"] == "production_dept"

        async with _client_for(member) as mc:
            list_resp = await mc.get("/api/documents/spaces")
            assert any(s["id"] == space_id for s in list_resp.json())
            detail = await mc.get(f"/api/documents/spaces/{space_id}")
            assert detail.status_code == 200

        async with _client_for(stranger) as sc:
            list_resp = await sc.get("/api/documents/spaces")
            assert all(s["id"] != space_id for s in list_resp.json())
            detail = await sc.get(f"/api/documents/spaces/{space_id}")
            assert detail.status_code == 404

    async def test_non_admin_cannot_create_department_space(self, clean_db):
        member = await _make_user("member2@example.com", Department.PRODUCTION_DEPT)
        async with _client_for(member) as mc:
            resp = await mc.post("/api/documents/spaces", json={
                "name": "Nope",
                "scope": "department",
                "department": "production_dept",
            })
            assert resp.status_code == 403

    async def test_member_cannot_modify_or_delete_department_space(self, clean_db):
        admin = await _make_user("admin2@example.com", Department.AGIO_RD, admin=True)
        member = await _make_user("member3@example.com", Department.PRODUCTION_DEPT)

        async with _client_for(admin) as ac:
            space_id = (await ac.post("/api/documents/spaces", json={
                "name": "Prod Space", "scope": "department", "department": "production_dept",
            })).json()["id"]

        async with _client_for(member) as mc:
            patch = await mc.patch(f"/api/documents/spaces/{space_id}", json={"name": "Renamed"})
            assert patch.status_code == 403
            delete = await mc.delete(f"/api/documents/spaces/{space_id}")
            assert delete.status_code == 403

        async with _client_for(admin) as ac:
            patch = await ac.patch(f"/api/documents/spaces/{space_id}", json={"name": "Renamed"})
            assert patch.status_code == 200
            assert patch.json()["name"] == "Renamed"


class TestDepartmentSpaceDocuments:
    async def _setup_space_with_doc(self):
        admin = await _make_user("admin3@example.com", Department.AGIO_RD, admin=True)
        uploader = await _make_user("uploader@example.com", Department.PRODUCTION_DEPT)
        reader = await _make_user("reader@example.com", Department.PRODUCTION_DEPT)
        async with _client_for(admin) as ac:
            space_id = (await ac.post("/api/documents/spaces", json={
                "name": "Prod Library", "scope": "department", "department": "production_dept",
            })).json()["id"]
        async with _client_for(uploader) as uc:
            up = await uc.post(
                "/api/documents/upload",
                files={"file": ("sop.txt", io.BytesIO(b"Step one. Step two. Safety first."), "text/plain")},
                data={"knowledge_space_id": space_id},
            )
            assert up.status_code == 200
        return space_id, up.json()["document_id"], reader

    async def test_space_library_upload_persists_and_is_shared(self, clean_db):
        space_id, document_id, reader = await self._setup_space_with_doc()

        doc = await db.documents.find_one({"_id": document_id})
        assert doc["expires_at"] is None  # library docs never expire

        async with _client_for(reader) as rc:
            detail = await rc.get(f"/api/documents/spaces/{space_id}")
            assert detail.status_code == 200
            doc_ids = [d["document_id"] for d in detail.json()["documents"]]
            assert document_id in doc_ids  # colleague's upload is visible to members

    async def test_conversation_upload_still_expires(self, clean_db):
        user = await _make_user("chatuser@example.com", Department.AGIO_RD)
        async with _client_for(user) as uc:
            conv = await uc.post("/api/chat/new", json={"title": "t"})
            conv_id = conv.json()["id"]
            up = await uc.post(
                "/api/documents/upload",
                files={"file": ("note.txt", io.BytesIO(b"Temporary chat attachment content."), "text/plain")},
                data={"conversation_id": conv_id},
            )
            assert up.status_code == 200
            assert up.json()["expires_at"] is not None


class TestDepartmentSpaceRetrieval:
    async def test_chat_rag_space_access_enforced(self, clean_db):
        await ensure_default_tools(db)
        admin = await _make_user("admin4@example.com", Department.AGIO_RD, admin=True)
        member = await _make_user("member4@example.com", Department.PRODUCTION_DEPT)
        stranger = await _make_user("stranger4@example.com", Department.AGIO_BUSINESS)

        async with _client_for(admin) as ac:
            space_id = (await ac.post("/api/documents/spaces", json={
                "name": "Prod Space 2", "scope": "department", "department": "production_dept",
            })).json()["id"]

        async with _client_for(member) as mc:
            conv_id = (await mc.post("/api/chat/new", json={})).json()["id"]
            resp = await mc.post("/api/openai/chat", json={
                "conversation_id": conv_id,
                "text": "What does the SOP say?",
                "model": "model-a",
                "rag_enabled": True,
                "knowledge_space_id": space_id,
            })
            assert resp.status_code == 200

        async with _client_for(stranger) as sc:
            conv_id = (await sc.post("/api/chat/new", json={})).json()["id"]
            resp = await sc.post("/api/openai/chat", json={
                "conversation_id": conv_id,
                "text": "What does the SOP say?",
                "model": "model-a",
                "rag_enabled": True,
                "knowledge_space_id": space_id,
            })
            assert resp.status_code == 404  # denied without leaking existence
