jest.mock('eventsource-parser/stream', () => ({
  EventSourceParserStream: class FakeEventSourceParserStream {
    constructor() {}
  },
}));

import { streamResponse, parseStreamByTags } from './streaming';

async function* makeTextStream(chunks) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe('parseStreamByTags', () => {
  test('extracts thinking and answer tokens', async () => {
    const stream = makeTextStream(['<think>reasoning</think><answer>final answer</answer>']);
    const events = [];
    for await (const event of parseStreamByTags(stream)) {
      events.push(event);
    }

    const thinkEvents = events.filter(e => e.event === 'thread.run.step.in_progress');
    const answerEvents = events.filter(e => e.event === 'thread.message.delta');

    expect(thinkEvents.length).toBeGreaterThan(0);
    expect(answerEvents.length).toBeGreaterThan(0);
    expect(thinkEvents.map(e => e.data.details).join('')).toBe('reasoning');
    expect(answerEvents.map(e => e.data.content).join('')).toBe('final answer');
  });

  test('handles websearch and rag status tags', async () => {
    const stream = makeTextStream([
      '<websearch>true</websearch><websearch>results</websearch><websearch>false</websearch>'
    ]);
    const events = [];
    for await (const event of parseStreamByTags(stream)) {
      events.push(event);
    }

    expect(events.some(e => e.event === 'status.websearch' && e.data.value === 'true')).toBe(true);
    expect(events.some(e => e.event === 'status.websearch' && e.data.value === 'results')).toBe(true);
  });
});

describe('streamResponse auth cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('401 with failed refresh dispatches session-expired', async () => {
    global.fetch = jest.fn((url) => {
      if (url.includes('/api/openai/chat')) {
        return Promise.resolve({ status: 401 });
      }
      if (url.includes('/api/auth/refresh')) {
        return Promise.resolve({ status: 401, ok: false });
      }
      return Promise.resolve({ status: 200 });
    });

    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');

    const iterator = streamResponse('http://localhost:4100/api/openai/chat', {
      text: 'hello',
      model: 'test-model'
    });

    await expect(async () => {
      for await (const event of iterator) {
        // no-op
      }
    }).rejects.toThrow('Session expired');

    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));
  });
});
