import { EventSourceParserStream } from 'eventsource-parser/stream';

async function* parseStreamByTags(textStream) {
    let state = 'seeking'; // 'seeking', 'in_think', 'in_answer'
    let buffer = '';

    for await (const textChunk of textStream) {
        buffer += textChunk;

        let i = 0;
        while (i < buffer.length) {
            if (state === 'seeking') {
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
            // Ignore parsing errors
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