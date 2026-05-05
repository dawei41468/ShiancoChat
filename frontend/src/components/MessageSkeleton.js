import React from 'react';

export const UserMessageSkeleton = () => (
  <div className="flex justify-end mb-4">
    <div className="flex max-w-3xl flex-row-reverse">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-user-bubble-background text-user-bubble-text ml-3">
        <span className="text-sm font-bold">U</span>
      </div>
      <div className="px-4 py-3 rounded-2xl bg-user-bubble-background min-w-[120px]">
        <div className="space-y-2">
          <div className="h-3 bg-white/20 rounded w-48 animate-pulse" />
          <div className="h-3 bg-white/20 rounded w-32 animate-pulse" />
        </div>
      </div>
    </div>
  </div>
);

export const AIMessageSkeleton = () => (
  <div className="flex justify-start mb-4">
    <div className="flex max-w-3xl flex-row">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-surface text-text-primary mr-3">
        <span className="text-sm font-bold">AI</span>
      </div>
      <div className="px-4 py-3 rounded-2xl bg-surface min-w-[200px] space-y-3">
        {/* Thinking section skeleton */}
        <div className="space-y-2">
          <div className="h-3 bg-text-secondary/10 rounded w-full animate-pulse" />
          <div className="h-3 bg-text-secondary/10 rounded w-5/6 animate-pulse" />
          <div className="h-3 bg-text-secondary/10 rounded w-4/6 animate-pulse" />
        </div>
        {/* Answer section skeleton */}
        <div className="space-y-2">
          <div className="h-3 bg-text-secondary/10 rounded w-full animate-pulse" />
          <div className="h-3 bg-text-secondary/10 rounded w-3/4 animate-pulse" />
        </div>
      </div>
    </div>
  </div>
);

export const ThinkingSkeleton = () => (
  <div className="flex justify-start mb-4">
    <div className="flex max-w-3xl flex-row">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-surface text-text-primary mr-3">
        <span className="text-sm font-bold">AI</span>
      </div>
      <div className="px-4 py-3 rounded-2xl bg-surface">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-text-secondary/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-text-secondary/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-text-secondary/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          <span className="text-sm text-text-secondary ml-1">Thinking...</span>
        </div>
      </div>
    </div>
  </div>
);
