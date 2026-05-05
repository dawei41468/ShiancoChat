import { EventSourceParserStream } from 'eventsource-parser/stream';

let isRefreshing = false;
let refreshPromise = null;

async function refreshAccessToken() {
  if (isRefreshing) {
    return refreshPromise;
  }
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4100';
      const response = await fetch(`${backendUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });

      if (!response.ok) throw new Error('Refresh failed');

      const { access_token, refresh_token } = await response.json();
      // Notify the Axios layer so it can update its default header and timer
      window.dispatchEvent(new CustomEvent('auth:token-refreshed', {
        detail: { access_token }
      }));
      return access_token;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function* parseStreamByTags(textStream) {
    let state = 'seeking'; // 'seeking', 'in_think', 'in_answer', 'in_websearch'
    let buffer = '';

    for await (const textChunk of textStream) {
        buffer += textChunk;

        let i = 0;
        while (i < buffer.length) {
            if (state === 'seeking') {
                // Status tags for web search and RAG
                if (buffer.startsWith('<websearch>', i)) {
                    const end = buffer.indexOf('</websearch>', i);
                    if (end === -1) break; // wait for more data
                    const val = buffer.substring(i + '<websearch>'.length, end);
                    yield { event: 'status.websearch', data: { value: val } };
                    i = end + '</websearch>'.length;
                    continue;
                }
                if (buffer.startsWith('<rag>', i)) {
                    const end = buffer.indexOf('</rag>', i);
                    if (end === -1) break; // wait for more data
                    const val = buffer.substring(i + '<rag>'.length, end);
                    yield { event: 'status.rag', data: { value: val } };
                    i = end + '</rag>'.length;
                    continue;
                }
                if (buffer.startsWith('<citations>', i)) {
                    const end = buffer.indexOf('</citations>', i);
                    if (end === -1) break; // wait for more data
                    const raw = buffer.substring(i + '<citations>'.length, end);
                    try {
                        const parsed = JSON.parse(raw);
                        yield { event: 'citations', data: parsed };
                    } catch (e) {
                        yield { event: 'citations', data: { raw } };
                    }
                    i = end + '</citations>'.length;
                    continue;
                }
                if (buffer.startsWith('<think>', i)) {
                    state = 'in_think';
                    i += '<think>'.length;
                } else if (buffer.startsWith('<answer>', i)) {
                    state = 'in_answer';
                    i += '<answer>'.length;
                } else {
                    yield { event: 'thread.message.delta', data: { content: buffer[i] } };
                    i++;
                }
            } else if (state === 'in_think') {
                if (buffer.startsWith('</think>', i)) {
                    state = 'seeking';
                    i += '</think>'.length;
                } else {
                    yield { event: 'thread.run.step.in_progress', data: { details: buffer[i] } };
                    i++;
                }
            } else if (state === 'in_answer') {
                if (buffer.startsWith('</answer>', i)) {
                    state = 'seeking';
                    i += '</answer>'.length;
                } else {
                    yield { event: 'thread.message.delta', data: { content: buffer[i] } };
                    i++;
                }
            }
        }
        // Keep the unprocessed part of the buffer for the next chunk
        buffer = buffer.substring(i);
    }
}


async function* openAIStreamToText(sseReader) {
    while (true) {
        const { value, done } = await sseReader.read();
        if (done) break;

        const data = value.data;
        if (data.startsWith('[DONE]')) break;
        
        try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
                yield content;
            }
        } catch (e) {
            // Fallback: yield raw data so the caller can surface messages (e.g., backend errors)
            if (typeof data === 'string' && data.length > 0) {
                yield data;
            }
        }
    }
}

export async function* streamResponse(url, requestOptions) {
    const { signal, ...bodyPayload } = requestOptions;

    const makeRequest = async () => {
        const headers = {
            'Content-Type': 'application/json',
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(bodyPayload),
            signal: signal,
            credentials: 'include',
        });
        return response;
    };

    let response = await makeRequest();

    // Handle 401 by refreshing token and retrying once
    if (response.status === 401) {
        try {
            await refreshAccessToken();
            response = await makeRequest();
        } catch (refreshError) {
            // Refresh failed — clear auth and throw
            window.dispatchEvent(new Event('auth:session-expired'));
            throw new Error('Session expired. Please log in again.');
        }
    }

    if (response.status === 403) {
        const errorData = await response.json().catch(() => ({ detail: 'This tool is disabled for your role' }));
        const error = new Error(errorData.detail || 'This tool is disabled for your role');
        error.name = 'ToolForbiddenError';
        error.status = 403;
        throw error;
    }

    if (!response.body) {
        throw new Error('Response body is null');
    }

    const sseReader = response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())
        .getReader();

    const textStream = openAIStreamToText(sseReader);
    const eventStream = parseStreamByTags(textStream);

    yield* eventStream;

    yield { event: 'thread.run.completed', data: {} };
}
