import React from 'react';
import { useTheme } from '../ThemeContext';
import ChatBubbleIcon from '@/components/icons/ChatBubbleIcon';

const ShiancoChatHeader = ({ iconClassName = 'w-6 h-6', textClassName = 'text-lg' }) => {
  const { theme } = useTheme();

  return (
    <div className="flex items-center space-x-2">
      <ChatBubbleIcon className={iconClassName} useGradient={true} isDarkMode={theme === 'dark'} />
      <span className={`${textClassName} font-bold bg-purple-gradient bg-clip-text text-transparent`}>
        ShiancoChat
      </span>
    </div>
  );
};

export default ShiancoChatHeader;