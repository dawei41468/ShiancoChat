from datetime import timedelta

import pytest

from backend.database import db
from backend.localization.departments import Department
from httpx import AsyncClient as _RealAsyncClient
from httpx import ASGITransport as _ASGITransport
from backend.server import app
from backend.services.auth.tokens import create_access_token
from backend.services.auth.users import UserService
from backend.models import UserRole

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


class _CapturingStreamResponse:
    status_code = 200

    async def aiter_bytes(self):
        yield b'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'
        yield b'data: [DONE]\n\n'

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


def _capture_payload(monkeypatch, store):
    """Replace httpx.AsyncClient with a client that records the streamed payload."""
    class CapturingClient:
        def __init__(self, *args, **kwargs):
            pass

        def stream(self, method, url, json=None, headers=None):
            store["payload"] = json
            return _CapturingStreamResponse()

        async def post(self, *args, **kwargs):
            class R:
                status_code = 200

                def json(self):
                    return {"choices": [{"message": {"content": "T"}}]}

                def raise_for_status(self):
                    pass
            return R()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

    monkeypatch.setattr("httpx.AsyncClient", CapturingClient)


class TestAssistantCrud:
    async def test_defaults_seeded_and_visibility(self, clean_db):
        member = await _make_user("rd@example.com", Department.AGIO_RD)
        admin = await _make_user("boss@example.com", Department.AGIO_RD, admin=True)

        async with _client_for(member) as mc:
            resp = await mc.get("/api/assistants")
            assert resp.status_code == 200
            assistants = resp.json()
            # 3 global seeds are visible; the agio_business and production_dept ones are not
            assert len(assistants) == 3
            assert all(a["department"] is None for a in assistants)

        async with _client_for(admin) as ac:
            resp = await ac.get("/api/assistants")
            assert len(resp.json()) == 5

    async def test_department_member_sees_their_assistant(self, clean_db):
        member = await _make_user("prod@example.com", Department.PRODUCTION_DEPT)
        async with _client_for(member) as mc:
            resp = await mc.get("/api/assistants")
            names = [a["name_zh"] for a in resp.json()]
            assert "生产SOP助手" in names

    async def test_crud_requires_admin(self, clean_db):
        member = await _make_user("plain@example.com", Department.AGIO_RD)
        admin = await _make_user("admin5@example.com", Department.AGIO_RD, admin=True)

        async with _client_for(member) as mc:
            resp = await mc.post("/api/assistants", json={"name": "X"})
            assert resp.status_code == 403

        async with _client_for(admin) as ac:
            create = await ac.post("/api/assistants", json={
                "name": "Custom Helper",
                "name_zh": "定制助手",
                "department": "agio_rd",
                "system_prompt": "You are helpful.",
            })
            assert create.status_code == 201
            aid = create.json()["id"]

            patch = await ac.patch(f"/api/assistants/{aid}", json={"enabled": False})
            assert patch.status_code == 200
            assert patch.json()["enabled"] is False

            delete = await ac.delete(f"/api/assistants/{aid}")
            assert delete.status_code == 204

    async def test_disabled_assistant_hidden_from_members(self, clean_db):
        member = await _make_user("member5@example.com", Department.AGIO_RD)
        admin = await _make_user("admin6@example.com", Department.AGIO_RD, admin=True)

        async with _client_for(admin) as ac:
            await ac.get("/api/assistants")  # seed
            await ac.patch("/api/assistants/asst_general", json={"enabled": False})

        async with _client_for(member) as mc:
            resp = await mc.get("/api/assistants")
            assert all(a["id"] != "asst_general" for a in resp.json())


class TestAssistantChatIntegration:
    async def test_system_prompt_and_template_applied(self, clean_db, monkeypatch):
        user = await _make_user("chat@example.com", Department.AGIO_RD)
        store = {}
        _capture_payload(monkeypatch, store)

        async with _client_for(user) as uc:
            await uc.get("/api/assistants")  # seed
            conv_id = (await uc.post("/api/chat/new", json={})).json()["id"]
            resp = await uc.post("/api/openai/chat", json={
                "conversation_id": conv_id,
                "text": "standup notes: bob ships friday",
                "model": "model-a",
                "assistant_id": "asst_meeting_actions",
            })
            assert resp.status_code == 200

        messages = store["payload"]["messages"]
        assert messages[0]["role"] == "system"
        assert "action items" in messages[0]["content"].lower()
        assert "# Action Items" in messages[-1]["content"]  # output template applied
        assert "standup notes" in messages[-1]["content"]

    async def test_cross_department_assistant_denied(self, clean_db, monkeypatch):
        user = await _make_user("outsider@example.com", Department.AGIO_RD)
        store = {}
        _capture_payload(monkeypatch, store)

        async with _client_for(user) as uc:
            await uc.get("/api/assistants")  # seed
            conv_id = (await uc.post("/api/chat/new", json={})).json()["id"]
            resp = await uc.post("/api/openai/chat", json={
                "conversation_id": conv_id,
                "text": "draft a quote",
                "model": "model-a",
                "assistant_id": "asst_sales_quote",  # agio_business only
            })
            assert resp.status_code == 404
        assert "payload" not in store

    async def test_unknown_assistant_404(self, clean_db, monkeypatch):
        user = await _make_user("chat2@example.com", Department.AGIO_RD)
        _capture_payload(monkeypatch, {})
        async with _client_for(user) as uc:
            conv_id = (await uc.post("/api/chat/new", json={})).json()["id"]
            resp = await uc.post("/api/openai/chat", json={
                "conversation_id": conv_id,
                "text": "hi",
                "model": "model-a",
                "assistant_id": "does-not-exist",
            })
            assert resp.status_code == 404
