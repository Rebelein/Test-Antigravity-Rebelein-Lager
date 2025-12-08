
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GlassCard, StatusBadge, Button, GlassModal } from '../components/UIComponents';
import { AlertTriangle, Wrench, User, CheckCircle2, FileText, ArrowRight, Grid, Database, X, Play, RefreshCw, Check, Copy, Settings, Factory, Warehouse, Tag, Maximize2, Minimize2, PhoneCall, StickyNote, Save, Undo2, Library, Plus, MessageSquare, Monitor, Smartphone, ShoppingCart, LayoutTemplate } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { initializeDatabase, MANUAL_SETUP_SQL } from '../utils/dbInit';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { CommissionDetailModal } from '../components/CommissionDetailModal';
import { supabase } from '../supabaseClient';
import { Machine, MachineStatus, Commission, UserProfile } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface AppEvent {
    id: string;
    type: 'machine' | 'commission' | 'order';
    user_name: string;
    action: string;
    details: string;
    created_at: string;
    entity_name: string; // NEW: To show WHICH item was affected
}

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { viewMode, toggleViewMode } = useTheme();

    const [isLoading, setIsLoading] = useState(true);

    // Data State
    const [rentedMachines, setRentedMachines] = useState<Machine[]>([]);
    const [repairMachines, setRepairMachines] = useState<Machine[]>([]);

    const [draftCommissions, setDraftCommissions] = useState<Commission[]>([]);
    const [readyCommissions, setReadyCommissions] = useState<Commission[]>([]);
    const [returnCommissions, setReturnCommissions] = useState<Commission[]>([]); // New State for Returns
    const [recentEvents, setRecentEvents] = useState<AppEvent[]>([]);

    // Utility States (Modals & UI)
    const [showAppDrawer, setShowAppDrawer] = useState(false);
    const [showSqlModal, setShowSqlModal] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [isUpdatingSchema, setIsUpdatingSchema] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);
    const [sqlCopied, setSqlCopied] = useState(false);

    // --- NEW FEATURE STATES ---
    const [isCommissionTileFullscreen, setIsCommissionTileFullscreen] = useState(false);
    const [processingCommission, setProcessingCommission] = useState<Commission | null>(null);
    const [viewingCommission, setViewingCommission] = useState<Commission | null>(null);
    const [officeNoteInput, setOfficeNoteInput] = useState('');
    const [isOfficeProcessed, setIsOfficeProcessed] = useState(false);
    const [isSavingProcess, setIsSavingProcess] = useState(false);
    const [mobileTab, setMobileTab] = useState<'draft' | 'ready' | 'returns'>('draft');

    // --- LAYOUT STATE ---
    const defaultLayouts = {
        lg: [
            { i: 'machines', x: 0, y: 0, w: 1, h: 4 },
            { i: 'commissions', x: 1, y: 0, w: 1, h: 4 },
            { i: 'events', x: 0, y: 4, w: 2, h: 3 }
        ],
        md: [
            { i: 'machines', x: 0, y: 0, w: 1, h: 4 },
            { i: 'commissions', x: 1, y: 0, w: 1, h: 4 },
            { i: 'events', x: 0, y: 4, w: 2, h: 3 }
        ],
        sm: [
            { i: 'machines', x: 0, y: 0, w: 1, h: 4 },
            { i: 'commissions', x: 0, y: 4, w: 1, h: 4 },
            { i: 'events', x: 0, y: 8, w: 1, h: 4 }
        ]
    };

    const [layouts, setLayouts] = useState(() => {
        const saved = localStorage.getItem('dashboard_layouts');
        return saved ? JSON.parse(saved) : defaultLayouts;
    });

    const handleLayoutChange = (layout: any, allLayouts: any) => {
        setLayouts(allLayouts);
        localStorage.setItem('dashboard_layouts', JSON.stringify(allLayouts));
    };

    const resetLayout = () => {
        setLayouts(defaultLayouts);
        localStorage.removeItem('dashboard_layouts');
        window.location.reload();
    };

    // --- DATA FETCHING (Stabilized with useCallback) ---

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
        } catch (error) {
            console.error("Error fetching machines:", error);
        }
    }, []);

    const fetchCommissionsData = useCallback(async () => {
        try {
            // Updated to include commission_items (and their notes) to check for backorders
            const { data: comms, error } = await supabase
                .from('commissions')
                .select('*, commission_items(is_backorder, notes)')
                .is('deleted_at', null) // Only active
                .in('status', ['Draft', 'Preparing', 'Ready', 'ReturnPending', 'ReturnReady']); // Include Returns

            if (comms) {
                setDraftCommissions(comms.filter((c: any) => c.status === 'Draft' || c.status === 'Preparing'));

                // Returns (ReturnPending or ReturnReady)
                const returns = comms.filter((c: Commission) => c.status === 'ReturnPending' || c.status === 'ReturnReady');
                // Sort returns: Ready to pickup (ReturnReady) first, then Pending
                returns.sort((a: Commission, b: Commission) => {
                    if (a.status === b.status) return a.name.localeCompare(b.name);
                    return a.status === 'ReturnReady' ? -1 : 1;
                });
                setReturnCommissions(returns);

                // Filter and Sort Ready Commissions
                const ready = comms.filter((c: Commission) => c.status === 'Ready');
                ready.sort((a: Commission, b: Commission) => {
                    if (a.is_processed === b.is_processed) {
                        return a.name.localeCompare(b.name);
                    }
                    return a.is_processed ? 1 : -1; // False (Unprocessed) comes first
                });

                setReadyCommissions(ready);
            }
        } catch (error) {
            console.error("Error fetching commissions:", error);
        }
    }, []);

    const fetchRecentEvents = useCallback(async () => {
        try {
            // Fetch Machine Events
            const { data: machineEvents } = await supabase
                .from('machine_events')
                .select('id, action, details, created_at, profiles(full_name), machines(name)')
                .order('created_at', { ascending: false })
                .limit(10);

            // Fetch Commission Events
            const { data: commissionEvents } = await supabase
                .from('commission_events')
                .select('id, action, details, created_at, profiles(full_name), commission_name')
                .order('created_at', { ascending: false })
                .limit(10);

            // Fetch Order Events
            const { data: orderEvents } = await supabase
                .from('order_events')
                .select('id, action, details, created_at, profiles(full_name), orders(supplier, commission_number)')
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

            // Sort combined events by date desc
            events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            setRecentEvents(events.slice(0, 15));
        } catch (error) {
            console.error("Error fetching events:", error);
        }
    }, []);

    // --- INITIAL LOAD & REALTIME SUBSCRIPTION ---

    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            await Promise.all([fetchMachinesData(), fetchCommissionsData(), fetchRecentEvents()]);
            setIsLoading(false);
        };

        loadInitialData();

        // Realtime Subscription
        // NOTE: 'postgres_changes' requires Realtime Replication to be enabled on the table in Supabase.
        // We added `ALTER PUBLICATION...` to dbInit to ensure this.
        const channel = supabase
            .channel('dashboard_updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'machines' },
                (payload) => {
                    console.log('Machines updated (Realtime), refreshing Dashboard...', payload);
                    fetchMachinesData();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'commissions' },
                (payload) => {
                    console.log('Commissions updated (Realtime), refreshing Dashboard...', payload);
                    fetchCommissionsData();
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'machine_events' },
                () => {
                    console.log('New Machine Event, refreshing events...');
                    fetchRecentEvents();
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'commission_events' },
                () => {
                    console.log('New Commission Event, refreshing events...');
                    fetchRecentEvents();
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'order_events' },
                () => {
                    console.log('New Order Event, refreshing events...');
                    fetchRecentEvents();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchMachinesData, fetchCommissionsData]);

    // --- COMMISSION OFFICE PROCESSING ---
    const handleCommissionClick = (comm: Commission) => {
        setProcessingCommission(comm);
        setOfficeNoteInput(comm.office_notes || '');
        setIsOfficeProcessed(comm.is_processed || false);
    };

    const saveCommissionProcess = async () => {
        if (!processingCommission) return;
        setIsSavingProcess(true);
        try {
            await supabase.from('commissions').update({
                is_processed: isOfficeProcessed,
                office_notes: officeNoteInput
            }).eq('id', processingCommission.id);

            setProcessingCommission(null);
            fetchCommissionsData(); // Optimistic update (Realtime should also trigger)
        } catch (err: any) {
            alert("Fehler: " + err.message);
        } finally {
            setIsSavingProcess(false);
        }
    };

    // --- UTILITY HANDLERS ---
    const handleRunAutoInit = async () => {
        setIsInitializing(true);
        setInitError(null);
        try {
            await initializeDatabase(false);
            alert("Datenbank erfolgreich initialisiert!");
            window.location.reload();
        } catch (error: any) {
            setInitError(error.message || String(error));
        } finally {
            setIsInitializing(false);
        }
    };

    const handleUpdateSchema = async () => {
        setIsUpdatingSchema(true);
        setInitError(null);
        try {
            await initializeDatabase(false);
            alert("Schema erfolgreich aktualisiert!");
            // Force reload data after schema update
            fetchMachinesData();
            fetchCommissionsData();
        } catch (error: any) {
            setInitError(error.message || String(error));
        } finally {
            setIsUpdatingSchema(false);
        }
    };

    const copySqlToClipboard = () => {
        navigator.clipboard.writeText(MANUAL_SETUP_SQL);
        setSqlCopied(true);
        setTimeout(() => setSqlCopied(false), 2000);
    };

    // Helper to render Commission Tile Content (to avoid duplication)
    const renderCommissionTileContent = (isFullscreen: boolean) => (
        <>
            <div className="drag-handle cursor-move px-6 py-5 border-b border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-xl flex items-center gap-2 shrink-0">
                <Factory size={20} className="text-emerald-500 dark:text-emerald-400" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex-1">Kommissionen</h2>

                {/* Add Commission Button */}
                <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => navigate('/commissions', { state: { openCreateModal: true, returnTo: '/dashboard' } })}
                    className="p-2 bg-white/50 dark:bg-white/5 rounded-lg text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors mr-2"
                    title="Neue Kommission erstellen"
                >
                    <Plus size={18} />
                </button>

                {/* Fullscreen Toggle */}
                <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setIsCommissionTileFullscreen(!isFullscreen)}
                    className="p-2 bg-white/50 dark:bg-white/5 rounded-lg text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors mr-2"
                >
                    {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>

                <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => navigate('/commissions')}
                    className="text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white"
                >
                    <ArrowRight size={20} />
                </button>
            </div>

            {/* Mobile Tabs */}
            <div className="flex md:hidden border-b border-gray-200 dark:border-white/10 shrink-0">
                <button
                    onClick={() => setMobileTab('draft')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors relative ${mobileTab === 'draft' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-white/40'}`}
                >
                    In Arbeit
                    {mobileTab === 'draft' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />}
                </button>
                <button
                    onClick={() => setMobileTab('ready')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors relative ${mobileTab === 'ready' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-white/40'}`}
                >
                    Bereit
                    {mobileTab === 'ready' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />}
                </button>
                <button
                    onClick={() => setMobileTab('returns')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors relative ${mobileTab === 'returns' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-white/40'}`}
                >
                    Rückgabe
                    {mobileTab === 'returns' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />}
                </button>
            </div>

            <div className="flex-1 block md:grid md:grid-cols-3 md:divide-x divide-gray-200 dark:divide-white/10 overflow-hidden relative">
                {/* Left: Entwurf (Draft) */}
                <div className={`p-4 flex-col gap-3 bg-gradient-to-b from-gray-100 to-transparent dark:from-white/5 dark:to-transparent overflow-hidden h-full ${mobileTab === 'draft' ? 'flex' : 'hidden md:flex'}`}>
                    <div className="flex justify-between items-center mb-2 shrink-0">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">In Arbeit ({draftCommissions.length})</span>
                    </div>

                    <div className={`space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4`}>
                        {draftCommissions.length === 0 && <div className="text-xs text-white/30 italic">Leer.</div>}
                        {draftCommissions.map((c: any) => {
                            // Check for backorders
                            const hasBackorder = c.commission_items?.some((i: any) => i.is_backorder);

                            return (
                                <div
                                    key={c.id}
                                    onClick={() => setViewingCommission(c)}
                                    className={`p-3 rounded-xl cursor-pointer transition-all relative group border ${hasBackorder ? 'bg-red-500/10 border-red-500 hover:bg-red-500/20' :
                                        c.status === 'Preparing' ? 'bg-amber-500/10 border-amber-500/50 hover:bg-amber-500/20' : // NEW YELLOW STYLE
                                            'bg-white/50 dark:bg-white/5 border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0">
                                            <div className="font-bold text-gray-900 dark:text-white text-sm truncate">{c.name}</div>
                                            <div className="text-xs text-gray-500 dark:text-white/40 mt-0.5">{c.order_number}</div>
                                        </div>
                                        {hasBackorder ? (
                                            <AlertTriangle size={14} className="text-red-500 dark:text-red-400 group-hover:text-red-400 dark:group-hover:text-red-300 transition-colors" />
                                        ) : (
                                            <ArrowRight size={14} className="text-gray-300 dark:text-white/20 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100" />
                                        )}
                                    </div>
                                    {c.notes && <div className="mt-2 text-[10px] text-gray-400 dark:text-white/30 italic truncate">{c.notes}</div>}
                                    {hasBackorder && (
                                        <div className="mt-2 text-[9px] font-bold text-red-400 uppercase tracking-wide bg-red-900/30 px-1.5 py-0.5 rounded inline-block">
                                            Rückstand!
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Center: Bereitgestellt (Ready) - INTERACTIVE */}
                <div className={`p-4 flex-col gap-3 relative overflow-hidden h-full ${mobileTab === 'ready' ? 'flex' : 'hidden md:flex'}`}>
                    <div className="flex justify-between items-center mb-2 shrink-0">
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Bereitgestellt ({readyCommissions.length})</span>
                    </div>

                    <div className={`space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-10`}>
                        {readyCommissions.length === 0 && <div className="text-xs text-white/30 italic">Nichts bereitgestellt.</div>}
                        {readyCommissions.map(c => {
                            // Needs processing if NOT processed yet
                            const needsProcessing = !c.is_processed;

                            return (
                                <div
                                    key={c.id}
                                    onClick={() => handleCommissionClick(c)}
                                    className={`
                                        p-3 rounded-xl cursor-pointer transition-all relative group border
                                        ${needsProcessing ? 'bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500 animate-border-pulse-green' : 'bg-white/50 dark:bg-white/5 border-emerald-500/30 hover:bg-gray-100 dark:hover:bg-white/10'}
                                    `}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0 flex-1 pr-2">
                                            <div className="font-bold text-gray-900 dark:text-white text-sm truncate">{c.name}</div>
                                            <div className="text-xs text-emerald-600/80 dark:text-emerald-200/60 mt-0.5">{c.order_number}</div>
                                            {/* Extended info in fullscreen or if processed */}
                                            {(isFullscreen || c.office_notes) && c.office_notes && (
                                                <div className="mt-2 p-2 bg-gray-100 dark:bg-black/20 rounded-lg text-xs text-gray-600 dark:text-white/80 flex gap-2 items-start border border-gray-200 dark:border-white/5">
                                                    <StickyNote size={12} className="shrink-0 mt-0.5 text-amber-500 dark:text-amber-400" />
                                                    <span className="italic">{c.office_notes}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Status Icon */}
                                        {c.is_processed ? (
                                            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-white/50 flex items-center justify-center border border-gray-300 dark:border-white/10" title="Vom Büro gesehen">
                                                <Check size={12} />
                                            </div>
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 animate-pulse" title="Neue Bereitstellung!">
                                                <Check size={12} strokeWidth={3} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Rückgaben (Returns) */}
                <div className={`p-4 flex-col gap-3 bg-gradient-to-b from-purple-500/5 to-transparent overflow-hidden h-full ${mobileTab === 'returns' ? 'flex' : 'hidden md:flex'}`}>
                    <div className="flex justify-between items-center mb-2 shrink-0">
                        <span className="text-sm font-bold text-purple-600 dark:text-purple-400">Rückgaben ({returnCommissions.length})</span>
                    </div>

                    <div className={`space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4`}>
                        {returnCommissions.length === 0 && <div className="text-xs text-gray-400 dark:text-white/30 italic">Keine offenen Rückgaben.</div>}
                        {returnCommissions.map(c => (
                            <div
                                key={c.id}
                                onClick={() => handleCommissionClick(c)}
                                className={`p-3 rounded-xl border cursor-pointer transition-all hover:bg-gray-100 dark:hover:bg-white/10 ${c.status === 'ReturnReady' ? 'bg-purple-500/10 dark:bg-purple-500/20 border-purple-500 text-purple-800 dark:text-purple-100' : 'bg-white/50 dark:bg-white/5 border-purple-500/30'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="min-w-0">
                                        <div className="font-bold text-gray-900 dark:text-white text-sm truncate">{c.name}</div>
                                        <div className="text-xs text-gray-500 dark:text-white/40 mt-0.5">{c.order_number}</div>
                                        {c.status === 'ReturnReady' && <div className="mt-2 text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-2 py-1 rounded inline-block">ABHOLBEREIT</div>}
                                        {c.status === 'ReturnPending' && <div className="mt-2 text-[10px] font-bold text-orange-600 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/40 px-2 py-1 rounded inline-block">Wartet auf Lager</div>}
                                    </div>
                                    <Undo2 size={14} className="text-purple-500 dark:text-purple-400" />
                                </div>
                                {c.office_notes && (
                                    <div className="mt-2 p-1.5 bg-gray-100 dark:bg-black/20 rounded-lg text-[10px] text-gray-600 dark:text-white/70 border border-gray-200 dark:border-white/5">
                                        {c.office_notes}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <div className="space-y-6 pb-12">
            {/* HEADER */}
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-white/70">
                        {profile?.full_name ? `Moin, ${profile.full_name.split(' ')[0]}` : 'Dashboard'}
                    </h1>
                    <p className="text-gray-500 dark:text-white/50 text-sm mt-1">Aktueller Statusbericht</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => { fetchMachinesData(); fetchCommissionsData(); fetchRecentEvents(); }}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 shadow-lg"
                        title="Aktualisieren"
                    >
                        <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={() => setShowAppDrawer(true)}
                        className="p-3 rounded-xl bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/80 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-300 shadow-lg"
                    >
                        <Grid size={24} />
                    </button>
                </div>
            </header>

            {/* --- DASHBOARD GRID --- */}
            {/* If Commission is Fullscreen, we render it OUTSIDE the grid as a fixed overlay */}
            {isCommissionTileFullscreen && (
                <div className="fixed inset-4 z-[100]">
                    <GlassCard className="flex flex-col p-0 overflow-hidden border-none bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200 dark:border-white/20 shadow-2xl rounded-3xl h-full" contentClassName="!p-0 flex flex-col h-full">
                        {/* ... Commission Tile Content (Duplicated/Extracted for reuse would be better, but keeping inline for now) ... */}
                        {renderCommissionTileContent(true)}
                    </GlassCard>
                </div>
            )}

            <ResponsiveGridLayout
                className="layout"
                layouts={layouts}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 2, md: 2, sm: 1, xs: 1, xxs: 1 }}
                rowHeight={100}
                onLayoutChange={handleLayoutChange}
                isDraggable={!isCommissionTileFullscreen}
                isResizable={!isCommissionTileFullscreen}
                draggableHandle=".drag-handle"
            >
                {/* --- TILE 1: MASCHINENSTATUS --- */}
                <div key="machines">
                    <GlassCard className="flex flex-col h-full p-0 overflow-hidden border-none bg-white/80 dark:bg-white/5" contentClassName="!p-0 flex flex-col h-full">
                        <div className="drag-handle cursor-move px-6 py-5 border-b border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-xl flex justify-between items-center shrink-0">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Maschinenstatus</h2>
                            <button
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={() => navigate('/machines')}
                                className="text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white"
                            >
                                <ArrowRight size={20} />
                            </button>
                        </div>

                        <div className="flex-1 grid grid-cols-2 divide-x divide-gray-200 dark:divide-white/10 overflow-hidden">
                            {/* Left: Verliehen (Rented) */}
                            <div className="p-4 flex flex-col gap-3 overflow-hidden h-full">
                                <div className="flex justify-between items-center mb-2 shrink-0">
                                    <span className="text-sm font-bold text-white">Verliehen ({rentedMachines.length})</span>
                                </div>

                                <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4">
                                    {rentedMachines.length === 0 && <div className="text-xs text-gray-400 dark:text-white/30 italic">Keine Maschinen verliehen.</div>}
                                    {rentedMachines.map(m => (
                                        <div key={m.id} onClick={() => navigate('/machines')} className="group cursor-pointer">
                                            <div className="font-medium text-gray-900 dark:text-white text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors truncate">{m.name}</div>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <User size={12} className="text-amber-500 dark:text-amber-400" />
                                                <span className="text-xs text-gray-500 dark:text-white/50 truncate">{m.profiles?.full_name || m.externalBorrower || 'Unbekannt'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Reparatur (Repair) */}
                            <div className="p-4 flex flex-col gap-3 overflow-hidden h-full">
                                <div className="flex justify-between items-center mb-2 shrink-0">
                                    <span className="text-sm font-bold text-rose-400">Reparatur ({repairMachines.length})</span>
                                </div>

                                <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4">
                                    {repairMachines.length === 0 && <div className="text-xs text-gray-400 dark:text-white/30 italic">Keine Defekte.</div>}
                                    {repairMachines.map(m => (
                                        <div key={m.id} onClick={() => navigate('/machines')} className="group cursor-pointer">
                                            <div className="font-medium text-gray-900 dark:text-white text-sm group-hover:text-rose-500 dark:group-hover:text-rose-300 transition-colors truncate">{m.name}</div>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <Wrench size={12} className="text-rose-500" />
                                                <span className="text-xs text-gray-500 dark:text-white/50 truncate italic">{m.notes || 'Keine Notiz'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                </div>

                {/* --- TILE 2: KOMMISSIONEN --- */}
                <div key="commissions">
                    {/* If fullscreen, we render a placeholder here or nothing? RGL needs the item to exist. We render it, but maybe empty or hidden if fullscreen? 
                        Actually, if we render it hidden, RGL might get confused. 
                        Let's render the content here normally. If fullscreen is active, this tile stays here but the "Fullscreen" version is on top.
                    */}
                    <GlassCard className={`flex flex-col h-full p-0 overflow-hidden border-none bg-white/80 dark:bg-white/5`} contentClassName="!p-0 flex flex-col h-full">
                        {renderCommissionTileContent(false)}
                    </GlassCard>
                </div>

                {/* --- TILE 3: EREIGNISLISTE --- */}
                <div key="events">
                    <GlassCard className="flex flex-col h-full p-0 overflow-hidden border-none bg-white/80 dark:bg-white/5" contentClassName="!p-0 flex flex-col h-full">
                        <div className="drag-handle cursor-move px-6 py-5 border-b border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-xl flex items-center gap-2 shrink-0">
                            <StickyNote size={20} className="text-blue-500 dark:text-blue-400" />
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Letzte Aktivitäten</h2>
                        </div>

                        <div className="p-0 overflow-y-auto flex-1 min-h-0 pb-12">
                            {recentEvents.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 dark:text-white/30 italic">
                                    Noch keine Aktivitäten verzeichnet.
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-200 dark:divide-white/5">
                                    {recentEvents.map((event) => (
                                        <div key={`${event.type}-${event.id}`} className="p-4 flex items-start gap-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                            {/* Icon based on type */}
                                            <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 
                                                ${event.type === 'machine' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : ''}
                                                ${event.type === 'commission' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : ''}
                                                ${event.type === 'order' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : ''}
                                            `}>
                                                {event.type === 'machine' && <Wrench size={14} />}
                                                {event.type === 'commission' && <CheckCircle2 size={14} />}
                                                {event.type === 'order' && <ShoppingCart size={14} />}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                                        {event.user_name}
                                                    </span>
                                                    <span className="text-xs text-gray-400 dark:text-white/40 whitespace-nowrap ml-2">
                                                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: de })}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-600 dark:text-white/70 mt-0.5">
                                                    <span className="font-medium text-gray-500 dark:text-white/50 uppercase text-[10px] tracking-wider mr-2 border border-gray-200 dark:border-white/10 px-1.5 py-0.5 rounded">
                                                        {event.type === 'machine' ? 'Gerät' : event.type === 'commission' ? 'Kommission' : 'Bestellung'}
                                                    </span>
                                                    <span className="font-bold text-gray-900 dark:text-white mr-1">
                                                        {event.entity_name}:
                                                    </span>
                                                    {event.details}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </GlassCard>
                </div>
            </ResponsiveGridLayout>


            {/* --- UTILITY MODALS (App Drawer & SQL Fix) --- */}

            {/* COMMISSION DETAIL MODAL */}
            {viewingCommission && (
                <CommissionDetailModal
                    commission={viewingCommission}
                    onClose={() => setViewingCommission(null)}
                    onEdit={() => navigate('/commissions', { state: { editCommissionId: viewingCommission.id, returnTo: '/dashboard' } })}
                />
            )}

            {/* PROCESS COMMISSION MODAL */}
            {
                processingCommission && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in">
                        <GlassCard className="w-full max-w-md">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Kommission bearbeiten</h2>
                                    <p className="text-sm text-white/50">{processingCommission.name}
                                        {processingCommission.status === 'ReturnReady' && <span className="ml-2 text-purple-400 font-bold">(Retoure Abholbereit)</span>}
                                        {processingCommission.status === 'ReturnPending' && <span className="ml-2 text-orange-400 font-bold">(Retoure Angemeldet)</span>}
                                    </p>
                                </div>
                                <button onClick={() => setProcessingCommission(null)} className="text-white/50 hover:text-white"><X size={20} /></button>
                            </div>

                            <div className="space-y-6">
                                {/* Checkbox */}
                                <div
                                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-4 ${isOfficeProcessed ? 'bg-emerald-500/20 border-emerald-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                    onClick={() => setIsOfficeProcessed(!isOfficeProcessed)}
                                >
                                    <div className={`w-6 h-6 rounded border flex items-center justify-center shrink-0 transition-colors ${isOfficeProcessed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/30'}`}>
                                        {isOfficeProcessed && <Check size={16} />}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white">Büro: Gesehen / Bearbeitet</div>
                                        <div className="text-xs text-white/50">Markiere den Vorgang als "in Bearbeitung" oder "Erledigt".</div>
                                    </div>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="text-xs text-white/50 font-bold uppercase mb-2 block flex items-center gap-2">
                                        <StickyNote size={12} /> Büro Notizen
                                    </label>
                                    <textarea
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 min-h-[100px]"
                                        placeholder="z.B. Termin vereinbart am 12.12. / Kunde ruft an..."
                                        value={officeNoteInput}
                                        onChange={e => setOfficeNoteInput(e.target.value)}
                                    />
                                    <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
                                        {['Termin vereinbart', 'Kunde informiert', 'Abholung bestätigt', 'Großhändler beauftragt'].map(tag => (
                                            <button
                                                key={tag}
                                                onClick={() => setOfficeNoteInput(prev => (prev ? prev + '\n' : '') + tag)}
                                                className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/60 hover:bg-white/10 whitespace-nowrap"
                                            >
                                                + {tag}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6 justify-end">
                                <Button variant="secondary" onClick={() => setProcessingCommission(null)}>Abbrechen</Button>
                                <Button onClick={saveCommissionProcess} disabled={isSavingProcess} className="bg-emerald-600 hover:bg-emerald-500">
                                    {isSavingProcess ? 'Speichert...' : 'Speichern'}
                                </Button>
                            </div>
                        </GlassCard>
                    </div>
                )
            }

            {/* APP DRAWER MODAL */}
            <GlassModal
                isOpen={showAppDrawer}
                onClose={() => setShowAppDrawer(false)}
                title="Apps & Funktionen"
            >
                <div className="p-6 space-y-8">

                    {/* --- DESIGN & ANSICHT SECTION --- */}
                    <div className="mb-8 p-4 rounded-2xl bg-white/5 border border-white/5">
                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4">Design & Ansicht</h3>
                        <div className="space-y-4">
                            {/* View Mode Toggle */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${viewMode === 'desktop' ? 'bg-blue-100 text-blue-600' : 'bg-white/10 text-white/50'}`}>
                                        <Monitor size={18} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-white">Desktop Modus</div>
                                        <div className="text-xs text-white/40">{viewMode === 'desktop' ? 'Aktiviert (Full HD)' : 'Standard (Tablet)'}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={toggleViewMode}
                                    className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${viewMode === 'desktop' ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${viewMode === 'desktop' ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {/* Reset Layout */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-white/10 text-white/50">
                                        <LayoutTemplate size={18} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">Layout zurücksetzen</div>
                                        <div className="text-xs text-gray-500 dark:text-white/40">Standard wiederherstellen</div>
                                    </div>
                                </div>
                                <Button onClick={resetLayout} variant="secondary" className="text-xs py-1 h-8">
                                    Reset
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-8">
                        {/* App: Warehouses */}
                        <button onClick={() => navigate('/warehouses')} className="flex flex-col items-center gap-2 group">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                                <Warehouse size={28} className="text-emerald-400" />
                            </div>
                            <span className="text-xs text-white/70 group-hover:text-white text-center">Lagerorte</span>
                        </button>

                        {/* App: Suppliers */}
                        <button onClick={() => navigate('/suppliers')} className="flex flex-col items-center gap-2 group">
                            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                                <Factory size={28} className="text-purple-400" />
                            </div>
                            <span className="text-xs text-white/70 group-hover:text-white text-center">Lieferanten</span>
                        </button>

                        {/* App: Labels */}
                        <button onClick={() => navigate('/labels')} className="flex flex-col items-center gap-2 group">
                            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                                <Tag size={28} className="text-blue-400" />
                            </div>
                            <span className="text-xs text-white/70 group-hover:text-white text-center">Etiketten</span>
                        </button>

                        {/* App: Shelf Editor (NEW) */}
                        <button onClick={() => navigate('/shelf-editor')} className="flex flex-col items-center gap-2 group">
                            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                                <Library size={28} className="text-amber-400" />
                            </div>
                            <span className="text-xs text-white/70 group-hover:text-white text-center">Regal-Editor</span>
                        </button>

                        {/* App: Database */}
                        <button onClick={() => setShowSqlModal(true)} className="flex flex-col items-center gap-2 group">
                            <div className="w-16 h-16 rounded-2xl bg-gray-700/30 border border-white/10 flex items-center justify-center group-hover:bg-gray-700/50 transition-colors">
                                <Database size={28} className="text-gray-300" />
                            </div>
                            <span className="text-xs text-white/70 group-hover:text-white text-center">System</span>
                        </button>
                    </div>
                </div>
            </GlassModal>

            {/* SQL Manual Fix Modal */}
            {
                showSqlModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="w-full max-w-3xl bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                                <div className="flex items-center gap-3">
                                    <Database className="text-emerald-400" size={24} />
                                    <div>
                                        <h2 className="text-xl font-bold text-white">Datenbank Einrichtung</h2>
                                        <p className="text-xs text-white/50">Reparatur & SQL Befehle</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowSqlModal(false)} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-6">
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-3">
                                    <h3 className="text-lg font-semibold text-emerald-300 flex items-center gap-2">
                                        <Settings size={18} /> Automatische Einrichtung
                                    </h3>
                                    <div className="flex gap-3">
                                        <Button
                                            onClick={handleRunAutoInit}
                                            disabled={isInitializing}
                                            className="flex-1 sm:flex-none"
                                        >
                                            {isInitializing ? 'Lade...' : 'Setup Starten'}
                                        </Button>

                                        <Button
                                            onClick={handleUpdateSchema}
                                            disabled={isUpdatingSchema}
                                            variant="secondary"
                                            className="flex-1 sm:flex-none"
                                        >
                                            Schema Updates
                                        </Button>
                                    </div>
                                    {initError && (
                                        <div className="mt-3 p-3 bg-red-500/20 border border-red-500/30 text-red-200 text-sm rounded-lg flex items-start gap-2">
                                            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                                            <span className="break-words max-w-full">{initError}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-4 text-white/30 text-xs uppercase">
                                    <div className="h-px bg-white/10 flex-1" />
                                    ODER
                                    <div className="h-px bg-white/10 flex-1" />
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">Manuelles SQL</h3>
                                    <div className="relative group">
                                        <pre className="bg-black/50 p-4 rounded-xl text-xs font-mono text-emerald-300/80 overflow-x-auto border border-white/10 whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                                            {MANUAL_SETUP_SQL}
                                        </pre>
                                        <div className="absolute top-2 right-2">
                                            <Button
                                                onClick={copySqlToClipboard}
                                                className="py-1 px-3 text-xs bg-white/10 hover:bg-white/20 border-none"
                                                icon={sqlCopied ? <Check size={14} /> : <Copy size={14} />}
                                            >
                                                {sqlCopied ? 'Kopiert!' : 'Kopieren'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Dashboard;
