import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';

export default function LanguageSettings({ isDarkMode }) {
  const { language, toggleLanguage, t } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState(language);

  useEffect(() => {
    setSelectedLanguage(language);
  }, [language]);

  const handleLanguageChange = (lang) => {
    setSelectedLanguage(lang);
    toggleLanguage(lang);
  };

  return (
    <section className="mb-10 p-6 rounded-lg border" style={{ borderColor: isDarkMode ? '#444' : '#E0E0E0', backgroundColor: isDarkMode ? '#2D2D2D' : '#F9F9F9' }}>
      <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{t.language || "Language"}</h2>
      <div className="flex space-x-4">
        <button
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            selectedLanguage === 'EN'
              ? 'bg-purple-gradient text-white'
              : `${isDarkMode ? 'bg-dark-input-bg text-dark-text-light hover:bg-dark-card' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`
          }`}
          onClick={() => selectedLanguage !== 'EN' && handleLanguageChange('EN')}
        >
          {t.english || "English"}
        </button>
        <button
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            selectedLanguage === 'CN'
              ? 'bg-purple-gradient text-white'
              : `${isDarkMode ? 'bg-dark-input-bg text-dark-text-light hover:bg-dark-card' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`
          }`}
          onClick={() => selectedLanguage !== 'CN' && handleLanguageChange('CN')}
        >
          {t.chinese || "中文"}
        </button>
      </div>
      <p className={`mt-4 text-sm ${isDarkMode ? 'text-dark-text-dark' : 'text-gray-600'}`}>
        {t.currentLanguage || "Current language:"} {selectedLanguage === 'EN' ? (t.english || "English") : (t.chinese || "中文")}
      </p>
    </section>
  );
}