import React, { useEffect, useState } from 'react';
import { X, Globe, FileText, Server } from 'lucide-react';
import * as apiService from '@/services/apiService';
import { useLanguage } from '@/LanguageContext';

export default function SettingsSheet({ open, onClose }) {
  const { t } = useLanguage();
  const [endpoints, setEndpoints] = useState([]);
  const [webDefault, setWebDefault] = useState(true);
  const [ragDefault, setRagDefault] = useState(true);

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

    return () => { mounted = false; };
  }, [open]);

  const handleSave = () => {
    localStorage.setItem('default_web_search', String(webDefault));
    localStorage.setItem('default_rag', String(ragDefault));
    onClose?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative m-4 w-full max-w-md bg-background border border-border rounded-xl shadow-xl">
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
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-hover" onClick={onClose}>{t?.cancel || 'Cancel'}</button>
          <button className="px-3 py-1.5 text-sm rounded-lg bg-purple-gradient text-white hover:opacity-90" onClick={handleSave}>{t?.save || 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
