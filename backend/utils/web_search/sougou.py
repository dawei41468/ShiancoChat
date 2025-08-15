import logging
import json
import os
from typing import List, Optional
from tencentcloud.common import credential
from tencentcloud.common.exception.tencent_cloud_sdk_exception import TencentCloudSDKException
from tencentcloud.common.profile.client_profile import ClientProfile
from tencentcloud.common.profile.http_profile import HttpProfile
from tencentcloud.common.common_client import CommonClient
from .base import SearchEngine
from .models import SearchResult
from .utils import get_filtered_results

class SougouEngine(SearchEngine):
    """Sougou search engine implementation using Tencent Cloud API."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
    async def search(self, query: str, max_results: int = 5,
                   filter_list: Optional[List[str]] = None) -> List[SearchResult]:
        """Search using Tencent Cloud's Sougou API."""
        try:
            # Get credentials from config
            sid = os.getenv("SOUGOU_API_SID")
            sk = os.getenv("SOUGOU_API_SK")
            if not sid or not sk:
                self.logger.error("Sougou API credentials not configured")
                return []

            cred = credential.Credential(sid, sk)
            http_profile = HttpProfile(
                endpoint="tms.tencentcloudapi.com"
            )
            
            client_profile = ClientProfile(
                httpProfile=http_profile
            )
            
            params = {
                "Query": query,
                "Cnt": min(max_results, 20)  # API max is 20
            }
            
            common_client = CommonClient(
                "tms",
                "2020-12-29",
                cred,
                "",
                profile=client_profile
            )
            
            response = common_client.call_json("SearchPro", params)
            results = [
                json.loads(page)
                for page in response["Response"]["Pages"]
            ]
            
            # Sort by score and apply filters
            sorted_results = sorted(
                results,
                key=lambda x: x.get("scour", 0.0),
                reverse=True
            )
            
            if filter_list:
                sorted_results = get_filtered_results(sorted_results, filter_list)
            
            return [
                SearchResult(
                    title=result.get("title", ""),
                    url=result.get("url", ""),
                    snippet=result.get("passage", ""),
                    source="sougou"
                )
                for result in sorted_results[:max_results]
            ]
            
        except TencentCloudSDKException as e:
            self.logger.error(f"Tencent Cloud API error: {e}")
        except Exception as e:
            self.logger.error(f"Search failed: {e}")
            
        return []