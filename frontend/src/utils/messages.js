export const processAssistantMessage = (msg) => {
  let thinkingContent = '';
  let answerContent = '';

  if (msg.sender === 'assistant' && msg.text) {
    const thinkMatch = msg.text.match(/<think>((?:.|\n)*?)<\/think>/);
    const answerMatch = msg.text.match(/<answer>((?:.|\n)*?)<\/answer>/);

    thinkingContent = thinkMatch ? thinkMatch[1] : '';

    if (answerMatch) {
      answerContent = answerMatch[1];
    } else {
      answerContent = msg.text.replace(/<think>.*<\/think>/s, '').trim();
    }
  } else {
    answerContent = msg.text;
  }

  const webSearchState = msg.webSearchState || msg.web_search_state;
  const ragState = msg.ragState || msg.rag_state;
  const citations = Array.isArray(msg.citations) ? msg.citations : [];

  return {
    ...msg,
    timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    thinking: thinkingContent,
    answer: answerContent,
    isThinkingComplete: true,
    thinkingDuration: msg.thinking_duration || 0,
    webSearchState,
    ragState,
    citations,
  };
};
