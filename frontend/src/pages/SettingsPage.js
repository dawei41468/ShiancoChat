import React from 'react';
import { useLanguage } from '../LanguageContext';
import LanguageSettings from '../components/LanguageSettings';
import ProfileSettings from '../components/ProfileSettings';
import ThemeSettings from '../components/ThemeSettings';

export default function SettingsPage() {
  const { t } = useLanguage();

  return (
    <div className="flex-1 overflow-y-auto overscroll-y-contain p-8 transition-colors duration-300 bg-background text-text-primary">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-extrabold mb-8 text-text-primary">{t.settingsTitle || "Settings"}</h1>

        <ProfileSettings />
        <ThemeSettings />
        <LanguageSettings />
      </div>
    </div>
  );
}