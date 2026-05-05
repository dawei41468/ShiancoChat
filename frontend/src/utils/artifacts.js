const TABLE_PATTERN = /(?:^|\n)(\|.+\|\n\|[\s:|-]+\|\n(?:\|.*\|\n?)+)/;

export const buildArtifactFromMessage = (message) => {
  const content = (message?.answer || message?.text || '').trim();
  if (!content) return null;

  const tableMatch = content.match(TABLE_PATTERN);
  if (tableMatch) {
    return {
      id: `artifact-${message.id || Date.now()}`,
      type: 'table',
      title: 'Table Artifact',
      content: tableMatch[1].trim(),
      sourceMessageId: message.id,
      createdAt: new Date().toISOString(),
    };
  }

  const headingMatch = content.match(/^#\s+(.+)$/m);
  return {
    id: `artifact-${message.id || Date.now()}`,
    type: 'document',
    title: headingMatch?.[1]?.trim() || 'Response Artifact',
    content,
    sourceMessageId: message.id,
    createdAt: new Date().toISOString(),
  };
};

export const copyArtifactContent = async (artifact) => {
  if (!artifact?.content) return false;
  await navigator.clipboard.writeText(artifact.content);
  return true;
};
