import React from 'react';
import { useLanguage } from '../LanguageContext';
import ThemeSettings from '../components/ThemeSettings';
import LanguageSettings from '../components/LanguageSettings';

export default function SettingsPage() {
  const { t } = useLanguage();

  return (
    <div className="flex-1 overflow-y-auto overscroll-y-contain p-8 transition-colors duration-300 bg-background text-text-primary">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-extrabold mb-8 text-text-primary">{t.settingsTitle || "Settings"}</h1>

        <ThemeSettings />
        <LanguageSettings />
      </div>
    </div>
  );
}