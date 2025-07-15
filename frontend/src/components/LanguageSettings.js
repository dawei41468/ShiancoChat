import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';

export default function LanguageSettings() {
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
    <section className="mb-5 p-6 rounded-lg border border-border bg-surface">
      <h2 className="text-2xl font-bold mb-4 text-text-primary">{t.language || "Language"}</h2>
      <div className="flex space-x-4">
        <button
          className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
            selectedLanguage === 'EN'
              ? 'bg-purple-gradient text-white'
              : 'bg-hover text-text-primary'
          }`}
          onClick={() => selectedLanguage !== 'EN' && handleLanguageChange('EN')}
        >
          {t.english || "English"}
        </button>
        <button
          className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
            selectedLanguage === 'CN'
              ? 'bg-purple-gradient text-white'
              : 'bg-hover text-text-primary'
          }`}
          onClick={() => selectedLanguage !== 'CN' && handleLanguageChange('CN')}
        >
          {t.chinese || "中文"}
        </button>
      </div>
      <p className="mt-4 text-sm text-text-secondary">
        {t.currentLanguage || "Current language:"} {selectedLanguage === 'EN' ? (t.english || "English") : (t.chinese || "中文")}
      </p>
    </section>
  );
}