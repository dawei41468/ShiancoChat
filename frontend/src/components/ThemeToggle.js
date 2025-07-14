import React from 'react';
import { useTheme } from '../ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex space-x-2">
      <button
        onClick={theme !== 'light' ? toggleTheme : undefined}
        disabled={theme === 'light'}
        className={`p-2 rounded-full transition-colors ${
          theme === 'light'
            ? 'bg-purple-gradient text-white'
            : 'bg-hover text-text-primary'
        }`}
      >
        <Sun size={12} />
      </button>
      <button
        onClick={theme !== 'dark' ? toggleTheme : undefined}
        disabled={theme === 'dark'}
        className={`p-2 rounded-full transition-colors ${
          theme === 'dark'
            ? 'bg-purple-gradient text-white'
            : 'bg-hover text-text-primary'
        }`}
      >
        <Moon size={12} />
      </button>
    </div>
  );
}