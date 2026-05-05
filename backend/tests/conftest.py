import sys
from pathlib import Path
import os
import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from jose import jwt

# Capture the real httpx.AsyncClient BEFORE any mocking so test fixtures can use it
from httpx import AsyncClient as _RealAsyncClient

# Add project root to path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

# Set test env vars before importing app modules
os.environ.setdefault("SECRET_KEY", "test_secret_key_that_is_at_least_32_chars_long")
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "shiancochat_test")
os.environ.setdefault("LLM_BASE_URL", "http://localhost:1234")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("ALLOWED_HOSTS", '["localhost", "test", "127.0.0.1"]')

# Setup mock MongoDB BEFORE importing backend modules that use it
from mongomock_motor import AsyncMongoMockClient
import backend.database
mock_mongo_client = AsyncMongoMockClient()
mock_db = mock_mongo_client["shiancochat_test"]
backend.database.client = mock_mongo_client
backend.database.db = mock_db

from backend.config import AppConfig
from backend.server import app
from backend.database import db, client
from backend.services.auth.tokens import create_access_token, get_password_hash
from backend.services.auth.users import UserService
from backend.models import UserRole


@pytest_asyncio.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    import asyncio
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_db():
    """Provide the test database, cleaning up collections before each test run."""
    # Drop all collections to start fresh
    collections = await db.list_collection_names()
    for coll in collections:
        if not coll.startswith("system."):
            await db.drop_collection(coll)
    yield db
    # Cleanup after session
    collections = await db.list_collection_names()
    for coll in collections:
        if not coll.startswith("system."):
            await db.drop_collection(coll)


@pytest_asyncio.fixture
async def clean_db(test_db):
    """Clean all collections before each test."""
    collections = await test_db.list_collection_names()
    for coll in collections:
        if not coll.startswith("system."):
            await test_db.drop_collection(coll)
    yield test_db


@pytest_asyncio.fixture
async def test_user(clean_db):
    """Create a test user and return it."""
    from backend.localization.departments import Department
    user = await UserService.register_user(
        name="Test User",
        email="test@example.com",
        password="TestPassword123!",
        department=Department.AGIO_RD
    )
    yield user
    # Cleanup handled by clean_db fixture


@pytest_asyncio.fixture
async def admin_user(clean_db):
    """Create an admin test user and return it."""
    from backend.localization.departments import Department
    user = await UserService.register_user(
        name="Admin User",
        email="admin@example.com",
        password="AdminPassword123!",
        department=Department.AGIO_RD
    )
    await db.users.update_one(
        {"email": user.email},
        {"$set": {"role": UserRole.ADMIN}}
    )
    user.role = UserRole.ADMIN
    yield user


@pytest_asyncio.fixture
async def test_user_token(test_user):
    """Create an access token for the test user."""
    token = create_access_token(
        data={"sub": test_user.email},
        expires_delta=timedelta(minutes=30)
    )
    return token


@pytest_asyncio.fixture
async def authorized_client(test_user_token):
    """Return an async HTTP client with authorization header set."""
    from httpx import AsyncClient
    async with _RealAsyncClient(app=app, base_url="http://test") as client:
        client.headers["Authorization"] = f"Bearer {test_user_token}"
        yield client


@pytest_asyncio.fixture
async def admin_client(admin_user):
    """Return an async HTTP client authorized as an admin."""
    from httpx import AsyncClient
    token = create_access_token(
        data={"sub": admin_user.email},
        expires_delta=timedelta(minutes=30)
    )
    async with _RealAsyncClient(app=app, base_url="http://test") as client:
        client.headers["Authorization"] = f"Bearer {token}"
        yield client


@pytest_asyncio.fixture
async def test_user_b(clean_db):
    """Create a second test user and return it."""
    from backend.localization.departments import Department
    user = await UserService.register_user(
        name="Test User B",
        email="testb@example.com",
        password="TestPassword123!",
        department=Department.AGIO_RD
    )
    yield user


@pytest_asyncio.fixture
async def authorized_client_b(test_user_b):
    """Return an async HTTP client authorized as test_user_b."""
    from httpx import AsyncClient
    token = create_access_token(
        data={"sub": test_user_b.email},
        expires_delta=timedelta(minutes=30)
    )
    async with _RealAsyncClient(app=app, base_url="http://test") as client:
        client.headers["Authorization"] = f"Bearer {token}"
        yield client


@pytest_asyncio.fixture
async def anon_client():
    """Return an unauthenticated async HTTP client."""
    from httpx import AsyncClient
    async with _RealAsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture(autouse=True)
def mock_external_services(monkeypatch):
    """Mock external LLM, embedding, and web search services for all tests."""
    import httpx
    import numpy as np

    class FakeStreamResponse:
        status_code = 200
        async def aiter_bytes(self):
            yield b'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass

    class FakeHttpxClient:
        def __init__(self, *args, **kwargs): pass
        def stream(self, *args, **kwargs): return FakeStreamResponse()
        async def post(self, *args, **kwargs):
            class FakeResponse:
                status_code = 200
                def json(self):
                    return {"choices": [{"message": {"content": "Test Title"}}]}
                def raise_for_status(self): pass
            return FakeResponse()
        async def get(self, *args, **kwargs):
            class FakeResponse:
                status_code = 200
                def json(self):
                    return {"data": [{"id": "model-a"}, {"id": "model-b"}]}
                def raise_for_status(self): pass
            return FakeResponse()
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass

    # Patch httpx only in the modules that make external calls,
    # NOT globally (that would break the test AsyncClient)
    # Patch httpx globally for external calls, but test fixtures use _RealAsyncClient
    monkeypatch.setattr("httpx.AsyncClient", FakeHttpxClient)

    def fake_httpx_get(*args, **kwargs):
        class FakeResponse:
            status_code = 200
            def json(self):
                return {"data": [{"id": "model-a"}]}
            def raise_for_status(self): pass
        return FakeResponse()
    monkeypatch.setattr("httpx.get", fake_httpx_get)

    # Mock web search
    async def fake_perform_web_search(*args, **kwargs):
        return []
    monkeypatch.setattr("backend.routers.openai.perform_web_search", fake_perform_web_search)

    # Mock embedding model - must support convert_to_tensor=True (.cpu().numpy())
    class FakeTensor:
        def __init__(self, data):
            import numpy as np
            self._data = np.array(data)
        def cpu(self):
            return self
        def numpy(self):
            return self._data

    class FakeEmbeddingModel:
        def encode(self, texts, convert_to_tensor=False):
            import numpy as np
            if isinstance(texts, str):
                h = hash(texts) % 100
                data = [0.1 + h * 0.001] * 384
                if convert_to_tensor:
                    return FakeTensor(data)
                return np.array(data)
            result = []
            for t in texts:
                h = hash(t) % 100
                result.append([0.1 + h * 0.001] * 384)
            if convert_to_tensor:
                return FakeTensor(result)
            return np.array(result)
        def get_sentence_embedding_dimension(self):
            return 384

    def fake_get_embedding_model():
        return FakeEmbeddingModel()

    monkeypatch.setattr("backend.utils.rag._get_embedding_model", fake_get_embedding_model)
    monkeypatch.setattr("backend.routers.documents._get_embedding_model", fake_get_embedding_model)
