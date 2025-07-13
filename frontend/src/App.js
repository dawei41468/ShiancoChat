import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { LanguageProvider } from './LanguageContext';
import { ChatProvider } from './ChatContext'; // Import ChatProvider
import TutorialsPage from './pages/TutorialsPage';
import FAQPage from './pages/FAQPage';
import SettingsPage from './pages/SettingsPage';
import ChatPage from './pages/ChatPage';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <Router>
      <LanguageProvider>
        <ChatProvider>
          <div className="flex h-screen overflow-hidden font-medium bg-background text-text-primary">
            <Sidebar
              isOpen={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
              <TopBar
                onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                selectedModel="deepseek/deepseek-r1-0528-qwen3-8b"
              />
              <div className="flex-1 overflow-y-auto overscroll-y-contain">
                <Routes>
                  <Route path="/" element={<ChatPage sidebarOpen={sidebarOpen} />} />
                  <Route path="/tutorials" element={<TutorialsPage />} />
                  <Route path="/faq" element={<FAQPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
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