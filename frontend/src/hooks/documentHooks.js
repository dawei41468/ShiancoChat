import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import * as api from '@/services/apiService';
import { keys } from './queryKeys';

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData) => {
      const res = await api.uploadDocument(formData);
      return res.data;
    },
    onSuccess: (doc) => {
      // Invalidate any future document lists if added
      qc.invalidateQueries({ queryKey: keys.documents.list });
      if (doc?.document_id) {
        qc.invalidateQueries({ queryKey: keys.documents.item(doc.document_id) });
      }
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (documentId) => {
      await api.deleteDocument(documentId);
      return documentId;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: keys.documents.list });
      if (id) qc.invalidateQueries({ queryKey: keys.documents.item(id) });
    },
  });
}

export function useFetchDocument(documentId, options = {}) {
  return useQuery({
    queryKey: keys.documents.item(documentId),
    queryFn: async () => {
      const res = await api.fetchDocument(documentId);
      return res.data;
    },
    enabled: Boolean(documentId),
    ...options,
  });
}

export function useSaveDocumentRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (documentData) => {
      const res = await api.saveDocument(documentData);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.documents.list });
    },
  });
}
