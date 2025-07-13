import React from 'react';
import { useTheme } from '../ThemeContext';
import ChatBubbleIcon from '@/components/icons/ChatBubbleIcon';

const ShiancoChatHeader = () => {
  const { theme } = useTheme();

  return (
    <div className="flex items-center space-x-2">
      <ChatBubbleIcon className="w-6 h-6" useGradient={true} isDarkMode={theme === 'dark'} />
      <span className="text-lg font-bold bg-purple-gradient bg-clip-text text-transparent">ShiancoChat</span>
    </div>
  );
};

export default ShiancoChatHeader;