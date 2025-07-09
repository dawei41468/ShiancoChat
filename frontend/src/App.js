import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import './App.css';
import { LanguageProvider } from './LanguageContext';
import { ChatProvider } from './ChatContext'; // Import ChatProvider
import TutorialsPage from './pages/TutorialsPage';
import FAQPage from './pages/FAQPage';
import SettingsPage from './pages/SettingsPage';
import ChatPage from './pages/ChatPage';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';

function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('isDarkMode');
    return savedTheme ? JSON.parse(savedTheme) : true;
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light-theme');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light-theme');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    console.log('Toggle theme clicked, switching mode');
    setIsDarkMode(prevMode => !prevMode);
  };

  return (
    <Router>
      <LanguageProvider>
        <ChatProvider>
          <div className={`flex h-screen overflow-hidden font-medium ${isDarkMode ? 'dark-theme-bg text-dark-text-light' : 'bg-light-background text-light-text-dark'}`}>
            {/* Sidebar - now globally fixed */}
            <Sidebar
              isOpen={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              isDarkMode={isDarkMode}
            />

            {/* Main Content Area - takes remaining space, handles its own scrolling */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Top Bar - now globally fixed */}
              <TopBar
                onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                selectedModel="deepseek/deepseek-r1-0528-qwen3-8b"
                isDarkMode={isDarkMode}
              />
              {/* Content area below TopBar, which will be scrollable */}
              <div className="flex-1 overflow-y-auto overscroll-y-contain">
                <Routes>
                  <Route path="/" element={<ChatPage isDarkMode={isDarkMode} sidebarOpen={sidebarOpen} />} />
                  <Route path="/tutorials" element={<TutorialsPage isDarkMode={isDarkMode} />} />
                  <Route path="/faq" element={<FAQPage isDarkMode={isDarkMode} />} />
                  <Route path="/settings" element={<SettingsPage isDarkMode={isDarkMode} toggleTheme={toggleTheme} />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </div>
          </div>
        </ChatProvider>
      </LanguageProvider>
    </Router>
  );
}

export default App;