// Centralized React Query keys
export const keys = {
  auth: {
    currentUser: ['auth', 'currentUser'],
  },
  chat: {
    conversations: ['chat', 'conversations'],
    messages: (conversationId) => ['chat', 'messages', conversationId],
    models: ['chat', 'models'],
  },
  documents: {
    list: ['documents', 'list'],
    item: (id) => ['documents', 'item', id],
  },
};
