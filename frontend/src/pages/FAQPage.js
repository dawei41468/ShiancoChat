import React from 'react';
import { useLanguage } from '../LanguageContext';

export default function FAQPage({ isDarkMode }) { // Receive isDarkMode as prop
  const { t } = useLanguage();

  const faqItems = [
    {
      questionKey: 'faqQuestion1',
      answerKey: 'faqAnswer1',
    },
    {
      questionKey: 'faqQuestion2',
      answerKey: 'faqAnswer2',
    },
    {
      questionKey: 'faqQuestion3',
      answerKey: 'faqAnswer3',
    },
    {
      questionKey: 'faqQuestion4',
      answerKey: 'faqAnswer4',
    },
  ];

  return (
    <div className={`flex-1 overflow-y-auto overscroll-y-contain p-8 transition-colors duration-300 ${isDarkMode ? 'dark-theme-bg text-dark-text-light' : 'bg-white text-gray-900'}`}>
      <div className="max-w-3xl mx-auto">
        <h1 className={`text-4xl font-extrabold mb-8 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{t.faqTitle}</h1>

        <div className="space-y-6">
          {faqItems.map((item, index) => (
            <details key={index} className={`p-5 rounded-lg border cursor-pointer ${isDarkMode ? 'bg-dark-card border-dark-border' : 'bg-gray-50 border-gray-200'}`}>
              <summary className={`font-semibold text-lg ${isDarkMode ? 'text-dark-text-light' : 'text-gray-800'}`}>
                {t[item.questionKey]}
              </summary>
              <p className={`mt-3 ml-4 leading-relaxed ${isDarkMode ? 'text-dark-text-dark' : 'text-gray-700'}`}>
                {t[item.answerKey]}
              </p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}