import React, { createContext, useState, useContext } from 'react';

// Translation data for English and Chinese
const translations = {
  EN: {
    appTitle: "ShiancoChat",
    newChat: "New Chat",
    navigation: "Navigation",
    home: "Home",
    gettingStarted: "Getting Started",
    tutorials: "Tutorials",
    settings: "Settings",
    faq: "FAQ",
    community: "Community",
    securityPolicy: "Security Policy",
    recentConversations: "Recent Conversations",
    rename: "Rename",
    delete: "Delete",
    chatPrompt: "How can I help you today? Choose a starter below or ask me anything.",
    sendMessage: "Send a message...",
    disclaimer: "ShiancoChat may generate inaccurate information about people, places, or facts.",
    user: "Shianco User",
    userName: "Shianco User",
    expand: "Expand",
    collapse: "Collapse",
    darkMode: "Dark Mode",
    toggleSidebar: "Toggle Sidebar",
    toggleTheme: "Toggle Light/Dark Mode",
    thinking: "Thinking...",
    thinkingComplete: "Thinking Complete",
    maximize: "Maximize",
    minimize: "Minimize",
    conversationActions: "Conversation actions",
    welcomeMessage: "Welcome to ShiancoChat! How can I assist you today?",
    prompt1Title: "General Inquiry",
    prompt1Description: "Ask anything about the world or current events",
    prompt2Title: "Document Analysis",
    prompt2Description: "Upload a file for summary or detailed analysis",
    prompt3Title: "Creative Spark",
    prompt3Description: "Get help with ideas for writing or projects",
    prompt4Title: "Language Practice",
    prompt4Description: "Practice conversational skills in any language"
  },
  CN: {
    appTitle: "ShiancoChat",
    newChat: "新聊天",
    navigation: "导航",
    home: "首页",
    gettingStarted: "入门",
    tutorials: "教程",
    settings: "设置",
    faq: "常见问题",
    community: "社区",
    securityPolicy: "安全政策",
    recentConversations: "最近的对话",
    rename: "重命名",
    delete: "删除",
    chatPrompt: "我今天能帮您什么？选择下面的启动器或问我任何问题。",
    sendMessage: "发送消息...",
    disclaimer: "ShiancoChat 可能会生成关于人、地点或事实的不准确信息。",
    user: "Shianco 用户",
    userName: "Shianco 用户",
    expand: "展开",
    collapse: "折叠",
    darkMode: "暗模式",
    toggleSidebar: "切换侧边栏",
    toggleTheme: "切换明暗模式",
    thinking: "思考中...",
    thinkingComplete: "思考完成",
    maximize: "最大化",
    minimize: "最小化",
    conversationActions: "对话操作",
    welcomeMessage: "欢迎使用 ShiancoChat！我今天能为您提供什么帮助？",
    prompt1Title: "一般询问",
    prompt1Description: "询问有关世界或当前事件的任何问题",
    prompt2Title: "文档分析",
    prompt2Description: "上传文件以获取摘要或详细分析",
    prompt3Title: "创意火花",
    prompt3Description: "获取写作或项目的创意帮助",
    prompt4Title: "语言练习",
    prompt4Description: "练习任何语言的会话技能"
  }
};

// Create the Language Context
const LanguageContext = createContext();

// Custom hook to use the language context
export const useLanguage = () => useContext(LanguageContext);

// Language Provider component
export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('EN');

  const toggleLanguage = () => {
    setLanguage(prev => (prev === 'EN' ? 'CN' : 'EN'));
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
};