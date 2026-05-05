import { buildArtifactFromMessage } from './artifacts';

describe('artifact helpers', () => {
  it('creates table artifacts from markdown tables', () => {
    const artifact = buildArtifactFromMessage({
      id: 'message-1',
      answer: '| Task | Owner |\n| --- | --- |\n| Review | Alex |',
    });

    expect(artifact.type).toBe('table');
    expect(artifact.content).toContain('| Task | Owner |');
  });

  it('creates document artifacts from headed markdown', () => {
    const artifact = buildArtifactFromMessage({
      id: 'message-2',
      answer: '# Report\n\nBody',
    });

    expect(artifact.type).toBe('document');
    expect(artifact.title).toBe('Report');
  });

  it('returns null for empty messages', () => {
    expect(buildArtifactFromMessage({ answer: '' })).toBeNull();
  });
});
