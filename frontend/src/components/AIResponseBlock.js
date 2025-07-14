import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChevronDown, Copy, Check, Clock } from 'lucide-react';
import { useLanguage } from '@/LanguageContext';
import { useTheme } from '@/ThemeContext';
import ChatBubbleIcon from '@/components/icons/ChatBubbleIcon';

// Custom CodeBlock for syntax highlighting and copy functionality
const CodeBlock = ({ node, inline, className, children, ...props }) => {
  const { theme } = useTheme();
  const [isCopied, setIsCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const codeString = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    });
  };

  return !inline && match ? (
    <div className="relative my-4 rounded-lg text-sm bg-surface border border-border">
      <div className="flex items-center justify-between px-4 py-2 rounded-t-lg bg-hover">
        <span className="text-xs font-sans text-text-secondary">{match[1]}</span>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 text-xs transition-colors text-text-secondary hover:text-text-primary"
        >
          {isCopied ? <Check size={14} /> : <Copy size={14} />}
          <span>{isCopied ? 'Copied!' : 'Copy code'}</span>
        </button>
      </div>
      <SyntaxHighlighter style={theme === 'dark' ? vscDarkPlus : prism} language={match[1]} PreTag="div" {...props}>
        {codeString}
      </SyntaxHighlighter>
    </div>
  ) : (
    <code {...props}>
      {children}
    </code>
  );
};

const AIResponseBlock = ({ response }) => {
  const { theme } = useTheme();
  const { thinking, answer, isThinkingComplete, thinkingStartTime, thinkingDuration } = response;
  const [isThinkingOpen, setIsThinkingOpen] = useState(false);
  const [liveDuration, setLiveDuration] = useState(0);
  const { t } = useLanguage();
  const animationFrameRef = useRef();

  useEffect(() => {
    if (thinking && !isThinkingComplete) {
      setIsThinkingOpen(true); // Automatically open when thinking starts
      
      const animate = () => {
        setLiveDuration((Date.now() - thinkingStartTime) / 1000);
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animationFrameRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    } else if (isThinkingComplete) {
      setIsThinkingOpen(false); // Auto collapse when thinking is complete
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  }, [thinking, isThinkingComplete, thinkingStartTime]);

  return (
    <div className="flex justify-start mb-4 group">
      <div className="flex max-w-3xl flex-row items-start">
        <div className="w-8 h-8 rounded-full flex items-center justify-center mr-3 flex-shrink-0 bg-surface">
          <ChatBubbleIcon className="w-5 h-5" isDarkMode={theme === 'dark'} />
        </div>
        <div className="flex-1 min-w-0">
          {thinking && (
            <div className="mb-2">
              <div className="p-4 rounded-lg shadow-md max-w-full bg-surface border border-border">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsThinkingOpen(!isThinkingOpen)}>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {isThinkingComplete ? t.thinkingComplete || 'Thinking Complete' : t.thinking || 'Thinking...'}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <span className="flex items-center space-x-1 text-xs text-text-secondary">
                      {isThinkingComplete ? (
                        <span>Took {Math.floor(thinkingDuration || 0)}s</span>
                      ) : (
                        <>
                          <Clock size={14} />
                          <span>{Math.floor(liveDuration)}s</span>
                        </>
                      )}
                    </span>
                    <ChevronDown className={`w-5 h-5 transition-transform text-text-primary ${isThinkingOpen ? 'rotate-0' : '-rotate-90'}`} />
                  </div>
                </div>
                <div className={`overflow-y-auto transition-all duration-300 ease-in-out ${isThinkingOpen ? 'max-h-72 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words pl-5 italic text-text-secondary">
                    {thinking}
                    {!isThinkingComplete && <span className="animate-pulse">_</span>}
                  </p>
                </div>
              </div>
            </div>
          )}
          {answer && (
            <div className={`prose prose-sm max-w-none ${theme === 'dark' ? 'prose-invert' : ''}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{ code: CodeBlock }}
              >
                {answer}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIResponseBlock;