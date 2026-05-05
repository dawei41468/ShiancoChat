import React, { useState, useEffect, useRef } from 'react';

export default function PromptDialog({ open, title, message, defaultValue = '', confirmText = 'OK', cancelText = 'Cancel', onConfirm, onCancel }) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, defaultValue]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg bg-background border border-border shadow-lg p-6">
        {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
        {message && <p className="text-text-secondary mb-4">{message}</p>}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text-primary mb-6 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-border hover:bg-surface transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </form>
    </div>
  );
}
