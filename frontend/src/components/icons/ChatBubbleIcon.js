import React from 'react';

const ChatBubbleIcon = ({ useGradient, isDarkMode, stroke, ...props }) => {
    const strokeColor = stroke || (useGradient ? "url(#chat-bubble-gradient)" : (isDarkMode ? "#FFFFFF" : "#000000"));
    return (
      <svg {...props} fill="none" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="chat-bubble-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" /> {/* Tailwind's purple-500 */}
            <stop offset="100%" stopColor="#3B82F6" /> {/* Tailwind's blue-500 */}
          </linearGradient>
        </defs>
        <path stroke={strokeColor} strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    );
};

export default ChatBubbleIcon;