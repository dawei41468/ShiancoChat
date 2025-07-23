import React, { createContext, useState, useContext } from 'react';

// Translation data for English and Chinese
const translations = {
  EN: {
    appTitle: "ShiancoChat",
    newChat: "New Chat",
    navigation: "Navigation",
    home: "Home",
    tutorials: "Tutorials",
    settings: "Settings",
    faq: "FAQ",
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
    tutorials: "教程",
    settings: "设置",
    faq: "常见问题",
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
    prompt4Description: "练习任何语言的会话技能",
    
    // Admin Page
    adminPanelTitle: "管理面板",
    userManagement: "用户管理",
    chatSettings: "聊天设置",
    adminSettings: "管理员设置",
    loadingUsers: "加载用户中...",
    noUsersFound: "未找到用户",
    userInfo: "用户信息",
    userId: "用户ID",
    role: "角色",
    actions: "操作",
    delete: "删除",
    user: "用户",
    admin: "管理员",
    chatSettingsPlaceholder: "聊天设置内容将显示在这里。",
    adminSettingsPlaceholder: "管理员设置内容将显示在这里。",
    userDeletedSuccess: "用户 {username} 已成功删除。",
    roleUpdatedSuccess: "用户角色已更新为 {role}",
    deleteUserConfirm: "确定要删除用户 {username} 吗？此操作无法撤销。",
    // Tutorials Page
    tutorialsTitle: "教程",
    tutorialsWelcome: "欢迎来到 ShiancoChat 内部 AI 教程。在这里您将学习如何使用助手进行日常工作。",
    quickStartTitle: "快速开始",
    quickStart1: "从侧边栏打开新聊天",
    quickStart2: "清晰具体地输入您的请求",
    quickStart3: "仔细审查 AI 回复",
    recommendedUseCasesTitle: "推荐用例",
    useCase1: "起草专业电子邮件",
    useCase2: "总结报告",
    useCase3: "翻译（英文/中文）",
    useCase4: "撰写营销文案",
    examplePromptsTitle: "示例提示",
    examplePrompt1: "撰写一封正式的道歉邮件给供应商。",
    examplePrompt2: "用3个要点总结这份会议记录。",
    examplePrompt3: "将此文本翻译成中文。",
    // FAQ Page
    faqTitle: "常见问题",
    faqQuestion1: "ShiancoChat 是什么？",
    faqAnswer1: "ShiancoChat 是我们内部的 AI 助手，使用安全的、公司托管的模型。它可以帮助您进行写作、总结、翻译等。",
    faqQuestion2: "我的数据是私密的吗？",
    faqAnswer2: "是的。所有对话都保留在公司安全的服务器内。不会向外部提供商发送任何数据。",
    faqQuestion3: "它可以帮助完成哪些任务？",
    faqAnswer3: "起草电子邮件、总结文档、翻译、研究支持、营销文案、代码辅助。",
    faqQuestion4: "我应该联系谁寻求支持？",
    faqAnswer4: "请联系 IT / AI 管理团队 [内部电子邮件或链接]。",
    // Settings Page
    settingsTitle: "设置",
    theme: "主题",
    light: "浅色",
    dark: "深色",
    currentTheme: "当前主题:",
    language: "语言",
    english: "英语",
    chinese: "中文",
    currentLanguage: "当前语言:",
    userProfile: "用户资料",
    userEmail: "用户邮箱",
    editName: "编辑名称",
    save: "保存",
    currentUserNamePlaceholder: "当前用户名",
    deleteAccount: "删除账户",
  }
};

// Create the Language Context
const LanguageContext = createContext();

// Custom hook to use the language context
export const useLanguage = () => useContext(LanguageContext);

// Language Provider component
export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem('appLanguage');
    return savedLanguage ? savedLanguage : 'EN';
  });

  // Persist language to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('appLanguage', language);
  }, [language]);

  const toggleLanguage = (newLang) => {
    setLanguage(newLang);
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
};