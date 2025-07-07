import React from 'react';
import { useLanguage } from '../LanguageContext';

export default function ThemeSettings({ isDarkMode, toggleTheme }) {
  const { t } = useLanguage();

  return (
    <section className="mb-10 p-6 rounded-lg border" style={{ borderColor: isDarkMode ? '#444' : '#E0E0E0', backgroundColor: isDarkMode ? '#2D2D2D' : '#F9F9F9' }}>
      <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{t.theme || "Theme"}</h2>
      <div className="flex space-x-4">
        <button
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            !isDarkMode
              ? 'bg-purple-gradient text-white'
              : `${isDarkMode ? 'bg-dark-input-bg text-dark-text-light hover:bg-dark-card' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`
          }`}
          onClick={() => isDarkMode && toggleTheme()}
        >
          {t.light || "Light"}
        </button>
        <button
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            isDarkMode
              ? 'bg-purple-gradient text-white'
              : `${isDarkMode ? 'bg-dark-input-bg text-dark-text-light hover:bg-dark-card' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`
          }`}
          onClick={() => !isDarkMode && toggleTheme()}
        >
          {t.dark || "Dark"}
        </button>
      </div>
      <p className={`mt-4 text-sm ${isDarkMode ? 'text-dark-text-dark' : 'text-gray-600'}`}>
        {t.currentTheme || "Current theme:"} {isDarkMode ? (t.dark || "Dark") : (t.light || "Light")}
      </p>
    </section>
  );
}