import React from 'react';
import {
  Lightbulb, FileText, Sparkles, Globe
} from 'lucide-react';
import { useLanguage } from '@/LanguageContext';

const SuggestedPrompts = ({ prompts, onPromptClick, isDarkMode }) => {
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
            className={`p-4 rounded-xl transition-colors text-left border ${isDarkMode ? 'bg-dark-card border-dark-border hover:bg-dark-border' : 'bg-gray-100 border-gray-200 hover:bg-gray-200'}`}
          >
            <div className="flex items-center space-x-3">
              {IconComponent && (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-dark-input-bg' : 'bg-gray-200'}`}>
                  <IconComponent className={`w-6 h-6 ${isDarkMode ? 'text-white' : 'text-black'}`} />
                </div>
              )}
              <div>
                <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-dark-text-light' : 'text-gray-700'}`}>
                  {t[prompt.titleKey] || prompt.title}
                </h3>
                <p className={`text-xs ${isDarkMode ? 'text-dark-text-dark' : 'text-gray-700'}`}>
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