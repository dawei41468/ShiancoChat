# Web Search & RAG Improvement Plan

## Current Implementation Analysis
- Single search engine (DuckDuckGo)
- Basic RAG with FAISS
- Minimal configuration
- No domain filtering
- Basic result sorting

## OpenWebUI Reference Features
- Multiple search engine support
- Web UI configuration
- Domain/content filtering
- Advanced result processing
- Multiple vector store options

## Proposed Improvements

### Core Features
1. Configurable search engines
2. Domain filtering
3. Result ranking improvements
4. Web loader options
5. Proxy/SSL controls

### Implementation Approach
1. Create new `WebSearchConfig` model
2. Implement engine factory pattern
3. Add domain filtering
4. Enhance result ranking
5. Add web UI controls

## Implementation Status

### Completed Features
- [x] Configuration system
- [x] DuckDuckGo search engine
- [x] Sougou search engine
- [x] Domain filtering
- [x] Basic ranking improvements

### Supported Search Engines
- DuckDuckGo (default, no API needed)
- Sougou (requires API key from open.sogou.com)

#### Sougou Setup Instructions
1. Register at open.sogou.com
2. Apply for Web Search API access
3. Get your API key
4. Set as environment variable: SOUGOU_API_KEY
5. Or configure in config.yaml:
```yaml
web_search:
  default_engine: "sougou"
  sougou_api_key: "your_api_key_here"
```

Note: Sougou API has rate limits and may require commercial agreement for production use.