import React from 'react';
import {
  Lightbulb, FileText, Sparkles, Globe
} from 'lucide-react';
import { useLanguage } from '@/LanguageContext';

const SuggestedPrompts = ({ prompts, onPromptClick }) => {
  const LucideIconMap = {
    Lightbulb, FileText, Sparkles, Globe
  };
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
      {prompts.map((prompt, index) => {
        const IconComponent = LucideIconMap[prompt.icon];
        return (
          <button
            key={index}
            onClick={() => onPromptClick(prompt)}
            className="p-4 rounded-xl transition-colors text-left border bg-surface border-border hover:bg-hover"
          >
            <div className="flex items-center space-x-3">
              {IconComponent && (
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-background">
                  <IconComponent className="w-6 h-6 text-text-primary" />
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold mb-1 text-text-primary">
                  {t[prompt.titleKey] || prompt.title}
                </h3>
                <p className="text-xs text-text-secondary">
                  {t[prompt.descriptionKey] || prompt.description}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default SuggestedPrompts;