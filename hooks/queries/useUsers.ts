import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';

import { UserProfile } from '../../types';

export const useUsers = () => useQuery({
  queryKey: ['users'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');
    if (error) throw error;
    return (data || []) as UserProfile[];
  },
  staleTime: 5 * 60 * 1000,
});
