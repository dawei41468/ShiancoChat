import React, { useEffect, useRef, useState } from 'react';
import { X, Globe, FileText, Server, Trash2, Plus, Save, RefreshCw, Database, Search, Pencil } from 'lucide-react';
import * as apiService from '@/services/apiService';
import { useLanguage } from '@/LanguageContext';
import { useChat } from '@/ChatContext';
import ConfirmDialog from './ConfirmDialog';

export default function SettingsSheet({ open, onClose }) {
  const { t } = useLanguage();
  const {
    availableModels,
    selectedModel,
    modelPolicy,
    modelPolicies,
    handleModelPolicyChange,
    manualModelOverride,
    handleManualModelOverrideChange,
    knowledgeSpaces,
    selectedKnowledgeSpace,
    selectedKnowledgeSpaceId,
    knowledgeSpaceDocuments,
    handleKnowledgeSpaceChange,
    fetchSelectedKnowledgeSpace,
    createKnowledgeSpace,
    updateKnowledgeSpace,
    deleteKnowledgeSpace,
    deleteDocument,
  } = useChat();
  const [endpoints, setEndpoints] = useState([]);
  const [webDefault, setWebDefault] = useState(true);
  const [ragDefault, setRagDefault] = useState(true);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [spaceName, setSpaceName] = useState('');
  const [spaceDescription, setSpaceDescription] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [deleteDocId, setDeleteDocId] = useState(null);
  const [showDeleteSpaceConfirm, setShowDeleteSpaceConfirm] = useState(false);
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // Store previously focused element
    previousFocusRef.current = document.activeElement;

    // Focus first focusable element inside panel after mount
    const timer = setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusables[0];
      if (first) first.focus();
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.disabled && el.offsetParent !== null);

      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus on close
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;

    apiService.fetchLLMConfig().then((res) => {
      if (!mounted) return;
      setEndpoints(res.data?.endpoints || []);
    }).catch(() => {});

    // Load defaults from localStorage
    const w = localStorage.getItem('default_web_search');
    const r = localStorage.getItem('default_rag');
    setWebDefault(w === null ? true : w === 'true');
    setRagDefault(r === null ? true : r === 'true');

    fetchSelectedKnowledgeSpace();

    return () => { mounted = false; };
  }, [open, fetchSelectedKnowledgeSpace]);

  useEffect(() => {
    setSpaceName(selectedKnowledgeSpace?.name || '');
    setSpaceDescription(selectedKnowledgeSpace?.description || '');
  }, [selectedKnowledgeSpace]);

  const handleSave = () => {
    localStorage.setItem('default_web_search', String(webDefault));
    localStorage.setItem('default_rag', String(ragDefault));
    onClose?.();
  };

  const handleDeleteDocument = (documentId) => {
    setDeleteDocId(documentId);
  };

  const confirmDeleteDocument = async () => {
    if (!deleteDocId) return;
    try {
      await deleteDocument(deleteDocId);
    } catch (error) {
      console.error('Failed to delete knowledge source:', error);
    } finally {
      setDeleteDocId(null);
    }
  };

  const handleCreateSpace = async (event) => {
    event.preventDefault();
    const name = newSpaceName.trim();
    if (!name) return;
    setBusyAction('create-space');
    try {
      await createKnowledgeSpace({ name });
      setNewSpaceName('');
    } catch (error) {
      console.error('Failed to create knowledge space:', error);
    } finally {
      setBusyAction('');
    }
  };

  const handleSaveSpace = async () => {
    if (!selectedKnowledgeSpace) return;
    setBusyAction('save-space');
    try {
      await updateKnowledgeSpace(selectedKnowledgeSpace.id, {
        name: spaceName.trim(),
        description: spaceDescription.trim() || null,
      });
    } catch (error) {
      console.error('Failed to update knowledge space:', error);
    } finally {
      setBusyAction('');
    }
  };

  const handleDeleteSpace = () => {
    if (!selectedKnowledgeSpace) return;
    setShowDeleteSpaceConfirm(true);
  };

  const confirmDeleteSpace = async () => {
    setShowDeleteSpaceConfirm(false);
    setBusyAction('delete-space');
    try {
      await deleteKnowledgeSpace(selectedKnowledgeSpace.id);
    } catch (error) {
      console.error('Failed to delete knowledge space:', error);
    } finally {
      setBusyAction('');
    }
  };

  const filteredDocuments = knowledgeSpaceDocuments.filter((document) =>
    document.filename.toLowerCase().includes(sourceFilter.trim().toLowerCase())
  );
  const indexedCount = knowledgeSpaceDocuments.filter((document) => document.indexing_status === 'indexed').length;
  const hasSpaceChanges = selectedKnowledgeSpace && (
    spaceName.trim() !== selectedKnowledgeSpace.name ||
    (spaceDescription.trim() || '') !== (selectedKnowledgeSpace.description || '')
  );
  const isDefaultSpace = selectedKnowledgeSpace?.name === 'My Knowledge';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div ref={panelRef} className="relative m-4 w-full max-w-xl max-h-[calc(100vh-2rem)] overflow-y-auto bg-background border border-border rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{t?.settings || 'Settings'}</h2>
          <button className="p-2 rounded-lg hover:bg-hover" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="text-xs font-semibold mb-2 flex items-center gap-2"><Globe className="w-4 h-4" /> {t?.webSearch || 'Web Search'}</div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={webDefault} onChange={(e) => setWebDefault(e.target.checked)} />
              <span>{t?.defaultOn || 'Enabled by default'}</span>
            </label>
            <p className="text-xs text-text-secondary mt-1">
              {t?.webSearchChina || 'Behind the GFW, external search requires a proxy. Without a proxy, web search will be disabled automatically.'}
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold mb-2 flex items-center gap-2"><FileText className="w-4 h-4" /> {t?.rag || 'RAG'}</div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ragDefault} onChange={(e) => setRagDefault(e.target.checked)} />
              <span>{t?.defaultOn || 'Enabled by default'}</span>
            </label>
            <p className="text-xs text-text-secondary mt-1">
              {t?.ragHint || 'Retrieval improves factual answers using your uploaded documents.'}
            </p>
          </div>

          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-xs font-semibold flex items-center gap-2"><Database className="w-4 h-4" /> {t?.knowledgeSpace || 'Knowledge Space'}</div>
              <button
                type="button"
                onClick={() => fetchSelectedKnowledgeSpace()}
                className="p-1.5 rounded-md hover:bg-hover text-text-secondary"
                aria-label={t?.refresh || 'Refresh'}
                title={t?.refresh || 'Refresh'}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2 mb-3">
              <select
                value={selectedKnowledgeSpaceId || ''}
                onChange={(event) => handleKnowledgeSpaceChange(event.target.value)}
                className="min-w-0 px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary"
              >
                {knowledgeSpaces.map((space) => (
                  <option key={space.id} value={space.id}>{space.name}</option>
                ))}
              </select>
              <form onSubmit={handleCreateSpace} className="flex items-center gap-2">
                <input
                  value={newSpaceName}
                  onChange={(event) => setNewSpaceName(event.target.value)}
                  placeholder={t?.newKnowledgeSpace || 'New space'}
                  className="w-32 px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary"
                />
                <button
                  type="submit"
                  disabled={!newSpaceName.trim() || busyAction === 'create-space'}
                  className="p-2 rounded-lg bg-surface border border-border hover:bg-hover disabled:opacity-40"
                  aria-label={t?.newKnowledgeSpace || 'New knowledge space'}
                  title={t?.newKnowledgeSpace || 'New knowledge space'}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </div>

            {selectedKnowledgeSpace && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-text-secondary" />
                  <input
                    value={spaceName}
                    onChange={(event) => setSpaceName(event.target.value)}
                    disabled={isDefaultSpace}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary disabled:opacity-60"
                  />
                </div>
                <textarea
                  value={spaceDescription}
                  onChange={(event) => setSpaceDescription(event.target.value)}
                  disabled={isDefaultSpace}
                  placeholder={t?.description || 'Description'}
                  className="w-full h-16 px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary resize-none disabled:opacity-60"
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-text-secondary">
                    {knowledgeSpaceDocuments.length} sources, {indexedCount} indexed
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveSpace}
                      disabled={!hasSpaceChanges || isDefaultSpace || busyAction === 'save-space'}
                      className="p-2 rounded-lg bg-surface border border-border hover:bg-hover disabled:opacity-40"
                      aria-label={t?.save || 'Save'}
                      title={t?.save || 'Save'}
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteSpace}
                      disabled={isDefaultSpace || busyAction === 'delete-space'}
                      className="p-2 rounded-lg bg-surface border border-border hover:bg-hover text-red-500 disabled:opacity-40"
                      aria-label={t?.deleteKnowledgeSpace || 'Delete knowledge space'}
                      title={t?.deleteKnowledgeSpace || 'Delete knowledge space'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold mb-2 flex items-center gap-2"><FileText className="w-4 h-4" /> {t?.knowledgeSources || 'Knowledge Sources'}</div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-text-secondary" />
              <input
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                placeholder={t?.searchSources || 'Search sources'}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary"
              />
            </div>
            {knowledgeSpaceDocuments.length === 0 ? (
              <div className="text-xs text-text-secondary">{t?.noKnowledgeSources || 'No documents indexed in the selected space yet.'}</div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-xs text-text-secondary">{t?.noMatches || 'No matching sources.'}</div>
            ) : (
              <ul className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {filteredDocuments.map((document) => (
                  <li key={document.document_id} className="rounded-lg border border-border p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{document.filename}</div>
                        <div className="text-xs text-text-secondary">{document.chunk_count || 0} chunks</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] border ${
                          document.indexing_status === 'indexed'
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                        }`}>
                          {document.indexing_status || 'pending'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(document.document_id)}
                          className="p-1 rounded-md hover:bg-hover text-text-secondary"
                          aria-label={`Delete ${document.filename}`}
                          title={`Delete ${document.filename}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold mb-2 flex items-center gap-2"><Server className="w-4 h-4" /> {t?.llmEndpoints || 'LLM Endpoints'}</div>
            {endpoints.length === 0 ? (
              <div className="text-xs text-text-secondary">{t?.noEndpoints || 'No endpoints detected. Ensure LM Studio is running.'}</div>
            ) : (
              <ul className="text-sm list-disc list-inside space-y-1">
                {endpoints.map((e, i) => (
                  <li key={`${e}-${i}`} className="truncate"><span className="text-text-secondary">[{i+1}]</span> {e}</li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold mb-2 flex items-center gap-2"><Server className="w-4 h-4" /> {t?.modelPolicy || 'Model Policy'}</div>
            <select
              value={modelPolicy}
              onChange={(event) => handleModelPolicyChange(event.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary"
            >
              {Object.entries(modelPolicies).map(([key, policy]) => (
                <option key={key} value={key}>{policy.label}</option>
              ))}
            </select>
            <p className="text-xs text-text-secondary mt-1">
              {modelPolicies[modelPolicy]?.description || 'Controls how the app chooses a model for each chat.'}
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold mb-2">{t?.advancedModel || 'Advanced Model Override'}</div>
            <select
              value={manualModelOverride}
              onChange={(event) => handleManualModelOverrideChange(event.target.value)}
              disabled={availableModels.length === 0}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary"
            >
              <option value="">{t?.automaticModel || 'Automatic from policy'}</option>
              {availableModels.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
            <p className="text-xs text-text-secondary mt-1">
              {manualModelOverride
                ? `${t?.selectedModel || 'Selected'}: ${selectedModel || manualModelOverride}`
                : (t?.automaticModelHint || 'Leave this on automatic unless you need a specific model for testing.')}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-hover" onClick={onClose}>{t?.cancel || 'Cancel'}</button>
          <button className="px-3 py-1.5 text-sm rounded-lg bg-purple-gradient text-white hover:opacity-90" onClick={handleSave}>{t?.save || 'Save'}</button>
        </div>
      </div>
      <ConfirmDialog
        open={!!deleteDocId}
        title="Delete Document"
        message="Delete this document from the current knowledge space?"
        confirmText="Delete"
        cancelText="Cancel"
        danger
        onConfirm={confirmDeleteDocument}
        onCancel={() => setDeleteDocId(null)}
      />
      <ConfirmDialog
        open={showDeleteSpaceConfirm}
        title="Delete Knowledge Space"
        message={selectedKnowledgeSpace ? `Delete "${selectedKnowledgeSpace.name}" and all of its documents? This cannot be undone.` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        danger
        onConfirm={confirmDeleteSpace}
        onCancel={() => setShowDeleteSpaceConfirm(false)}
      />
    </div>
  );
}
