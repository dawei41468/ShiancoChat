import { useQuery } from '@tanstack/react-query';
import { keys } from './queryKeys';
import { getCurrentUser } from '@/services/apiService';

export function useCurrentUser(options = {}) {
  return useQuery({
    queryKey: keys.auth.currentUser,
    queryFn: async () => {
      const res = await getCurrentUser();
      return res.data;
    },
    staleTime: 1000 * 30,
    ...options,
  });
}
