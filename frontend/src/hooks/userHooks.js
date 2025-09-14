import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/services/apiService';
import { keys } from './queryKeys';

// Admin: users list
export function useUsers(options = {}) {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const res = await api.fetchUsers();
      return res.data;
    },
    ...options,
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, newRole }) => {
      await api.updateUserRole(userId, newRole);
      return { userId, newRole };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId) => {
      await api.deleteUser(userId);
      return userId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

// Profile: current user update/delete
export function useUpdateCurrentUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userData) => {
      const res = await api.updateUser(userData);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.auth.currentUser });
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      await api.deleteAccount();
    },
  });
}
