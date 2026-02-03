import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient';
import { Article, Warehouse, Supplier } from '../../../../types';
import { useAuth } from '../../../../contexts/AuthContext';
import { useUserPreferences } from '../../../../contexts/UserPreferencesContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const useInventoryData = (viewMode: 'primary' | 'secondary') => {
    const { loading: authLoading } = useAuth();
    const { primaryWarehouseId, secondaryWarehouseId } = useUserPreferences();
    const queryClient = useQueryClient();

    const activeWarehouseId = viewMode === 'primary'
        ? primaryWarehouseId
        : secondaryWarehouseId;

    // History State (Keep manual for now as it is on-demand)
    const [articleHistory, setArticleHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const mapArticleFromDB = (item: any): Article => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        manufacturerSkus: item.manufacturer_skus || [],
        stock: item.stock,
        targetStock: item.target_stock || item.min_stock || 0,
        location: item.location,
        category: item.category,
        price: item.price,
        supplier: item.supplier,
        warehouseId: item.warehouse_id,
        ean: item.ean,
        supplierSku: item.supplier_sku,
        productUrl: item.product_url,
        image: item.image_url,
        onOrderDate: item.on_order_date,
        lastCountedAt: item.last_counted_at
    });

    // 1. Fetch Warehouses
    const { data: warehouses = [] } = useQuery({
        queryKey: ['warehouses'],
        queryFn: async () => {
            const { data } = await supabase.from('warehouses').select('*').order('name');
            return data?.map((w: any) => ({
                id: w.id,
                name: w.name,
                type: w.type,
                location: w.location
            })) as Warehouse[] || [];
        },
        enabled: !authLoading,
        staleTime: 1000 * 60 * 60, // 1 hour
    });

    // 2. Fetch Suppliers
    const { data: suppliers = [] } = useQuery({
        queryKey: ['suppliers'],
        queryFn: async () => {
            const { data } = await supabase.from('suppliers').select('*').order('name');
            return data as Supplier[] || [];
        },
        enabled: !authLoading,
        staleTime: 1000 * 60 * 60, // 1 hour
    });

    // 3. Fetch Articles (Main Data)
    const { data: articles = [], isLoading: loading, refetch } = useQuery({
        queryKey: ['articles', activeWarehouseId],
        queryFn: async () => {
            if (!activeWarehouseId) return [];

            // NOTE: In future we can add pagination here
            const { data, error } = await supabase
                .from('articles')
                .select('*')
                .eq('warehouse_id', activeWarehouseId);

            if (error) throw error;
            return data.map(mapArticleFromDB);
        },
        enabled: !!activeWarehouseId && !authLoading,
        staleTime: 1000 * 60 * 5, // 5 minutes fresh
    });

    const fetchHistory = async (articleId: string) => {
        setHistoryLoading(true);
        try {
            const { data, error } = await supabase
                .from('stock_movements')
                .select('*, profiles:user_id (full_name)')
                .eq('article_id', articleId)
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) throw error;
            setArticleHistory(data as any[]);
        } catch (err) { console.error("Error fetching history:", err); } finally { setHistoryLoading(false); }
    };

    // Realtime Subscription
    useEffect(() => {
        if (!activeWarehouseId) return;

        const channel = supabase
            .channel(`articles-${activeWarehouseId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'articles', filter: `warehouse_id=eq.${activeWarehouseId}` },
                (payload) => {
                    queryClient.setQueryData(['articles', activeWarehouseId], (oldData: Article[] | undefined) => {
                        if (!oldData) return [];

                        if (payload.eventType === 'INSERT') {
                            return [...oldData, mapArticleFromDB(payload.new)];
                        } else if (payload.eventType === 'UPDATE') {
                            return oldData.map((a) => a.id === payload.new.id ? mapArticleFromDB(payload.new) : a);
                        } else if (payload.eventType === 'DELETE') {
                            return oldData.filter((a) => a.id !== payload.old.id);
                        }
                        return oldData;
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeWarehouseId, queryClient]);


    const updateLocalArticle = (id: string, updates: Partial<Article>) => {
        queryClient.setQueryData(['articles', activeWarehouseId], (oldData: Article[] | undefined) => {
            if (!oldData) return [];
            return oldData.map(a => a.id === id ? { ...a, ...updates } : a);
        });
    };

    const removeLocalArticle = (id: string) => {
        queryClient.setQueryData(['articles', activeWarehouseId], (oldData: Article[] | undefined) => {
            if (!oldData) return [];
            return oldData.filter(a => a.id !== id);
        });
    };

    return {
        articles,
        warehouses,
        suppliers,
        loading,
        articleHistory,
        historyLoading,
        fetchHistory,
        requestRefresh: refetch,
        updateLocalArticle,
        removeLocalArticle
    };
};
