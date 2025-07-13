import json
import os
import logging
import httpx # Import httpx for asynchronous requests
from tenacity import retry, stop_after_attempt, wait_random_exponential




logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self, base_url: str):
        self.base_url = base_url

    @retry(stop=stop_after_attempt(3), wait=wait_random_exponential(min=1, max=10))
    async def generate_response(self, model: str, messages: list):
        lm_studio_messages = []
        for msg in messages:
            lm_studio_messages.append({"role": msg["role"], "content": msg["content"]})

        payload = {
            "model": model,
            "messages": lm_studio_messages,
            "stream": True # Enable streaming
        }

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream("POST", f"{self.base_url}/v1/chat/completions", json=payload, headers={"Content-Type": "application/json"}) as response:
                    response.raise_for_status()
                    
                    async for chunk_bytes in response.aiter_bytes():
                        decoded_chunk = chunk_bytes.decode('utf-8')
                        for line in decoded_chunk.splitlines():
                            if line.startswith("data: "):
                                json_data = line[len("data: "):]
                                if json_data.strip() == "[DONE]":
                                    return # End of stream
                                try:
                                    data = json.loads(json_data)
                                    if "choices" in data and len(data["choices"]) > 0:
                                        delta = data["choices"][0]["delta"]
                                        if "content" in delta:
                                            yield delta["content"]
                                except json.JSONDecodeError:
                                    logger.warning(f"Failed to decode JSON from chunk: {json_data}")
                                    continue
        except httpx.RequestError as e:
            # This is the crucial change. We log the specific error and then
            # re-raise it. This allows the @retry decorator to catch the
            # exception and try again.
            logger.error(f"An httpx error occurred: {e}")
            # Re-raise the exception to allow tenacity to handle retries
            raise

    def get_available_models(self):
        try:
            response = httpx.get(f"{self.base_url}/v1/models", timeout=10)
            response.raise_for_status()
            models_data = response.json()
            # The expected format is a list of models, each with an 'id' field.
            # We extract just the 'id' from each model object.
            return [model['id'] for model in models_data.get('data', [])]
        except (httpx.RequestError, httpx.HTTPStatusError) as e:
            logger.error(f"Failed to fetch models from LLM service: {e}")
            # Fallback to a default model if the service is unavailable
            return ["deepseek/deepseek-r1-0528-qwen3-8b"]

llm_service = LLMService(base_url=os.environ.get("LLM_BASE_URL", "http://localhost:1234"))