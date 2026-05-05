from unittest.mock import AsyncMock, patch


class TestModelsEndpoint:
    async def test_llm_models_endpoint_returns_models(self, authorized_client):
        expected = {"models": ["model-a", "model-b"]}

        with patch(
            "backend.server.openai.fetch_models_from_llm",
            new=AsyncMock(return_value=expected),
        ):
            response = await authorized_client.get("/api/llm/models")

        assert response.status_code == 200
        assert response.json() == expected
