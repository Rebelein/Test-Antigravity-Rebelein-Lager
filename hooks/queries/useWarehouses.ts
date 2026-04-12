import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import { Warehouse } from '../../types';

export const useWarehouses = () => useQuery({
  queryKey: ['warehouses'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .order('name');
    if (error) throw error;
    return (data || []) as Warehouse[];
  },
  staleTime: 5 * 60 * 1000,
});
