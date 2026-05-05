import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, FileText, PanelRightClose, Save, Table, Trash2 } from 'lucide-react';
import { copyArtifactContent } from '@/utils/artifacts';
import ConfirmDialog from './ConfirmDialog';

export default function ArtifactPanel({ artifact, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState('');
  const [title, setTitle] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setDraft(artifact?.content || '');
    setTitle(artifact?.title || '');
    setCopied(false);
  }, [artifact]);

  if (!artifact) return null;

  const Icon = artifact.type === 'table' ? Table : FileText;

  const handleCopy = async () => {
    await copyArtifactContent({ ...artifact, content: draft });
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(artifact.id, { title: title.trim() || artifact.title, content: draft });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!onDelete) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    await onDelete(artifact.id);
    onClose?.();
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-[420px] flex flex-col border-l border-border bg-background shadow-2xl xl:static xl:w-[420px] xl:shrink-0 xl:shadow-none">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex items-center gap-2">
          <Icon className="h-4 w-4 text-text-secondary" />
          <div className="min-w-0">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full truncate bg-transparent text-sm font-semibold text-text-primary focus:outline-none"
            />
            <div className="text-xs text-text-secondary">{artifact.type}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md p-2 text-text-secondary hover:bg-hover disabled:opacity-40"
            aria-label="Save artifact"
            title="Save artifact"
          >
            <Save className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md p-2 text-text-secondary hover:bg-hover"
            aria-label="Copy artifact"
            title="Copy artifact"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-md p-2 text-red-500 hover:bg-hover"
            aria-label="Delete artifact"
            title="Delete artifact"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-text-secondary hover:bg-hover"
            aria-label="Close artifact panel"
            title="Close artifact panel"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      {copied && (
        <div className="border-b border-border px-4 py-2 text-xs text-emerald-500">
          Copied
        </div>
      )}
      {saving && (
        <div className="border-b border-border px-4 py-2 text-xs text-text-secondary">
          Saving...
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-rows-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="min-h-0 w-full resize-none border-b border-border bg-surface p-4 font-mono text-xs leading-5 text-text-primary focus:outline-none"
        />
        <div className="min-h-0 overflow-y-auto p-4">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {draft}
            </ReactMarkdown>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Artifact"
        message={`Delete "${artifact.title}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </aside>
  );
}
