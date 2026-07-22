import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient';
import { Machine, MachineStatus, Commission, Key } from '../../../../types';
import { toast } from 'sonner';

export interface AppEvent {
    id: string;
    type: 'machine' | 'commission' | 'order' | 'key';
    user_name: string;
    action: string;
    details: string;
    created_at: string;
    entity_name: string;
}

export const useDashboardData = () => {
    const [isLoading, setIsLoading] = useState(true);

    const [rentedMachines, setRentedMachines] = useState<Machine[]>([]);
    const [repairMachines, setRepairMachines] = useState<Machine[]>([]);
    const [rentedKeys, setRentedKeys] = useState<Key[]>([]);

    const [openCommissions, setOpenCommissions] = useState<Commission[]>([]);
    const [backlogCommissions, setBacklogCommissions] = useState<Commission[]>([]);
    const [returnCommissions, setReturnCommissions] = useState<Commission[]>([]);
    
    const [recentEvents, setRecentEvents] = useState<AppEvent[]>([]);

    const fetchMachinesData = useCallback(async () => {
        try {
            const { data: machines, error } = await supabase
                .from('machines')
                .select('*, profiles:assigned_to(full_name)')
                .in('status', ['Rented', 'In Repair']);

            if (machines) {
                const mappedMachines = machines.map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    status: m.status,
                    assignedTo: m.assigned_to,
                    externalBorrower: m.external_borrower,
                    nextMaintenance: m.next_maintenance,
                    image: m.image_url,
                    notes: m.notes,
                    profiles: m.profiles
                }));

                setRentedMachines(mappedMachines.filter((m: Machine) => m.status === MachineStatus.RENTED));
                setRepairMachines(mappedMachines.filter((m: Machine) => m.status === MachineStatus.REPAIR));
            }
        } catch (error: any) {
            console.error("Error fetching machines:", error);
            toast.error("Fehler beim Laden der Maschinen: " + (error.message || error));
        }
    }, []);

    const fetchKeysData = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('keys')
                .select('*')
                .eq('status', 'InUse');

            if (error) throw error;
            setRentedKeys((data as any) || []);
        } catch (error) {
            console.error("Error fetching keys:", error);
        }
    }, []);

    const fetchCommissionsData = useCallback(async () => {
        try {
            const { data: comms } = await supabase
                .from('commissions')
                .select('*, commission_items(is_backorder, notes)')
                .is('deleted_at', null)
                .in('status', ['Draft', 'Preparing', 'Ready', 'ReturnPending', 'ReturnReady', 'Missing']);

            if (comms) {
                const backlog = comms.filter((c: any) => c.commission_items?.some((i: any) => i.is_backorder));
                setBacklogCommissions(backlog);

                const returns = comms.filter((c: Commission) => c.status === 'ReturnPending' || c.status === 'ReturnReady');
                returns.sort((a: Commission, b: Commission) => {
                    if (a.status === b.status) return a.name.localeCompare(b.name);
                    return a.status === 'ReturnReady' ? -1 : 1;
                });
                setReturnCommissions(returns);

                const open = comms.filter((c: any) => {
                    const isBacklog = c.commission_items?.some((i: any) => i.is_backorder);
                    if (isBacklog) return false;

                    const hasFlag = c.is_price_inquiry || c.delivery_date_unknown;
                    const isReadyToBook = c.status === 'Ready' && !c.is_processed;
                    return hasFlag || isReadyToBook;
                });
                
                open.sort((a: any, b: any) => {
                    const readyA = a.status === 'Ready' && !a.is_processed ? 1 : 0;
                    const readyB = b.status === 'Ready' && !b.is_processed ? 1 : 0;
                    if (readyA !== readyB) return readyB - readyA;

                    const weightA = (a.is_price_inquiry ? 2 : 0) + (a.delivery_date_unknown ? 1 : 0);
                    const weightB = (b.is_price_inquiry ? 2 : 0) + (b.delivery_date_unknown ? 1 : 0);
                    return weightB - weightA;
                });
                setOpenCommissions(open);
            }
        } catch (error: any) {
            console.error("Error fetching commissions:", error);
            toast.error("Fehler beim Laden der Kommissionen: " + (error.message || error));
        }
    }, []);

    const fetchRecentEvents = useCallback(async () => {
        try {
            const { data: machineEvents } = await supabase
                .from('machine_events')
                .select('id, action, details, created_at, profiles(full_name), machines(name)')
                .order('created_at', { ascending: false })
                .limit(10);

            const { data: commissionEvents } = await supabase
                .from('commission_events')
                .select('id, action, details, created_at, profiles(full_name), commission_name')
                .order('created_at', { ascending: false })
                .limit(10);

            const { data: orderEvents } = await supabase
                .from('order_events')
                .select('id, action, details, created_at, profiles(full_name), orders(supplier, commission_number)')
                .order('created_at', { ascending: false })
                .limit(10);

            const { data: keyEvents } = await supabase
                .from('key_events')
                .select('id, action, details, created_at, profiles(full_name), keys(name)')
                .order('created_at', { ascending: false })
                .limit(10);

            const events: AppEvent[] = [];

            if (machineEvents) {
                events.push(...machineEvents.map((e: any) => ({
                    id: e.id,
                    type: 'machine' as const,
                    user_name: e.profiles?.full_name || 'Unbekannt',
                    action: e.action,
                    details: e.details,
                    created_at: e.created_at,
                    entity_name: e.machines?.name || 'Unbekanntes Gerät'
                })));
            }

            if (commissionEvents) {
                events.push(...commissionEvents.map((e: any) => ({
                    id: e.id,
                    type: 'commission' as const,
                    user_name: e.profiles?.full_name || 'Unbekannt',
                    action: e.action,
                    details: e.details,
                    created_at: e.created_at,
                    entity_name: e.commission_name || 'Unbekannte Kommission'
                })));
            }

            if (orderEvents) {
                events.push(...orderEvents.map((e: any) => ({
                    id: e.id,
                    type: 'order' as const,
                    user_name: e.profiles?.full_name || 'System',
                    action: e.action,
                    details: e.details,
                    created_at: e.created_at,
                    entity_name: e.orders ? `${e.orders.supplier}${e.orders.commission_number ? ` (${e.orders.commission_number})` : ''}` : 'Unbekannte Bestellung'
                })));
            }

            if (keyEvents) {
                events.push(...keyEvents.map((e: any) => ({
                    id: e.id,
                    type: 'key' as const,
                    user_name: e.profiles?.full_name || 'Unbekannt',
                    action: e.action,
                    details: e.details,
                    created_at: e.created_at,
                    entity_name: e.keys?.name || 'Unbekannter Schlüssel'
                })));
            }

            events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setRecentEvents(events.slice(0, 15));
        } catch (error) {
            console.error("Error fetching events:", error);
        }
    }, []);

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        await Promise.all([
            fetchMachinesData(),
            fetchCommissionsData(),
            fetchRecentEvents(),
            fetchKeysData()
        ]);
        setIsLoading(false);
    }, [fetchMachinesData, fetchCommissionsData, fetchRecentEvents, fetchKeysData]);

    useEffect(() => {
        fetchAllData();

        const channel = supabase
            .channel('dashboard_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'machines' }, fetchMachinesData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'keys' }, fetchKeysData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'commissions' }, fetchCommissionsData)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'machine_events' }, fetchRecentEvents)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'commission_events' }, fetchRecentEvents)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_events' }, fetchRecentEvents)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'key_events' }, fetchRecentEvents)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchAllData, fetchMachinesData, fetchKeysData, fetchCommissionsData, fetchRecentEvents]);

    return {
        isLoading,
        rentedMachines,
        repairMachines,
        rentedKeys,
        openCommissions,
        backlogCommissions,
        returnCommissions,
        recentEvents,
        fetchAllData,
        fetchCommissionsData,
        fetchMachinesData,
        fetchKeysData,
        fetchRecentEvents
    };
};
