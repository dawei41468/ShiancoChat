import React from 'react';
import { useLanguage } from '../LanguageContext';

export default function TutorialsPage() {
  const { t } = useLanguage();

  return (
    <div className="flex-1 overflow-y-auto overscroll-y-contain p-8 transition-colors duration-300 bg-background text-text-primary">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-extrabold mb-6 text-text-primary">{t.tutorialsTitle || "Tutorials"}</h1>
        <p className="text-lg mb-8 text-text-secondary">
          {t.tutorialsWelcome || "Welcome to the ShiancoChat internal AI Tutorials. Here you'll learn how to use the assistant for your daily work."}
        </p>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4 text-text-primary">{t.quickStartTitle || "Quick Start"}</h2>
          <ul className="list-disc list-inside space-y-2 text-text-secondary">
            <li>{t.quickStart1 || "Open a new chat from the sidebar"}</li>
            <li>{t.quickStart2 || "Type your request clearly and specifically"}</li>
            <li>{t.quickStart3 || "Review AI responses carefully"}</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4 text-text-primary">{t.recommendedUseCasesTitle || "Recommended Use Cases"}</h2>
          <ul className="list-disc list-inside space-y-2 text-text-secondary">
            <li>{t.useCase1 || "Drafting professional emails"}</li>
            <li>{t.useCase2 || "Summarizing reports"}</li>
            <li>{t.useCase3 || "Translation (English / Chinese)"}</li>
            <li>{t.useCase4 || "Writing marketing copy"}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-text-primary">{t.examplePromptsTitle || "Example Prompts"}</h2>
          <pre className="p-4 rounded-lg font-mono text-sm bg-surface text-text-primary">
            {t.examplePrompt1 || "Write a formal apology email to a supplier."}{"\n"}
            {t.examplePrompt2 || "Summarize this meeting note in 3 bullet points."}{"\n"}
            {t.examplePrompt3 || "Translate this text to Chinese."}
          </pre>
        </section>
      </div>
    </div>
  );
}