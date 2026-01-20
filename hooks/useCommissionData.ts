
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Commission, CommissionItem, Article, Supplier, CommissionEvent } from '../types';
import { useAuth } from '../contexts/AuthContext';

export type CommissionTab = 'active' | 'returns' | 'withdrawn' | 'trash' | 'missing';

// Extended type for UI
export type ExtendedCommission = Commission & {
    commission_items?: any[];
    suppliers?: { name: string };
};

export const useCommissionData = (activeTab: CommissionTab) => {
    const { user, profile } = useAuth();
    const [commissions, setCommissions] = useState<ExtendedCommission[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [availableArticles, setAvailableArticles] = useState<Article[]>([]);

    // History states
    const [historyLogs, setHistoryLogs] = useState<CommissionEvent[]>([]);
    const [localHistoryLogs, setLocalHistoryLogs] = useState<CommissionEvent[]>([]);
    const [recentPrintLogs, setRecentPrintLogs] = useState<(CommissionEvent & { commission?: Commission })[]>([]);

    // Loading states
    const [loading, setLoading] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingPrintHistory, setLoadingPrintHistory] = useState(false);

    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    // --- FETCH COMMISSIONS ---
    const fetchCommissions = useCallback(async () => {
        // Optimistic loading only on first load or tab switch
        // if (commissions.length === 0) setLoading(true); 
        // Better: let component handle loading state for initial render, don't flicker on refresh

        try {
            let query = supabase
                .from('commissions')
                .select('*, suppliers(name), commission_items(*, article:articles(name))')
                .order('name', { ascending: true });

            if (activeTab === 'active') {
                query = query.is('deleted_at', null);
            } else if (activeTab === 'returns') {
                query = query.is('deleted_at', null);
            } else if (activeTab === 'withdrawn') {
                query = query.is('deleted_at', null);
            } else if (activeTab === 'missing') {
                // Load all candidates for the audit: Ready, ReturnReady, ReturnPending
                query = query.is('deleted_at', null).in('status', ['Ready', 'ReturnReady', 'ReturnPending', 'ReturnComplete', 'Missing']);
            } else if (activeTab === 'trash') {
                query = query.not('deleted_at', 'is', null);
            }

            if (profile?.primary_warehouse_id) {
                query = query.eq('warehouse_id', profile.primary_warehouse_id);
            }

            const { data, error } = await query;
            if (error) throw error;

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const filteredData = (data as ExtendedCommission[]).filter(c => {
                if (activeTab === 'trash' && c.deleted_at) {
                    return new Date(c.deleted_at) > sevenDaysAgo;
                }
                return true;
            });

            if (isMounted.current) setCommissions(filteredData);
        } catch (err) {
            console.error("Error fetching commissions:", err);
        } finally {
            if (isMounted.current) setLoading(false);
        }
    }, [activeTab, profile?.primary_warehouse_id]);

    // --- FETCH SUPPLIERS ---
    const fetchSuppliers = useCallback(async () => {
        try {
            const { data: sups } = await supabase.from('suppliers').select('*');
            const { data: usage } = await supabase.from('commissions').select('supplier_id');

            if (sups && usage) {
                const counts: Record<string, number> = {};
                usage.forEach((c: any) => {
                    if (c.supplier_id) counts[c.supplier_id] = (counts[c.supplier_id] || 0) + 1;
                });

                const sorted = sups.sort((a, b) => {
                    const countA = counts[a.id] || 0;
                    const countB = counts[b.id] || 0;
                    if (countA !== countB) return countB - countA;
                    return a.name.localeCompare(b.name);
                });
                if (isMounted.current) setSuppliers(sorted);
            } else if (sups) {
                if (isMounted.current) setSuppliers(sups.sort((a, b) => a.name.localeCompare(b.name)));
            }
        } catch (e) {
            console.error(e);
        }
    }, []);

    // --- FETCH ARTICLES ---
    const fetchArticles = useCallback(async () => {
        if (!profile?.primary_warehouse_id) return;
        const { data } = await supabase
            .from('articles')
            .select('*')
            .eq('warehouse_id', profile.primary_warehouse_id);

        if (data && isMounted.current) {
            const mapped = data.map((item: any) => ({
                ...item,
                image: item.image_url
            }));
            setAvailableArticles(mapped);
        }
    }, [profile?.primary_warehouse_id]);

    // --- FETCH HISTORY ---
    const fetchHistory = useCallback(async () => {
        setLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('commission_events')
                .select('*, profiles(full_name)')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            if (isMounted.current) setHistoryLogs(data || []);
        } catch (err) {
            console.error("History fetch failed", err);
        } finally {
            if (isMounted.current) setLoadingHistory(false);
        }
    }, []);

    const fetchCommissionSpecificHistory = useCallback(async (commissionId: string) => {
        try {
            const { data, error } = await supabase
                .from('commission_events')
                .select('*, profiles(full_name)')
                .eq('commission_id', commissionId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (isMounted.current) setLocalHistoryLogs(data || []);
        } catch (err) {
            console.error("Local history fetch failed", err);
        }
    }, []);

    const fetchPrintHistory = useCallback(async () => {
        setLoadingPrintHistory(true);
        try {
            const { data, error } = await supabase
                .from('commission_events')
                .select('*, commission:commissions(*), profiles(full_name)')
                .eq('action', 'labels_printed')
                .order('created_at', { ascending: false })
                .limit(15);

            if (error) throw error;
            if (isMounted.current) setRecentPrintLogs(data || []);
        } catch (err) {
            console.error("Print History fetch failed", err);
        } finally {
            if (isMounted.current) setLoadingPrintHistory(false);
        }
    }, []);

    const fetchCommissionItems = async (commissionId: string) => {
        const { data } = await supabase
            .from('commission_items')
            .select('*, article:articles(*)')
            .eq('commission_id', commissionId);

        return data;
    };

    // --- LOGGING HELPER ---
    const logCommissionEvent = async (commId: string, commName: string, action: string, details: string) => {
        if (!user) return;
        try {
            await supabase.from('commission_events').insert({
                commission_id: commId,
                commission_name: commName,
                user_id: user.id,
                action: action,
                details: details
            });
        } catch (err) {
            console.error("Failed to log event", err);
        }
    };

    // --- FETCH TAB COUNTS ---
    const [tabCounts, setTabCounts] = useState<{ missing: number, returns: number }>({ missing: 0, returns: 0 });

    const fetchTabCounts = useCallback(async () => {
        try {
            // Missing Count
            const { count: missingCount } = await supabase
                .from('commissions')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'Missing')
                .is('deleted_at', null);

            // Returns Count
            const { count: returnsCount } = await supabase
                .from('commissions')
                .select('*', { count: 'exact', head: true })
                .in('status', ['ReturnReady', 'ReturnPending'])
                .is('deleted_at', null);

            if (isMounted.current) {
                setTabCounts({
                    missing: missingCount || 0,
                    returns: returnsCount || 0
                });
            }
        } catch (e) {
            console.error("Failed to fetch counts", e);
        }
    }, []);

    // Initial Load
    useEffect(() => {
        setLoading(true);
        Promise.all([
            fetchCommissions(),
            fetchSuppliers(),
            fetchArticles(),
            fetchTabCounts()
        ]).finally(() => setLoading(false));
    }, [fetchCommissions, fetchSuppliers, fetchArticles, fetchTabCounts]);

    // Realtime Subscription
    useEffect(() => {
        if (!profile?.primary_warehouse_id) return;

        const channel = supabase
            .channel(`commissions-${profile.primary_warehouse_id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'commissions', filter: `warehouse_id=eq.${profile.primary_warehouse_id}` },
                () => {
                    fetchCommissions();
                    fetchTabCounts();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'commission_items' },
                // Note: filtering commission_items by warehouse via join is not supported in realtime. 
                // We rely on the fact that usually commission items update alongside commission or we accept some extra traffic here.
                // Ideally we would filter by commission_id but we want ANY commission change in this warehouse.
                // Optimization: Maybe only refetch if the commission_id belongs to a commission we have loaded?
                // For now, simple refetch is safer to ensure consistency.
                () => {
                    fetchCommissions();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchCommissions, fetchTabCounts, profile?.primary_warehouse_id]);

    return {
        commissions,
        setCommissions, // Exposed for optimistic updates
        suppliers,
        availableArticles,
        loading,
        tabCounts, // Exposed for UI
        // History
        historyLogs,
        loadingHistory,
        fetchHistory,
        localHistoryLogs,
        fetchCommissionSpecificHistory,
        // Print History
        recentPrintLogs,
        loadingPrintHistory,
        fetchPrintHistory,
        // Utils
        fetchCommissionItems,
        logCommissionEvent,
        refreshCommissions: fetchCommissions
    };
};
