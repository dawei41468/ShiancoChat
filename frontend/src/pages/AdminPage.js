import React from 'react';
import { useLanguage } from '../LanguageContext';

export default function AdminPage() {
  const { t } = useLanguage();

  return (
    <div className="flex-1 overflow-y-auto overscroll-y-contain p-8 transition-colors duration-300 bg-background text-text-primary">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-extrabold mb-8 text-text-primary">{t.adminPanelTitle || "Admin Panel"}</h1>
        <p className="text-lg text-text-secondary">
          {t.adminPanelPlaceholder || "This is the placeholder for the Admin Panel. More features will be added here soon."}
        </p>
      </div>
    </div>
  );
}