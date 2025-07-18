import React from 'react';
import { useLanguage } from '../LanguageContext';

export default function FAQPage() {
  const { t } = useLanguage();

  const faqItems = [
    {
      questionKey: 'faqQuestion1',
      answerKey: 'faqAnswer1',
      defaultQuestion: 'What is ShiancoChat?',
      defaultAnswer: 'ShiancoChat is our internal AI assistant using a secure, company-hosted model. It helps you with writing, summarizing, translating, and more.'
    },
    {
      questionKey: 'faqQuestion2',
      answerKey: 'faqAnswer2',
      defaultQuestion: 'Is my data private?',
      defaultAnswer: 'Yes. All conversations stay within our company\'s secure servers. No data is sent to external providers.'
    },
    {
      questionKey: 'faqQuestion3',
      answerKey: 'faqAnswer3',
      defaultQuestion: 'What tasks can it help with?',
      defaultAnswer: 'Email drafting, summarizing documents, translation, research support, marketing copy, code assistance.'
    },
    {
      questionKey: 'faqQuestion4',
      answerKey: 'faqAnswer4',
      defaultQuestion: 'Who can I contact for support?',
      defaultAnswer: 'Please contact the IT / AI Admin Team at [internal email or link].'
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto overscroll-y-contain p-8 transition-colors duration-300 bg-background text-text-primary">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-extrabold mb-8 text-text-primary">{t.faqTitle || "FAQ"}</h1>

        <div className="space-y-6">
          {faqItems.map((item, index) => (
            <details key={index} className="p-5 rounded-lg border cursor-pointer bg-surface border-border">
              <summary className="font-semibold text-lg text-text-primary">
                {t[item.questionKey] || item.defaultQuestion}
              </summary>
              <p className="mt-3 ml-4 leading-relaxed text-text-secondary">
                {t[item.answerKey] || item.defaultAnswer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}