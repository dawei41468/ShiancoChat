import json
import os
import logging
import httpx # Import httpx for asynchronous requests




logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self, base_url: str):
        self.base_url = base_url

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
            logger.error(f"Error communicating with LLM service at {self.base_url}: {e}")
            yield "Error: Could not get response from LLM."

    def get_available_models(self):
        # Since we are using a fixed local model, we return it directly.
        return ["deepseek/deepseek-r1-0528-qwen3-8b"]

llm_service = LLMService(base_url=os.environ.get("LLM_BASE_URL", "http://localhost:1234"))