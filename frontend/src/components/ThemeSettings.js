import React from 'react';
import { useLanguage } from '../LanguageContext';
import { useTheme } from '../ThemeContext';

export default function ThemeSettings() {
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  return (
    <section className="mb-5 p-6 rounded-lg border border-border bg-surface">
      <h2 className="text-2xl font-bold mb-4 text-text-primary">{t.theme || "Theme"}</h2>
      <div className="flex space-x-4">
        <button
          className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
            theme === 'light'
              ? 'bg-purple-gradient text-white'
              : 'bg-hover text-text-primary'
          }`}
          onClick={toggleTheme}
          disabled={theme === 'light'}
        >
          {t.light || "Light"}
        </button>
        <button
          className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
            theme === 'dark'
              ? 'bg-purple-gradient text-white'
              : 'bg-hover text-text-primary'
          }`}
          onClick={toggleTheme}
          disabled={theme === 'dark'}
        >
          {t.dark || "Dark"}
        </button>
      </div>
      <p className="mt-4 text-sm text-text-secondary">
        {t.currentTheme || "Current theme:"} {theme === 'dark' ? (t.dark || "Dark") : (t.light || "Light")}
      </p>
    </section>
  );
}