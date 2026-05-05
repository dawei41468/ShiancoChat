import { useState, useCallback } from 'react';
import * as apiService from '@/services/apiService';

export function useKnowledgeSpaces({ user, showToast }) {
  const [knowledgeSpaces, setKnowledgeSpaces] = useState([]);
  const [selectedKnowledgeSpaceId, setSelectedKnowledgeSpaceId] = useState(() => localStorage.getItem('selected_knowledge_space_id'));
  const [knowledgeSpaceDocuments, setKnowledgeSpaceDocuments] = useState([]);

  const selectedKnowledgeSpace = knowledgeSpaces.find(space => space.id === selectedKnowledgeSpaceId) || null;

  const fetchKnowledgeSpaces = useCallback(async (preferredSpaceId = null) => {
    if (!user) {
      setKnowledgeSpaces([]);
      setSelectedKnowledgeSpaceId(null);
      localStorage.removeItem('selected_knowledge_space_id');
      return [];
    }

    try {
      const response = await apiService.fetchKnowledgeSpaces();
      const spaces = response.data || [];
      setKnowledgeSpaces(spaces);
      const currentId = preferredSpaceId || selectedKnowledgeSpaceId;
      const nextId = spaces.some(space => space.id === currentId)
        ? currentId
        : (spaces[0]?.id || null);
      setSelectedKnowledgeSpaceId(nextId);
      if (nextId) {
        localStorage.setItem('selected_knowledge_space_id', nextId);
      } else {
        localStorage.removeItem('selected_knowledge_space_id');
      }
      return spaces;
    } catch (error) {
      console.error('Error fetching knowledge spaces:', error);
      showToast('Failed to load knowledge spaces', 'error');
      return [];
    }
  }, [selectedKnowledgeSpaceId, showToast, user]);

  const fetchSelectedKnowledgeSpace = useCallback(async (spaceId = selectedKnowledgeSpaceId) => {
    if (!user || !spaceId) {
      setKnowledgeSpaceDocuments([]);
      return null;
    }

    try {
      const response = await apiService.fetchKnowledgeSpace(spaceId);
      setKnowledgeSpaceDocuments(response.data?.documents || []);
      return response.data;
    } catch (error) {
      console.error('Error fetching selected knowledge space:', error);
      setKnowledgeSpaceDocuments([]);
      return null;
    }
  }, [selectedKnowledgeSpaceId, user]);

  const handleKnowledgeSpaceChange = (spaceId) => {
    setSelectedKnowledgeSpaceId(spaceId);
    setKnowledgeSpaceDocuments([]);
    if (spaceId) {
      localStorage.setItem('selected_knowledge_space_id', spaceId);
    } else {
      localStorage.removeItem('selected_knowledge_space_id');
    }
  };

  const createKnowledgeSpace = async (spaceData) => {
    const response = await apiService.createKnowledgeSpace(spaceData);
    const createdSpace = response.data;
    setKnowledgeSpaces(prev => [createdSpace, ...prev]);
    handleKnowledgeSpaceChange(createdSpace.id);
    showToast(`Created knowledge space: ${createdSpace.name}`, 'success');
    return createdSpace;
  };

  const updateKnowledgeSpace = async (spaceId, spaceData) => {
    const response = await apiService.updateKnowledgeSpace(spaceId, spaceData);
    const updatedSpace = response.data;
    setKnowledgeSpaces(prev => prev.map(space => (space.id === spaceId ? updatedSpace : space)));
    if (selectedKnowledgeSpaceId === spaceId) {
      await fetchSelectedKnowledgeSpace(spaceId);
    }
    showToast(`Updated knowledge space: ${updatedSpace.name}`, 'success');
    return updatedSpace;
  };

  const deleteKnowledgeSpace = async (spaceId) => {
    const deletedSpace = knowledgeSpaces.find(space => space.id === spaceId);
    await apiService.deleteKnowledgeSpace(spaceId);
    const spaces = await fetchKnowledgeSpaces(spaceId);
    if (selectedKnowledgeSpaceId === spaceId) {
      const nextSpaceId = spaces.find(space => space.id !== spaceId)?.id || null;
      handleKnowledgeSpaceChange(nextSpaceId);
      if (nextSpaceId) {
        await fetchSelectedKnowledgeSpace(nextSpaceId);
      } else {
        setKnowledgeSpaceDocuments([]);
      }
    }
    showToast(`Deleted knowledge space: ${deletedSpace?.name || 'space'}`, 'success');
  };

  return {
    knowledgeSpaces,
    setKnowledgeSpaces,
    selectedKnowledgeSpace,
    selectedKnowledgeSpaceId,
    setSelectedKnowledgeSpaceId,
    knowledgeSpaceDocuments,
    setKnowledgeSpaceDocuments,
    fetchKnowledgeSpaces,
    fetchSelectedKnowledgeSpace,
    handleKnowledgeSpaceChange,
    createKnowledgeSpace,
    updateKnowledgeSpace,
    deleteKnowledgeSpace,
  };
}
