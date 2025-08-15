# Web Search Setup

## Supported Search Engines
- DuckDuckGo (default)
- Sougou (via Tencent Cloud API)

## Sougou Credentials

1. Go to [Tencent Cloud Console](https://console.cloud.tencent.com/)
2. Create an account or log in if you already have one
3. Navigate to "Access Management" > "API Key Management"
4. Create a new API key to get your:
   - SecretId (SOUGOU_API_SID)
   - SecretKey (SOUGOU_API_SK)

## Required Permissions
Ensure your account has permissions for:
- TMS (Text Matching System) API
- SearchPro operation

## Configuration

Add these to your environment variables (`.env` file):
```bash
SOUGOU_API_SID=your_secret_id_here
SOUGOU_API_SK=your_secret_key_here
```

## Testing
Verify the implementation works by:
```python
from utils.web_search.sougou import SougouEngine

engine = SougouEngine()
results = await engine.search("test query", max_results=5)
```

## Troubleshooting
- 401 errors: Verify credentials are correct
- 403 errors: Check account permissions
- Timeouts: Verify network connectivity to Tencent Cloud