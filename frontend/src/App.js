import React, { useState, useEffect, useContext } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './AuthContext';
import { LanguageProvider } from './LanguageContext';
import { ChatProvider } from './ChatContext';
import TutorialsPage from './pages/TutorialsPage';
import FAQPage from './pages/FAQPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import ChatPage from './pages/ChatPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';

function App() {
  useEffect(() => {
    const faviconLink = document.getElementById('favicon');
    if (faviconLink) {
      const svg = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="chat-bubble-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#8B5CF6" />
              <stop offset="100%" stop-color="#3B82F6" />
            </linearGradient>
          </defs>
          <path
            d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
            stroke="url(#chat-bubble-gradient)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      `;
      faviconLink.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
  }, []);

  return (
    <Router>
      <AuthProvider>
        <LanguageProvider>
          <ChatProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/*" element={<ProtectedRoute />} />
            </Routes>
          </ChatProvider>
        </LanguageProvider>
      </AuthProvider>
    </Router>
  );
}

const ProtectedRoute = () => {
  const { token } = useContext(AuthContext);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden font-medium bg-background text-text-primary">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        <div className="flex-1 overflow-y-auto overscroll-y-contain">
          <Routes>
            <Route path="/" element={<ChatPage sidebarOpen={sidebarOpen} />} />
            <Route path="/tutorials" element={<TutorialsPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default App;