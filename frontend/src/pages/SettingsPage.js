import React from 'react';
import { useLanguage } from '../LanguageContext';
import ThemeSettings from '../components/ThemeSettings';
import LanguageSettings from '../components/LanguageSettings';

export default function SettingsPage({ isDarkMode, toggleTheme }) {
  const { t } = useLanguage();

  return (
    <div className={`flex-1 overflow-y-auto overscroll-y-contain p-8 transition-colors duration-300 ${isDarkMode ? 'dark-theme-bg text-dark-text-light' : 'bg-white text-gray-900'}`}>
      <div className="max-w-3xl mx-auto">
        <h1 className={`text-4xl font-extrabold mb-8 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{t.settingsTitle}</h1>

        <ThemeSettings isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
        <LanguageSettings isDarkMode={isDarkMode} />

        <section className="p-6 rounded-lg border" style={{ borderColor: isDarkMode ? '#444' : '#E0E0E0', backgroundColor: isDarkMode ? '#2D2D2D' : '#F9F9F9' }}>
          <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{t.dataManagement}</h2>
          <button className={`px-6 py-3 rounded-lg font-semibold transition-colors ${isDarkMode ? 'bg-dark-input-bg text-red-400 hover:bg-dark-card' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
            {t.clearConversationHistory}
          </button>
        </section>
      </div>
    </div>
  );
}