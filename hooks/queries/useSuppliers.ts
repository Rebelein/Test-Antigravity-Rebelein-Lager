import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import { Supplier } from '../../types';

export const useSuppliers = () => useQuery({
  queryKey: ['suppliers'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name');
    if (error) throw error;
    return (data || []) as Supplier[];
  },
  staleTime: 5 * 60 * 1000,
});
