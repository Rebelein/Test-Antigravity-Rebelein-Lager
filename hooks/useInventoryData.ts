
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Article, Warehouse, Supplier } from '../types';
import { useAuth } from '../contexts/AuthContext';

export const useInventoryData = (viewMode: 'primary' | 'secondary') => {
    const { profile, loading: authLoading, updateWarehousePreference } = useAuth();

    const [articles, setArticles] = useState<Article[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);

    // History State
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
        onOrderDate: item.on_order_date
    });

    const fetchWarehouses = async () => {
        const { data } = await supabase.from('warehouses').select('*').order('name');
        if (data) {
            setWarehouses(data.map((w: any) => ({
                id: w.id,
                name: w.name,
                type: w.type,
                location: w.location
            })));
        }
    };

    const fetchSuppliers = async () => {
        const { data } = await supabase.from('suppliers').select('*').order('name');
        if (data) {
            setSuppliers(data);
        }
    };

    const fetchArticles = async () => {
        try {
            setLoading(true);
            const activeWarehouseId = viewMode === 'primary'
                ? profile?.primary_warehouse_id
                : profile?.secondary_warehouse_id;

            let query = supabase.from('articles').select('*');

            if (activeWarehouseId) {
                query = query.eq('warehouse_id', activeWarehouseId);
            } else {
                query = query.eq('id', '00000000-0000-0000-0000-000000000000');
            }

            const { data, error } = await query;
            if (error) { console.error('Error fetching articles:', error); return; }
            if (data) setArticles(data.map(mapArticleFromDB));
        } catch (error) { console.error('Unexpected error:', error); } finally { setLoading(false); }
    };

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

    // Initial fetch
    useEffect(() => {
        if (!authLoading) {
            fetchWarehouses();
            fetchSuppliers();
        }
    }, [authLoading]);

    // Fetch on view change
    useEffect(() => {
        if (!authLoading) {
            fetchArticles();
        }
    }, [authLoading, viewMode, profile?.primary_warehouse_id, profile?.secondary_warehouse_id]);

    // Realtime Subscription
    useEffect(() => {
        const channel = supabase
            .channel('articles-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'articles' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setArticles((prev) => [...prev, mapArticleFromDB(payload.new)]);
                    } else if (payload.eventType === 'UPDATE') {
                        setArticles((prev) => prev.map((a) => a.id === payload.new.id ? mapArticleFromDB(payload.new) : a));
                    } else if (payload.eventType === 'DELETE') {
                        setArticles((prev) => prev.filter((a) => a.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);


    const updateLocalArticle = (id: string, updates: Partial<Article>) => {
        setArticles(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    };

    const removeLocalArticle = (id: string) => {
        setArticles(prev => prev.filter(a => a.id !== id));
    };

    return {
        articles,
        warehouses,
        suppliers,
        loading,
        articleHistory,
        historyLoading,
        fetchHistory,
        requestRefresh: fetchArticles,
        updateLocalArticle,
        removeLocalArticle
    };
};
