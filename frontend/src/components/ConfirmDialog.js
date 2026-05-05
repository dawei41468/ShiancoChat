import React from 'react';

export default function ConfirmDialog({ open, title, message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel, danger = false }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-background border border-border shadow-lg p-6">
        {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
        <p className="text-text-secondary mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-border hover:bg-surface transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-md text-white transition-colors ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
