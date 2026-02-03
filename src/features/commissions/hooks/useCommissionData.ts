import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient';
import { Commission, CommissionItem, Article, Supplier, CommissionEvent } from '../../../../types';
import { useAuth } from '../../../../contexts/AuthContext';
import { useUserPreferences } from '../../../../contexts/UserPreferencesContext';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';

export type CommissionTab = 'active' | 'returns' | 'withdrawn' | 'trash' | 'missing';

// Extended type for UI
export type ExtendedCommission = Commission & {
    commission_items?: any[];
    suppliers?: { name: string };
};

export const useCommissionData = (activeTab: CommissionTab) => {
    const { user } = useAuth();
    const { primaryWarehouseId } = useUserPreferences();
    const queryClient = useQueryClient();

    // --- 1. Commissions Query ---
    const { data: commissions = [], isLoading: loading, refetch: refreshCommissions } = useQuery({
        queryKey: ['commissions', activeTab, primaryWarehouseId],
        queryFn: async () => {
            let query = supabase
                .from('commissions')
                .select(`
                    *,
                    suppliers(name),
                    commission_items(
                        id,
                        commission_id,
                        type,
                        amount,
                        custom_name,
                        external_reference,
                        is_backorder,
                        is_picked,
                        notes,
                        article_id,
                        created_at,
                        article:articles(name)
                    )
                `)
                .order('name', { ascending: true });

            if (activeTab === 'active') {
                query = query.is('deleted_at', null);
            } else if (activeTab === 'returns') {
                query = query.is('deleted_at', null);
            } else if (activeTab === 'withdrawn') {
                query = query.is('deleted_at', null);
            } else if (activeTab === 'missing') {
                query = query.is('deleted_at', null).in('status', ['Ready', 'ReturnReady', 'ReturnPending', 'ReturnComplete', 'Missing']);
            } else if (activeTab === 'trash') {
                query = query.not('deleted_at', 'is', null);
            }

            if (primaryWarehouseId) {
                query = query.eq('warehouse_id', primaryWarehouseId);
            }

            const { data, error } = await query;
            if (error) throw error;

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            return (data as ExtendedCommission[]).filter(c => {
                if (activeTab === 'trash' && c.deleted_at) {
                    return new Date(c.deleted_at) > sevenDaysAgo;
                }
                return true;
            });
        },
        enabled: !!primaryWarehouseId,
        placeholderData: keepPreviousData, // Keep old data while fetching new tab
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    // --- 2. Suppliers Query ---
    const { data: suppliers = [] } = useQuery({
        queryKey: ['suppliers'],
        queryFn: async () => {
            const { data: sups } = await supabase.from('suppliers').select('*');
            const { data: usage } = await supabase.from('commissions').select('supplier_id');

            if (sups && usage) {
                const counts: Record<string, number> = {};
                usage.forEach((c: any) => {
                    if (c.supplier_id) counts[c.supplier_id] = (counts[c.supplier_id] || 0) + 1;
                });

                return sups.sort((a, b) => {
                    const countA = counts[a.id] || 0;
                    const countB = counts[b.id] || 0;
                    if (countA !== countB) return countB - countA;
                    return a.name.localeCompare(b.name);
                }) as Supplier[];
            }
            return (sups as Supplier[] || []).sort((a, b) => a.name.localeCompare(b.name));
        },
        staleTime: 1000 * 60 * 30, // 30 minutes
    });

    // --- 3. Tab Counts Query ---
    const { data: tabCounts = { missing: 0, returns: 0 }, refetch: refetchTabCounts } = useQuery({
        queryKey: ['commissionTabCounts', primaryWarehouseId],
        queryFn: async () => {
            if (!primaryWarehouseId) return { missing: 0, returns: 0 };

            // Allow fetching counts even if user is on other tabs
            const p1 = supabase
                .from('commissions')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'Missing')
                .is('deleted_at', null)
                .eq('warehouse_id', primaryWarehouseId);

            const p2 = supabase
                .from('commissions')
                .select('*', { count: 'exact', head: true })
                .in('status', ['ReturnReady', 'ReturnPending'])
                .is('deleted_at', null)
                .eq('warehouse_id', primaryWarehouseId);

            const [r1, r2] = await Promise.all([p1, p2]);

            return {
                missing: r1.count || 0,
                returns: r2.count || 0
            };
        },
        enabled: !!primaryWarehouseId,
        staleTime: 1000 * 30, // 30 seconds
    });

    // --- 4. Articles (Lazy Loaded via Query but exposed similarly) ---
    // We used to have explicit "fetchArticles" trigger. We can keep that pattern or just useQuery.
    // For compatibility, we'll use useQueryQuery but disable it by default or use a trigger.
    // Actually, the previous pattern was: click button -> fetch.
    // We can simulate this with useLazyQuery pattern or just a simple state + fetch if it's very rare.
    // But let's try to be consistent. Let's stick to the manual fetch for this specific heavy one 
    // OR use useQuery enabled: false.
    const [availableArticles, setAvailableArticles] = useState<Article[]>([]);
    const [loadingArticles, setLoadingArticles] = useState(false);

    const fetchArticles = useCallback(async () => {
        if (!primaryWarehouseId || availableArticles.length > 0) return;
        setLoadingArticles(true);
        try {
            const { data } = await supabase
                .from('articles')
                .select('*')
                .eq('warehouse_id', primaryWarehouseId);

            if (data) {
                const mapped = data.map((item: any) => ({ ...item, image: item.image_url }));
                setAvailableArticles(mapped);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingArticles(false);
        }
    }, [primaryWarehouseId, availableArticles.length]);


    // --- 5. History Logs (Global & Print) ---
    const { data: historyLogs = [], isLoading: loadingHistory, refetch: refetchHistory } = useQuery({
        queryKey: ['commissionHistory'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('commission_events')
                .select('*, profiles(full_name)')
                .order('created_at', { ascending: false })
                .limit(100);
            if (error) throw error;
            return data as CommissionEvent[];
        },
        staleTime: 1000 * 60,
    });

    const { data: recentPrintLogs = [], isLoading: loadingPrintHistory, refetch: refetchPrintHistory } = useQuery({
        queryKey: ['printHistory'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('commission_events')
                .select('*, commission:commissions(*), profiles(full_name)')
                .eq('action', 'labels_printed')
                .order('created_at', { ascending: false })
                .limit(15);
            if (error) throw error;
            return data as (CommissionEvent & { commission?: Commission })[];
        },
        staleTime: 1000 * 60,
    });

    // Local History (Specific Commission) - On Demand
    const [localHistoryLogs, setLocalHistoryLogs] = useState<CommissionEvent[]>([]);
    const fetchCommissionSpecificHistory = useCallback(async (commissionId: string) => {
        const { data } = await supabase
            .from('commission_events')
            .select('*, profiles(full_name)')
            .eq('commission_id', commissionId)
            .order('created_at', { ascending: false });
        if (data) setLocalHistoryLogs(data);
    }, []);


    // --- 6. Helper Functions ---
    const fetchCommissionItems = async (commissionId: string) => {
        const { data } = await supabase
            .from('commission_items')
            .select('*, article:articles(*)')
            .eq('commission_id', commissionId);
        return data;
    };

    const logCommissionEvent = async (commId: string, commName: string, action: string, details: string) => {
        if (!user) return;
        await supabase.from('commission_events').insert({
            commission_id: commId,
            commission_name: commName,
            user_id: user.id,
            action: action,
            details: details
        });
        // Invalidate history queries to refresh UI
        queryClient.invalidateQueries({ queryKey: ['commissionHistory'] });
        queryClient.invalidateQueries({ queryKey: ['printHistory'] });
    };

    // --- 7. Realtime ---
    useEffect(() => {
        if (!primaryWarehouseId) return;

        const channel = supabase
            .channel(`commissions-${primaryWarehouseId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'commissions', filter: `warehouse_id=eq.${primaryWarehouseId}` },
                () => {
                    // Smart Invalidation
                    queryClient.invalidateQueries({ queryKey: ['commissions'] });
                    queryClient.invalidateQueries({ queryKey: ['commissionTabCounts'] });
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'commission_items' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['commissions'] });
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [primaryWarehouseId, queryClient]);


    // Helper to manually update commissions state (Optimistic UI support)
    // React Query uses a cache, so "setCommissions" isn't direct. 
    // We can use queryClient.setQueryData, but for compatibility with existing UI that expects setCommissions...
    // We need to expose a setter that updates the cache.
    const setCommissions = useCallback((newDataOrFn: ExtendedCommission[] | ((prev: ExtendedCommission[]) => ExtendedCommission[])) => {
        queryClient.setQueryData(['commissions', activeTab, primaryWarehouseId], (oldData: ExtendedCommission[] | undefined) => {
            if (typeof newDataOrFn === 'function') {
                return newDataOrFn(oldData || []);
            }
            return newDataOrFn;
        });
    }, [queryClient, activeTab, primaryWarehouseId]);


    return {
        commissions,
        setCommissions,
        suppliers,
        availableArticles,
        fetchArticles,
        loadingArticles,
        loading,
        tabCounts,
        historyLogs,
        loadingHistory,
        fetchHistory: refetchHistory,
        localHistoryLogs,
        fetchCommissionSpecificHistory,
        recentPrintLogs,
        loadingPrintHistory,
        fetchPrintHistory: refetchPrintHistory,
        fetchCommissionItems,
        logCommissionEvent,
        refreshCommissions
    };
};
