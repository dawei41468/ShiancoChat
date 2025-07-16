import os
from typing import List, Dict, Any
import httpx
import json
import uuid
import re

MCP_GATEWAY_URL = "http://localhost:8080/mcp"

async def _get_mcp_session_id(client: httpx.AsyncClient) -> str:
    """Initializes a session with the MCP gateway and returns the session ID."""
    init_payload = {
        "jsonrpc": "2.0",
        "method": "initialize",
        "params": {"protocol_version": "2025-06-18", "capabilities": []},
        "id": str(uuid.uuid4())
    }
    try:
        response = await client.post(
            MCP_GATEWAY_URL,
            json=init_payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream"
            }
        )
        response.raise_for_status()
        session_id = response.headers.get("mcp-session-id")
        if not session_id:
            raise Exception("MCP session ID not found in initialization response.")
        print(f"MCP session initialized with ID: {session_id}")
        return session_id
    except httpx.HTTPStatusError as e:
        print(f"HTTP error during MCP initialization: {e.response.status_code} - {e.response.text}")
        raise
    except Exception as e:
        print(f"An unexpected error occurred during MCP initialization: {e}")
        raise

async def perform_web_search(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    Performs a web search using the DuckDuckGo MCP server via JSON-RPC.
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            session_id = await _get_mcp_session_id(client)

            search_payload = {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {
                    "name": "search",
                    "arguments": {"query": query, "max_results": max_results}
                },
                "id": str(uuid.uuid4())
            }

            print(f"Performing search with payload: {json.dumps(search_payload)}")
            response = await client.post(
                MCP_GATEWAY_URL,
                json=search_payload,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Mcp-Session-Id": session_id
                }
            )
            response.raise_for_status()
            
            data = response.json()
            
            if "result" in data and "content" in data["result"]:
                text_content = data["result"]["content"][0]["text"]
                
                # Regex to find all search result blocks
                result_blocks = re.findall(r'\d+\.\s(.*?)\n\s+URL:\s(.*?)\n\s+Summary:\s(.*?)(?=\n\n\d+\.|\Z)', text_content, re.DOTALL)

                snippets = []
                for block in result_blocks:
                    snippets.append({
                        "title": block[0].strip(),
                        "url": block[1].strip(),
                        "snippet": block[2].strip()
                    })
                return snippets
            else:
                return []

    except httpx.HTTPStatusError as e:
        print(f"HTTP error during web search: {e.response.status_code} - {e.response.text}")
        return []
    except httpx.TimeoutException as e:
        print(f"Timeout error during web search: {e}")
        return []
    except httpx.RequestError as e:
        print(f"Request error during web search: {e}")
        return []
    except Exception as e:
        print(f"An unexpected error occurred during web search: {e}")
        return []

if __name__ == "__main__":
    import asyncio

    async def test_search():
        search_query = "latest news on AI"
        results = await perform_web_search(search_query)
        if results:
            print(f"Search results for '{search_query}':")
            for i, result in enumerate(results):
                print(f"--- Result {i+1} ---")
                print(f"Title: {result.get('title')}")
                print(f"URL: {result.get('url')}")
                print(f"Snippet: {result.get('snippet')}")
                print("-" * 20)
        else:
            print(f"No results found for '{search_query}'.")

    asyncio.run(test_search())