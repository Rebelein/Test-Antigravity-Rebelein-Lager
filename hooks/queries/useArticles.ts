import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import { Article } from '../../types';

export const useArticles = (warehouseId?: string) => useQuery({
  queryKey: ['articles', warehouseId],
  queryFn: async () => {
    let query = supabase.from('articles').select('*').order('name');
    
    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    // Map to Article type properly if needed based on snake_case -> camelCase mappings
    return (data || []).map(item => ({
        ...item,
        warehouseId: item.warehouse_id,
        imageUrl: item.image_url,
        manufacturerSkus: item.manufacturer_skus,
        productUrl: item.product_url,
        targetStock: item.target_stock,
        supplierSku: item.supplier_sku,
        createdAt: item.created_at,
        updatedAt: item.updated_at
    })) as Article[];
  },
  staleTime: 5 * 60 * 1000,
});
