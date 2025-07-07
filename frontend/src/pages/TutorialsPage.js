import React from 'react';
import { useLanguage } from '../LanguageContext';

export default function TutorialsPage({ isDarkMode }) { // Receive isDarkMode as prop
  const { t } = useLanguage();

  return (
    <div className={`flex-1 overflow-y-auto overscroll-y-contain p-8 transition-colors duration-300 ${isDarkMode ? 'dark-theme-bg text-dark-text-light' : 'bg-white text-gray-900'}`}>
      <div className="max-w-3xl mx-auto">
        <h1 className={`text-4xl font-extrabold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{t.tutorialsTitle}</h1>
        <p className={`text-lg mb-8 ${isDarkMode ? 'text-dark-text-dark' : 'text-gray-700'}`}>
          {t.tutorialsWelcome}
        </p>

        <section className="mb-10">
          <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{t.quickStartTitle}</h2>
          <ul className={`list-disc list-inside space-y-2 ${isDarkMode ? 'text-dark-text-dark' : 'text-gray-700'}`}>
            <li>{t.quickStart1}</li>
            <li>{t.quickStart2}</li>
            <li>{t.quickStart3}</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{t.recommendedUseCasesTitle}</h2>
          <ul className={`list-disc list-inside space-y-2 ${isDarkMode ? 'text-dark-text-dark' : 'text-gray-700'}`}>
            <li>{t.useCase1}</li>
            <li>{t.useCase2}</li>
            <li>{t.useCase3}</li>
            <li>{t.useCase4}</li>
          </ul>
        </section>

        <section>
          <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{t.examplePromptsTitle}</h2>
          <pre className={`p-4 rounded-lg font-mono text-sm ${isDarkMode ? 'bg-dark-card text-dark-text-light' : 'bg-gray-100 text-gray-800'}`}>
            {t.examplePrompt1}{"\n"}
            {t.examplePrompt2}{"\n"}
            {t.examplePrompt3}
          </pre>
        </section>
      </div>
    </div>
  );
}