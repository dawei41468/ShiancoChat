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
  const getStatusText = () => {
    const { t, webSearchState, isThinkingComplete, thinkingDuration } = response;
    if (isThinkingComplete) {
      return t?.thoughtForSeconds || `Thought for ${Math.floor(thinkingDuration || 0)} seconds`;
    }
    if (webSearchState === 'results') {
      return t?.webSearchFound || 'Found web results...';
    }
    if (webSearchState === 'no_results') {
      return t?.webSearchEmpty || 'No web results found...';
    }
    if (webSearchState === 'true') {
      return t?.webSearching || 'Searching the web...';
    }
    return t?.thinking || 'Thinking...';
  };

  const { theme } = useTheme();
  const { thinking, answer, isThinkingComplete, thinkingStartTime, thinkingDuration, isWebSearch } = response;
  const [isThinkingOpen, setIsThinkingOpen] = useState(false);
  const [liveDuration, setLiveDuration] = useState(0);
  const { t } = useLanguage();
  const animationFrameRef = useRef();

  useEffect(() => {
    if (thinking && !isThinkingComplete) {
      // Do not automatically open when thinking starts, allow user control
      
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
      // Keep user preference, do not auto collapse
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
              <div className="flex flex-col">
                <div className="flex items-center cursor-pointer space-x-2" onClick={() => setIsThinkingOpen(!isThinkingOpen)}>
                  <h3 className="text-sm font-semibold flex items-center">
                    {!isThinkingComplete && (
                      <svg
                        aria-hidden="true"
                        className="w-4 h-4 mr-2"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <style>
                          {`
                            .spinner_ajPY {
                              transform-origin: center;
                              animation: spinner_AtaB 0.75s infinite linear;
                            }
                            @keyframes spinner_AtaB {
                              100% {
                                transform: rotate(360deg);
                              }
                            }
                          `}
                        </style>
                        <path
                          d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"
                          opacity=".25"
                        />
                        <path
                          d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z"
                          className="spinner_ajPY"
                        />
                      </svg>
                    )}
                    <span className={!isThinkingComplete ? "animated-gradient-text" : ""}>
                      {getStatusText()}
                    </span>
                  </h3>
                  <div className="flex items-center space-x-2"> {/* Removed ml-auto */}
                    <span className="flex items-center space-x-1 text-xs text-text-secondary">
                      {isThinkingComplete ? (
                        null
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
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words pl-5 italic text-text-secondary border-l-2 border-primary-500"> {/* Added border-l-2 and border-primary-500 */}
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