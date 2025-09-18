import { EventSourceParserStream } from 'eventsource-parser/stream';

async function* parseStreamByTags(textStream) {
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

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        signal: signal,
    });

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