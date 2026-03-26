import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GlassCard, StatusBadge, Button, GlassModal } from '../src/components/UIComponents';
import { AlertTriangle, Wrench, User, CheckCircle2, FileText, ArrowRight, Grid, Database, X, Play, RefreshCw, Check, Copy, Settings, Factory, Warehouse, Tag, Maximize2, Minimize2, PhoneCall, StickyNote, Save, Undo2, Library, Plus, MessageSquare, Monitor, Smartphone, ShoppingCart, LayoutTemplate, Lock, Unlock, History, LayoutDashboard, ChevronUp, ChevronDown, Eye, EyeOff, Zap, Move, Wand2, Hash, Send, Clock, Circle, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../hooks/useIsMobile';
import { usePersistentState } from '../hooks/usePersistentState';
import { initializeDatabase, MANUAL_SETUP_SQL } from '../utils/dbInit';
import { useAuth } from '../contexts/AuthContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useTheme } from '../contexts/ThemeContext';
import { CommissionDetailContent } from '../src/features/commissions/components/CommissionDetailContent';
import { MachineDetailContent } from '../src/features/machines/components/MachineDetailContent';
import { KeyHandoverContent } from '../src/features/keys/components/KeyComponents';
import { ChangelogHistoryContent } from '../src/components/ChangelogHistoryContent'; // Updated Import
import { supabase } from '../supabaseClient';
import { Machine, MachineStatus, Commission, UserProfile, Key, Article, Supplier } from '../types';
import { CommissionEditContent } from '../src/features/commissions/components/CommissionEditContent';
import { CommissionOfficeContent } from '../src/components/CommissionOfficeContent';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { toast } from 'sonner'; // Added toast import
import { Key as KeyIcon } from 'lucide-react'; // Added KeyIcon
import { ALL_NAV_ITEMS, DEFAULT_SIDEBAR_ORDER } from '../src/components/NavConfig';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface AppEvent {
    id: string;
    type: 'machine' | 'commission' | 'order' | 'key'; // Added key event type
    user_name: string;
    action: string;
    details: string;
    created_at: string;
    entity_name: string;
}

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const { primaryWarehouseId } = useUserPreferences();
    const { viewMode, toggleViewMode, isLowPerfMode, toggleLowPerfMode } = useTheme();

    const [isLoading, setIsLoading] = useState(true);

    // Data State
    const [rentedMachines, setRentedMachines] = useState<Machine[]>([]);
    const [repairMachines, setRepairMachines] = useState<Machine[]>([]);
    const [rentedKeys, setRentedKeys] = useState<Key[]>([]); // New State

    // Helper Data for Create Modal
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [availableArticles, setAvailableArticles] = useState<Article[]>([]);
    const [showCreateCommissionModal, setShowCreateCommissionModal] = useState(false);

    // Split View / Modal States for Machines & Keys
    const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
    const [selectedKey, setSelectedKey] = useState<Key | null>(null);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

    const [openCommissions, setOpenCommissions] = useState<Commission[]>([]);
    const [backlogCommissions, setBacklogCommissions] = useState<Commission[]>([]);
    const [returnCommissions, setReturnCommissions] = useState<Commission[]>([]);
    const [recentEvents, setRecentEvents] = useState<AppEvent[]>([]);
    
    // Tasks & Chat State
    const [dashboardTasks, setDashboardTasks] = useState<any[]>([]);
    const [dashboardChannels, setDashboardChannels] = useState<{ id: string, name: string, messages: any[], allMessages: any[] }[]>([]);
    const [isTasksTileFullscreen, setIsTasksTileFullscreen] = useState(false);
    const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
    const [chatInputMessage, setChatInputMessage] = useState('');
    const [tasksTileTab, setTasksTileTab] = useState<'tasks' | 'chat'>('tasks');
    const [selectedDashboardTask, setSelectedDashboardTask] = useState<any | null>(null);
    const [showTaskAppIframe, setShowTaskAppIframe] = useState(false);
    const [channelReadTimestamps, setChannelReadTimestamps] = usePersistentState<Record<string, string>>('channel_read_timestamps', {});
    
    // New persistent states for Tile features
    const [collapsedTaskIds, setCollapsedTaskIds] = usePersistentState<string[]>('dashboard_collapsed_tasks', []);
    const [tasksTileSplit, setTasksTileSplit] = usePersistentState<number>('tasks_tile_split', 40); // Initial 40% for tasks
    const [isResizingTasks, setIsResizingTasks] = useState(false);

    // ... (utility states unchanged)
    const [showAppDrawer, setShowAppDrawer] = useState(false);
    const [showChangelogHistory, setShowChangelogHistory] = useState(false);
    const [showSqlModal, setShowSqlModal] = useState(false);
    const [showSidebarManager, setShowSidebarManager] = useState(false);
    const [sidebarOrder, setSidebarOrder] = usePersistentState<string[]>('sidebar-order', []);

    // Get active/inactive items for manager
    const activeOrder = (sidebarOrder && sidebarOrder.length > 0) ? sidebarOrder : DEFAULT_SIDEBAR_ORDER;

    const toggleSidebarItem = (id: string) => {
        if (activeOrder.includes(id)) {
            // Disable: Remove from order list
            // Prevent removing the last item to avoid empty state issues
            if (activeOrder.length <= 1) {
                // toast is global? If not check imports. toast usually imported from UIComponents or sonner.
                // Assuming console warn if toast not available or standard alert
                alert("Mindestens eine Seite muss aktiv bleiben.");
                return;
            }
            setSidebarOrder(activeOrder.filter(item => item !== id));
        } else {
            // Enable: Add to end
            setSidebarOrder([...activeOrder, id]);
        }
    };

    const moveSidebarItem = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...activeOrder];
        if (direction === 'up' && index > 0) {
            [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
        } else if (direction === 'down' && index < newOrder.length - 1) {
            [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        }
        setSidebarOrder(newOrder);
    };
    const [isInitializing, setIsInitializing] = useState(false);
    const [isUpdatingSchema, setIsUpdatingSchema] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);
    const [sqlCopied, setSqlCopied] = useState(false);

    // ... (feature states unchanged)
    const [isCommissionTileFullscreen, setIsCommissionTileFullscreen] = useState(false);
    const [viewingCommission, setViewingCommission] = useState<Commission | null>(null);
    const [isSavingProcess, setIsSavingProcess] = useState(false);
    const [mobileTab, setMobileTab] = useState<'open' | 'backlog' | 'returns'>('open');

    const isMobile = useIsMobile();
    // Split View Status: Only active if NOT mobile
    const isSplitView = !isMobile && (!!selectedMachine || !!selectedKey || !!viewingCommission || !!selectedDashboardTask || showChangelogHistory);

    // --- LAYOUT STATE ---
    // Added 'keys' tile to layout. Adjusted heights/widths to fit.
    const defaultLayouts = {
        lg: [
            { i: 'machines', x: 0, y: 0, w: 1, h: 4 },
            { i: 'keys', x: 0, y: 4, w: 1, h: 4 }, 
            { i: 'commissions', x: 1, y: 0, w: 1, h: 8 }, 
            { i: 'events', x: 0, y: 8, w: 1, h: 4 },
            { i: 'tasks', x: 1, y: 8, w: 1, h: 4 }
        ],
        md: [
            { i: 'machines', x: 0, y: 0, w: 1, h: 4 },
            { i: 'keys', x: 0, y: 4, w: 1, h: 4 },
            { i: 'commissions', x: 1, y: 0, w: 1, h: 8 },
            { i: 'events', x: 0, y: 8, w: 1, h: 3 },
            { i: 'tasks', x: 1, y: 8, w: 1, h: 3 }
        ],
        sm: [
            { i: 'machines', x: 0, y: 0, w: 1, h: 4 },
            { i: 'keys', x: 0, y: 4, w: 1, h: 4 },
            { i: 'commissions', x: 0, y: 8, w: 1, h: 4 },
            { i: 'events', x: 0, y: 12, w: 1, h: 4 },
            { i: 'tasks', x: 0, y: 16, w: 1, h: 4 }
        ]
    };

    const [layouts, setLayouts] = useState(() => {
        const saved = localStorage.getItem('dashboard_layouts');
        if (!saved) return defaultLayouts;

        try {
            const parsed = JSON.parse(saved);
            // Migration: Ensure all keys from defaultLayouts exist in saved layout
            let hasChanges = false;
            const migrated = { ...parsed };

            // Iterate over breakpoints (lg, md, sm) to ensure all defined tiles exist
            (Object.keys(defaultLayouts) as Array<keyof typeof defaultLayouts>).forEach(bp => {
                if (!migrated[bp]) {
                    // Entire breakpoint missing? Copy default
                    migrated[bp] = defaultLayouts[bp];
                    hasChanges = true;
                } else {
                    // Check for missing items in this breakpoint
                    defaultLayouts[bp].forEach((defTile: any) => {
                        const exists = migrated[bp].find((t: any) => t.i === defTile.i);
                        if (!exists) {
                            // New Tile (e.g. 'keys') missing! Add it from default
                            migrated[bp] = [...migrated[bp], defTile];
                            hasChanges = true;
                        }
                    });
                }
            });

            return migrated;
        } catch (e) {
            console.error("Layout parse error, resetting:", e);
            return defaultLayouts;
        }
    });

    const handleLayoutChange = (layout: any, allLayouts: any) => {
        if (isSplitView) return; // Prevent saving temporary split-view layout
        setLayouts(allLayouts);
        localStorage.setItem('dashboard_layouts', JSON.stringify(allLayouts));
    };

    const toggleTileLock = (tileId: string) => {
        const currentBreakpoint = 'lg'; // Simplified for now, usually we check screen width or just update all
        const nextLayouts = { ...layouts };

        // Update for all breakpoints to keep consistent behavior
        Object.keys(nextLayouts).forEach(bk => {
            nextLayouts[bk] = nextLayouts[bk].map((item: any) => {
                if (item.i === tileId) {
                    return { ...item, static: !item.static };
                }
                return item;
            });
        });

        setLayouts(nextLayouts);
        localStorage.setItem('dashboard_layouts', JSON.stringify(nextLayouts));
    };

    const isTileLocked = (tileId: string) => {
        // Check current layout (lg as default fallback)
        const layout = layouts.lg || layouts.md || [];
        const item = layout.find((i: any) => i.i === tileId);
        return item?.static || false;
    };

    const resetLayout = () => {
        setLayouts(defaultLayouts);
        localStorage.removeItem('dashboard_layouts');
        window.location.reload();
    };

    // --- DATA FETCHING ---

    const fetchKeysData = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('keys')
                .select('*')
                .eq('status', 'InUse');

            if (error) throw error;
            // @ts-ignore
            setRentedKeys(data || []);
        } catch (error) {
            console.error("Error fetching keys:", error);
        }
    }, []);

    const fetchSuppliers = useCallback(async () => {
        try {
            const { data } = await supabase.from('suppliers').select('*').order('name');
            if (data) setSuppliers(data);
        } catch (e) { console.error(e); }
    }, []);

    const fetchArticles = useCallback(async () => {
        if (!primaryWarehouseId) return;
        try {
            const { data } = await supabase.from('articles').select('*').eq('warehouse_id', primaryWarehouseId);
            if (data) {
                const mapped = data.map((item: any) => ({ ...item, image: item.image_url }));
                setAvailableArticles(mapped);
            }
        } catch (e) { console.error(e); }
    }, [primaryWarehouseId]);

    const fetchUsers = useCallback(async () => {
        try {
            const { data } = await supabase.from('profiles').select('*');
            if (data) setAllUsers(data);
        } catch (e) { console.error(e); }
    }, []);

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

    const fetchCommissionsData = useCallback(async () => {
        try {
            // Updated to include commission_items (and their notes) to check for backorders
            const { data: comms, error } = await supabase
                .from('commissions')
                .select('*, commission_items(is_backorder, notes)')
                .is('deleted_at', null) // Only active
                .in('status', ['Draft', 'Preparing', 'Ready', 'ReturnPending', 'ReturnReady', 'Missing']); // Include All relevant

            if (comms) {
                // 1. BACKLOG (Rückstand) - Has items with is_backorder
                const backlog = comms.filter((c: any) => c.commission_items?.some((i: any) => i.is_backorder));
                setBacklogCommissions(backlog);

                // 2. RETURNS (Rückgabe) - ReturnPending or ReturnReady
                const returns = comms.filter((c: Commission) => c.status === 'ReturnPending' || c.status === 'ReturnReady');
                returns.sort((a: Commission, b: Commission) => {
                    if (a.status === b.status) return a.name.localeCompare(b.name);
                    return a.status === 'ReturnReady' ? -1 : 1;
                });
                setReturnCommissions(returns);

                // 3. OPEN (Offen/Aktion) - Price Inquiry, Unknown Date OR Ready & Unprocessed
                const open = comms.filter((c: any) => {
                    const isBacklog = c.commission_items?.some((i: any) => i.is_backorder);
                    if (isBacklog) return false; // Backlog stays in backlog column

                    const hasFlag = c.is_price_inquiry || c.delivery_date_unknown;
                    const isReadyToBook = c.status === 'Ready' && !c.is_processed;

                    return hasFlag || isReadyToBook;
                });
                
                // Sort Open: Ready to book first, then flags
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

            // Fetch Key Events
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

            // Sort combined events by date desc
            events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            setRecentEvents(events.slice(0, 15));
        } catch (error) {
            console.error("Error fetching events:", error);
        }
    }, []);

    const fetchTasksData = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('*, subtasks(*)')
                .neq('status', 'done')
                .order('created_at', { ascending: false })
                .limit(10);
            
            if (error) throw error;
            setDashboardTasks(data || []);
            
            // Update selected task if it's currently open
            if (selectedDashboardTask) {
                const updatedTask = data?.find(t => t.id === selectedDashboardTask.id);
                if (updatedTask) setSelectedDashboardTask(updatedTask);
            }
        } catch (error) {
            console.error("Error fetching tasks:", error);
        }
    }, [selectedDashboardTask]);

    const fetchChannelsData = useCallback(async () => {
        try {
            const { data: channels, error: channelsError } = await supabase
                .from('channels')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (channelsError) throw channelsError;

            const { data: messages, error: messagesError } = await supabase
                .from('messages')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200);

            if (messagesError) throw messagesError;

            const channelsWithMessages = channels.map(c => {
               const matches = messages.filter(m => m.channel_id === c.id);
               return {
                   ...c,
                   messages: matches.slice(0, 2), 
                   allMessages: matches 
               };
            });

            setDashboardChannels(channelsWithMessages || []);
        } catch (error) {
            console.error("Error fetching channels:", error);
        }
    }, []);

    // Effect to update read timestamp when a channel is open and a new message arrives
    useEffect(() => {
        if (activeChannelId) {
            const channel = dashboardChannels.find(c => c.id === activeChannelId);
            const latestMsg = channel?.allMessages?.[0]?.created_at;
            if (latestMsg && latestMsg > (channelReadTimestamps[activeChannelId] || '0')) {
                setChannelReadTimestamps(prev => ({ ...prev, [activeChannelId]: latestMsg }));
            }
        }
    }, [activeChannelId, dashboardChannels, channelReadTimestamps, setChannelReadTimestamps]);

    // --- INITIAL LOAD & REALTIME SUBSCRIPTION ---

    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            await Promise.all([
                fetchMachinesData(),
                fetchCommissionsData(),
                fetchRecentEvents(),
                fetchKeysData(),
                fetchSuppliers(),
                fetchArticles(),
                fetchUsers(),
                fetchTasksData(),
                fetchChannelsData()
            ]);
            setIsLoading(false);
        };

        loadInitialData();

        // Realtime Subscription
        const channel = supabase
            .channel('dashboard_updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'machines' },
                () => fetchMachinesData()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'keys' },
                () => fetchKeysData()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'commissions' },
                () => fetchCommissionsData()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tasks' },
                () => fetchTasksData()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'messages' },
                () => fetchChannelsData()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'channels' },
                () => fetchChannelsData()
            )
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'machine_events' }, fetchRecentEvents)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'commission_events' }, fetchRecentEvents)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_events' }, fetchRecentEvents)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'key_events' }, fetchRecentEvents)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchMachinesData, fetchCommissionsData, fetchRecentEvents, fetchKeysData, fetchSuppliers, fetchArticles, fetchUsers]);

    // --- COMMISSION OFFICE PROCESSING ---
    const handleCommissionClick = (comm: Commission) => {
        setViewingCommission(comm);
    };

    const handleMarkAllAsRead = async () => {
        const readyToBook = openCommissions.filter(c => c.status === 'Ready' && !c.is_processed);
        if (readyToBook.length === 0) return;

        const ids = readyToBook.map(c => (c as any).id);
        
        try {
            const { error } = await supabase
                .from('commissions')
                .update({ is_processed: true })
                .in('id', ids);

            if (error) throw error;
            
            toast.success(`${ids.length} Kommissionen als gelesen markiert.`);
            fetchCommissionsData(); // Refresh list
        } catch (error: any) {
            toast.error("Fehler beim Aktualisieren: " + error.message);
        }
    };

    const handleSaveOfficeData = async (isProcessed: boolean, notes: string) => {
        if (!viewingCommission) return;
        setIsSavingProcess(true);
        try {
            await supabase.from('commissions').update({
                is_processed: isProcessed,
                office_notes: notes
            }).eq('id', viewingCommission.id);

            // Optimistic update
            const updated = { ...viewingCommission, is_processed: isProcessed, office_notes: notes };
            setViewingCommission(updated as any);

            fetchCommissionsData();
            toast.success("Verwaltungsdaten gespeichert");
        } catch (err: any) {
            toast.error("Fehler beim Speichern: " + err.message);
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
            <div className={`px-6 py-5 border-b border-white/10 bg-white/5 backdrop-blur-xl flex items-center gap-3 shrink-0`}>
                <button
                    className={`drag-handle p-1.5 rounded-lg hover:bg-white/10 transition-colors ${isTileLocked('commissions') ? 'cursor-default text-white/5 opacity-30' : 'cursor-move text-white/10 hover:text-white/50'}`}
                    title="Verschieben"
                >
                    <Move size={18} />
                </button>
                <div className="flex items-center gap-2 flex-1">
                    <Factory size={20} className="text-emerald-400" />
                    <h2 className="text-xl font-bold text-white">Kommissionen</h2>
                </div>

                {/* Lock Button */}
                <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={() => toggleTileLock('commissions')}
                    className="p-2 bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors mr-2"
                    title={isTileLocked('commissions') ? "Kachel entsperren" : "Kachel sperren"}
                >
                    {isTileLocked('commissions') ? <Lock size={16} className="text-rose-500" /> : <Unlock size={16} />}
                </button>

                {/* Add Commission Button */}
                <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={() => setShowCreateCommissionModal(true)}
                    className="p-2 bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors mr-2"
                    title="Neue Kommission erstellen"
                >
                    <Plus size={18} />
                </button>

                {/* Fullscreen Toggle */}
                <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={() => setIsCommissionTileFullscreen(!isFullscreen)}
                    className="p-2 bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors mr-2"
                >
                    {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>

                <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={() => navigate('/commissions')}
                    className="text-white/40 hover:text-white"
                >
                    <ArrowRight size={20} />
                </button>
            </div>

            {/* Mobile Tabs */}
            <div className="flex md:hidden border-b border-white/10 shrink-0">
                <button
                    onClick={() => setMobileTab('open')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors relative ${mobileTab === 'open' ? 'text-white' : 'text-white/40'}`}
                >
                    Offen
                    {mobileTab === 'open' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />}
                </button>
                <button
                    onClick={() => setMobileTab('backlog')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors relative ${mobileTab === 'backlog' ? 'text-rose-400' : 'text-white/40'}`}
                >
                    Rückstand
                    {mobileTab === 'backlog' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500" />}
                </button>
                <button
                    onClick={() => setMobileTab('returns')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors relative ${mobileTab === 'returns' ? 'text-purple-400' : 'text-white/40'}`}
                >
                    Rückgabe
                    {mobileTab === 'returns' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />}
                </button>
            </div>

            <div className="flex-1 block md:grid md:grid-cols-3 md:divide-x divide-white/10 overflow-hidden relative">
                {/* Left: Offen (Open) */}
                <div className={`p-4 flex-col gap-3 bg-gradient-to-b from-white/5 to-transparent overflow-hidden h-full ${mobileTab === 'open' ? 'flex' : 'hidden md:flex'}`}>
                    <div className="flex justify-between items-center mb-2 shrink-0">
                        <span className="text-sm font-bold text-white">Aktion Büro ({openCommissions.length})</span>
                        {openCommissions.some(c => c.status === 'Ready' && !c.is_processed) && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleMarkAllAsRead(); }}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold transition-all border border-emerald-500/20"
                                title="Alle 'Bereit' als gelesen markieren"
                            >
                                <CheckCheck size={12} />
                                Alle gelesen
                            </button>
                        )}
                    </div>

                    <div className={`space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4`}>
                        {openCommissions.length === 0 && <div className="text-xs text-white/30 italic">Keine Aktionen offen.</div>}
                        {openCommissions.map((c: any) => {
                            const isReady = c.status === 'Ready' && !c.is_processed;
                            const isNew = !c.is_processed;
                            const hasFlag = c.is_price_inquiry || c.delivery_date_unknown;

                            return (
                                <div
                                    key={c.id}
                                    onClick={(e) => { e.stopPropagation(); setViewingCommission(c); }}
                                    className={`p-3 rounded-xl cursor-pointer transition-all relative group border ${
                                        isReady ? 'bg-emerald-500/10 border-emerald-500 animate-border-pulse-green' : 
                                        hasFlag ? 'bg-amber-500/10 border-amber-500/50 hover:bg-amber-500/20' : 
                                        'bg-white/5 border-white/10 hover:bg-white/10'
                                    }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0 flex-1 pr-2">
                                            <div className="font-bold text-white text-sm truncate">{c.name}</div>
                                            <div className="text-xs text-white/40 mt-0.5">{c.order_number}</div>
                                            
                                            {/* Flags Display */}
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {isReady && (
                                                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-900/40 px-2 py-1 rounded uppercase border border-emerald-500/40 animate-pulse tracking-wider">Termin vereinbaren</span>
                                                )}
                                                {c.is_price_inquiry && (
                                                    <span className="text-[9px] font-bold text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded uppercase border border-amber-500/20">Preisanfrage</span>
                                                )}
                                                {c.delivery_date_unknown && (
                                                    <span className="text-[9px] font-bold text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded uppercase border border-blue-500/20">Termin offen</span>
                                                )}
                                            </div>
                                        </div>
                                        {(isNew || isReady) && (
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shadow-lg shrink-0 ${isReady ? 'bg-emerald-400 text-emerald-950' : 'bg-emerald-500 text-white shadow-emerald-500/40'}`} title="Aktion erforderlich!">
                                                <Check size={10} strokeWidth={4} />
                                            </div>
                                        )}
                                    </div>
                                    {c.notes && <div className="mt-2 text-[10px] text-white/30 italic truncate">{c.notes}</div>}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Center: Rückstand (Backlog) */}
                <div className={`p-4 flex-col gap-3 relative overflow-hidden h-full ${mobileTab === 'backlog' ? 'flex' : 'hidden md:flex'}`}>
                    <div className="flex justify-between items-center mb-2 shrink-0">
                        <span className="text-sm font-bold text-rose-400">Rückstand ({backlogCommissions.length})</span>
                    </div>

                    <div className={`space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-10`}>
                        {backlogCommissions.length === 0 && <div className="text-xs text-white/30 italic">Kein Rückstand.</div>}
                        {backlogCommissions.map((c: any) => {
                            return (
                                <div
                                    key={c.id}
                                    onClick={(e) => { e.stopPropagation(); handleCommissionClick(c); }}
                                    className="p-3 rounded-xl cursor-pointer transition-all relative group border bg-rose-500/10 border-rose-500/50 hover:bg-rose-500/20"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0 flex-1 pr-2">
                                            <div className="font-bold text-white text-sm truncate">{c.name}</div>
                                            <div className="text-xs text-rose-200/60 mt-0.5">{c.order_number}</div>
                                        </div>
                                        <AlertTriangle size={14} className="text-rose-400 shrink-0" />
                                    </div>
                                    <div className="mt-2 text-[9px] font-bold text-rose-400 uppercase tracking-wide bg-rose-900/30 px-1.5 py-0.5 rounded inline-block">
                                        Rückstand!
                                    </div>
                                    {c.notes && <div className="mt-2 text-[10px] text-white/30 italic truncate">{c.notes}</div>}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Rückgaben (Returns) */}
                <div className={`p-4 flex-col gap-3 bg-gradient-to-b from-purple-500/5 to-transparent overflow-hidden h-full ${mobileTab === 'returns' ? 'flex' : 'hidden md:flex'}`}>
                    <div className="flex justify-between items-center mb-2 shrink-0">
                        <span className="text-sm font-bold text-purple-400">Rückgabe ({returnCommissions.length})</span>
                    </div>

                    <div className={`space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4`}>
                        {returnCommissions.length === 0 && <div className="text-xs text-white/30 italic">Keine offenen Rückgaben.</div>}
                        {returnCommissions.map(c => (
                            <div
                                key={c.id}
                                onClick={(e) => { e.stopPropagation(); handleCommissionClick(c); }}
                                className={`p-3 rounded-xl border cursor-pointer transition-all hover:bg-white/10 ${c.status === 'ReturnReady' ? 'bg-purple-500/20 border-purple-500 text-purple-100' : 'bg-white/5 border-purple-500/30'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="min-w-0">
                                        <div className="font-bold text-white text-sm truncate">{c.name}</div>
                                        <div className="text-xs text-white/40 mt-0.5">{c.order_number}</div>
                                        {c.status === 'ReturnReady' && <div className="mt-2 text-[10px] font-bold text-purple-300 bg-purple-900/40 px-2 py-1 rounded inline-block">ABHOLBEREIT</div>}
                                        {c.status === 'ReturnPending' && <div className="mt-2 text-[10px] font-bold text-orange-300 bg-orange-900/40 px-2 py-1 rounded inline-block">Wartet auf Lager</div>}
                                    </div>
                                    <Undo2 size={14} className="text-purple-400" />
                                </div>
                                {c.office_notes && (
                                    <div className="mt-2 p-1.5 bg-black/20 rounded-lg text-[10px] text-white/70 border border-white/5">
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

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInputMessage.trim() || !activeChannelId || !user) return;
        try {
            await supabase.from('messages').insert([{
                channel_id: activeChannelId,
                user_id: user.id,
                user_email: profile?.full_name || user.email,
                content: chatInputMessage.trim()
            }]);
            setChatInputMessage('');
            fetchChannelsData();
        } catch(e) { console.error(e); }
    };

    const toggleSubtask = async (subtaskId: string, currentCompleted: boolean) => {
        try {
            await supabase.from('subtasks').update({ completed: !currentCompleted }).eq('id', subtaskId);
            fetchTasksData();
        } catch(e) { console.error(e); }
    };

    const updateTaskStatus = async (taskId: string, status: string) => {
        try {
            await supabase.from('tasks').update({ status }).eq('id', taskId);
            fetchTasksData();
            if (status === 'done' && selectedDashboardTask?.id === taskId) {
               setSelectedDashboardTask(null);
            }
        } catch(e) { console.error(e); }
    };

    const renderTaskDetailNode = () => {
        if (!selectedDashboardTask) return null;
        return (
            <div className="space-y-6 flex flex-col h-full overflow-y-auto w-full">
                <div>
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-2xl font-bold text-white pr-4">{selectedDashboardTask.title}</h2>
                        <div className="flex bg-white/5 border border-white/10 rounded-lg overflow-hidden shrink-0 mt-1">
                            <button onClick={() => updateTaskStatus(selectedDashboardTask.id, 'todo')} className={`px-3 py-1.5 text-xs font-medium ${selectedDashboardTask.status === 'todo' ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white/70'} transition-colors`}>Offen</button>
                            <button onClick={() => updateTaskStatus(selectedDashboardTask.id, 'in_progress')} className={`px-3 py-1.5 text-xs font-medium border-l border-white/10 ${selectedDashboardTask.status === 'in_progress' ? 'bg-teal-500/20 text-teal-400' : 'text-white/40 hover:bg-white/5 hover:text-white/70'} transition-colors`}>In Arbeit</button>
                            <button onClick={() => updateTaskStatus(selectedDashboardTask.id, 'done')} className={`px-3 py-1.5 text-xs font-medium border-l border-white/10 ${selectedDashboardTask.status === 'done' ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/40 hover:bg-white/5 hover:text-white/70'} transition-colors`}>Erledigt</button>
                        </div>
                    </div>
                    {(() => {
                        let desc = selectedDashboardTask.description || '';
                        try {
                            const parsed = JSON.parse(selectedDashboardTask.description || '{}');
                            desc = parsed.text || desc;
                        } catch(e) {}
                        return desc ? <p className="text-white/70 whitespace-pre-wrap mt-4 bg-white/5 p-4 rounded-xl border border-white/10 leading-relaxed text-sm">{desc}</p> : null;
                    })()}
                </div>

                {selectedDashboardTask.subtasks && selectedDashboardTask.subtasks.length > 0 && (
                    <div>
                        <h3 className="text-sm font-bold text-white/50 mb-3 uppercase tracking-wider flex items-center gap-2">
                            <CheckCircle2 size={16}/> Arbeitspunkte
                        </h3>
                        <div className="space-y-2">
                            {selectedDashboardTask.subtasks.map((st: any) => (
                                <div key={st.id} onClick={() => toggleSubtask(st.id, st.completed)} className="group flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 hover:border-teal-500/30 transition-all">
                                    <div className="flex-shrink-0 mt-0.5">
                                        {st.completed ? <CheckCircle2 className="text-teal-400" size={20} /> : <Circle className="text-white/30 group-hover:text-white/50 transition-colors" size={20} />}
                                    </div>
                                    <span className={`text-sm font-medium transition-colors ${st.completed ? 'text-white/40 line-through' : 'text-white/90 group-hover:text-teal-300'}`}>{st.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/40">
                    <div className="flex items-center gap-1.5"><User size={14}/> {selectedDashboardTask.user_email?.split('@')[0] || 'Unbekannt'}</div>
                    <div>{new Date(selectedDashboardTask.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr</div>
                </div>

                <div className="mt-2 pt-4 flex justify-end">
                    <button onClick={() => setShowTaskAppIframe(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl text-white font-medium hover:opacity-90 transition-opacity">
                        <MessageSquare size={16}/> In Tasks-App öffnen
                    </button>
                </div>
            </div>
        );
    };

    const toggleTaskCollapse = (taskId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCollapsedTaskIds(prev => 
            prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
        );
    };

    const handleSplitResize = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isResizingTasks) return;
        const container = document.getElementById('tasks-tile-container');
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const newWidthPerc = ((clientX - rect.left) / rect.width) * 100;
        
        // Constraints
        setTasksTileSplit(Math.min(Math.max(newWidthPerc, 20), 80));
    }, [isResizingTasks, setTasksTileSplit]);

    const stopResizing = useCallback(() => setIsResizingTasks(false), []);

    useEffect(() => {
        if (isResizingTasks) {
            window.addEventListener('mousemove', handleSplitResize);
            window.addEventListener('mouseup', stopResizing);
            window.addEventListener('touchmove', handleSplitResize, { passive: false });
            window.addEventListener('touchend', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', handleSplitResize);
            window.removeEventListener('mouseup', stopResizing);
            window.removeEventListener('touchmove', handleSplitResize);
            window.removeEventListener('touchend', stopResizing);
        };
    }, [isResizingTasks, handleSplitResize, stopResizing]);

    const renderTasksTileContent = (isFullscreen: boolean) => (
        <div className="flex flex-col h-full bg-white/5 relative" id="tasks-tile-container">
            <div className={`px-6 py-5 border-b border-white/10 bg-white/5 backdrop-blur-xl flex justify-between items-center shrink-0`}>
                <div className="flex items-center gap-3">
                    <button
                        className={`drag-handle p-1.5 rounded-lg hover:bg-white/10 transition-colors ${isTileLocked('tasks') ? 'cursor-default text-white/5 opacity-30' : 'cursor-move text-white/10 hover:text-white/50'}`}
                        title="Verschieben"
                    >
                        <Move size={18} />
                    </button>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <MessageSquare size={20} className="text-teal-400" /> Aufgaben & Chat
                    </h2>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => toggleTileLock('tasks')} className="p-2 text-white/40 hover:text-white transition-colors">
                        {isTileLocked('tasks') ? <Lock size={16} className="text-rose-500" /> : <Unlock size={16} />}
                    </button>
                    <button onClick={() => setIsTasksTileFullscreen(!isFullscreen)} className="p-2 text-white/40 hover:text-white transition-colors h-10 w-10 flex items-center justify-center bg-white/5 rounded-lg border border-white/10">
                        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                    <button onClick={() => setShowTaskAppIframe(true)} className="text-white/40 hover:text-white h-10 px-3 bg-white/5 rounded-lg border border-white/10 flex items-center justify-center gap-2" title="App öffnen">
                        <ArrowRight size={18} />
                    </button>
                </div>
            </div>

            {!isFullscreen && (
                <div className="flex border-b border-white/10 shrink-0 bg-white/5">
                    <button onClick={() => setTasksTileTab('tasks')} className={`flex-1 py-3 text-xs font-bold uppercase transition-colors relative ${tasksTileTab === 'tasks' ? 'text-white' : 'text-white/40'}`}>
                        Aufgaben
                        {tasksTileTab === 'tasks' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />}
                    </button>
                    <button onClick={() => setTasksTileTab('chat')} className={`flex-1 py-3 text-xs font-bold uppercase transition-colors relative ${tasksTileTab === 'chat' ? 'text-white' : 'text-white/40'}`}>
                        <div className="flex items-center justify-center gap-2">
                            Chat {dashboardChannels.length > 0 && `(${dashboardChannels.length})`}
                            {dashboardChannels.some(c => (c.allMessages?.[0]?.created_at || '0') > (channelReadTimestamps[c.id] || '0')) && (
                                <span className="flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                </span>
                            )}
                        </div>
                        {tasksTileTab === 'chat' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />}
                    </button>
                </div>
            )}

            <div className={`flex-1 flex flex-col md:flex-row relative overflow-hidden`}>
                {/* TASKS */}
                <div 
                    style={{ width: isFullscreen ? `${tasksTileSplit}%` : (tasksTileTab === 'tasks' ? '100%' : '0%'), display: (isFullscreen || tasksTileTab === 'tasks') ? 'flex' : 'none' }}
                    className={`p-4 flex-col gap-3 overflow-hidden h-full border-r border-white/10`}
                >
                    <div className="flex justify-between items-center mb-2 shrink-0">
                        <span className="text-sm font-bold text-teal-400">Aufgaben ({dashboardTasks.length})</span>
                    </div>
                    <div className="space-y-2 overflow-y-auto pr-1 pb-4 flex-1 custom-scrollbar">
                        {dashboardTasks.length === 0 && <div className="text-xs text-white/30 italic">Keine Aufgaben.</div>}
                        {dashboardTasks.map(task => {
                            let details = { text: '' };
                            try { details = JSON.parse(task.description || '{}'); } catch(e) { details = { text: task.description || '' }; }
                            
                            const subtasks = task.subtasks || [];
                            const completedCount = subtasks.filter((s:any) => s.completed).length;
                            const totalCount = subtasks.length;
                            const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
                            const isCollapsed = collapsedTaskIds.includes(task.id);

                            return (
                                <div key={task.id} 
                                     onClick={(e) => { e.stopPropagation(); setSelectedDashboardTask(task); }}
                                     className={`cursor-pointer group flex flex-col p-3 rounded-2xl border transition-all flex-shrink-0 ${
                                        task.status === 'done' ? 'bg-emerald-500/10 border-emerald-500/20' : 
                                        task.status === 'in_progress' ? 'bg-teal-500/10 border-teal-500/20' : 'bg-white/5 border-white/10 hover:bg-white/10'
                                     }`}>
                                    
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className="rounded-full">
                                                {task.status === 'todo' && <Circle size={16} className="text-white/40" />}
                                                {task.status === 'in_progress' && <Clock size={16} className="text-teal-400" />}
                                                {task.status === 'done' && <CheckCircle2 size={16} className="text-emerald-400" />}
                                            </div>
                                            <h3 className={`font-semibold text-white text-sm truncate max-w-[150px] ${task.status === 'done' ? 'line-through text-white/40' : ''}`}>
                                                {task.title}
                                            </h3>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/60 border border-white/5">
                                                {task.status === 'todo' ? 'Offen' : task.status === 'in_progress' ? 'In Arbeit' : 'Erledigt'}
                                            </span>
                                            <button 
                                                onClick={(e) => toggleTaskCollapse(task.id, e)}
                                                className="p-1 hover:bg-white/10 rounded-lg text-white/30 hover:text-white transition-colors"
                                            >
                                                {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {!isCollapsed && (
                                        <div className="mt-2 animate-in slide-in-from-top-2 duration-200">
                                            {details.text && (
                                                <p className="mb-3 text-[11px] text-white/50 line-clamp-2">
                                                    {details.text}
                                                </p>
                                            )}
                                            
                                            {totalCount > 0 && (
                                                <div className="mb-2">
                                                    <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
                                                        <span>Progress</span>
                                                        <span>{completedCount}/{totalCount}</span>
                                                    </div>
                                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                        <div className="h-full bg-teal-500/60 rounded-full transition-all" style={{ width: `${progress}%` }} />
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div className="flex items-center justify-between text-[9px] text-white/30 pt-2 border-t border-white/5">
                                                <span>{task.user_email?.split('@')[0]}</span>
                                                <span>{new Date(task.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* RESIZER (only in fullscreen) */}
                {isFullscreen && (
                    <div 
                        onMouseDown={() => setIsResizingTasks(true)}
                        onTouchStart={() => setIsResizingTasks(true)}
                        className={`w-1.5 cursor-col-resize hover:bg-teal-500/50 transition-colors flex items-center justify-center group z-10 ${isResizingTasks ? 'bg-teal-500/50' : 'bg-transparent'}`}
                    >
                        <div className="h-8 w-0.5 bg-white/20 rounded-full group-hover:bg-teal-500/50" />
                    </div>
                )}

                {/* CHAT */}
                <div 
                    style={{ width: isFullscreen ? `${100 - tasksTileSplit}%` : (tasksTileTab === 'chat' ? '100%' : '0%'), display: (isFullscreen || tasksTileTab === 'chat') ? 'flex' : 'none' }}
                    className={`flex-col h-full overflow-hidden`}
                >
                    {!activeChannelId ? (
                        <div className="p-4 flex-col gap-3 h-full overflow-hidden flex">
                            <div className="flex justify-between items-center mb-2 shrink-0">
                                <span className="text-sm font-bold text-white">Kanäle</span>
                            </div>
                            <div className="space-y-4 overflow-y-auto pr-1 pb-4 flex-1 custom-scrollbar">
                                {dashboardChannels.length === 0 && <div className="text-xs text-white/30 italic">Keine Kanäle.</div>}
                                {(() => {
                                    // Group channels by category
                                    const grouped = dashboardChannels.reduce((acc: any, c) => {
                                        const cat = (c as any).category || 'Allgemein';
                                        if (!acc[cat]) acc[cat] = [];
                                        acc[cat].push(c);
                                        return acc;
                                    }, {});

                                    return Object.entries(grouped).map(([category, items]: [string, any]) => (
                                        <div key={category} className="space-y-2">
                                            <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-1">{category}</h4>
                                            <div className="space-y-2">
                                                {items.sort((a: any, b: any) => {
                                                    const latestA = a.allMessages?.[0]?.created_at || '0';
                                                    const latestB = b.allMessages?.[0]?.created_at || '0';
                                                    const unreadA = latestA > (channelReadTimestamps[a.id] || '0') ? 1 : 0;
                                                    const unreadB = latestB > (channelReadTimestamps[b.id] || '0') ? 1 : 0;
                                                    if (unreadA !== unreadB) return unreadB - unreadA;
                                                    return latestB.localeCompare(latestA); 
                                                }).map((c: any) => {
                                                    const isUnread = (c.allMessages?.[0]?.created_at || '0') > (channelReadTimestamps[c.id] || '0');
                                                    
                                                    return (
                                                        <div key={c.id} 
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                setActiveChannelId(c.id); 
                                                                if (c.allMessages?.[0]) {
                                                                    setChannelReadTimestamps(prev => ({ ...prev, [c.id]: c.allMessages[0].created_at }));
                                                                }
                                                            }} 
                                                            className={`cursor-pointer p-2.5 bg-white/5 rounded-xl border transition-all ${
                                                                isUnread ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'border-white/5 hover:border-teal-500/50'
                                                            }`}
                                                        >
                                                            <div className="font-bold text-white text-[13px] flex justify-between items-center gap-2">
                                                                <div className="flex items-center gap-2 truncate">
                                                                    <Hash size={12} className={isUnread ? 'text-emerald-400' : 'text-teal-400'}/> 
                                                                    <span className="truncate">{c.name}</span>
                                                                </div>
                                                                {isUnread && <span className="flex w-2 h-2 bg-emerald-500 rounded-full shrink-0"></span>}
                                                            </div>
                                                            {c.messages.length > 0 && (
                                                                <div className="mt-1.5 text-[10px] text-white/40 truncate">
                                                                    <span className={`${isUnread ? 'text-emerald-300' : 'text-teal-300'} mr-1`}>{c.messages[0].user_email?.split('@')[0]}:</span>
                                                                    {c.messages[0].content}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full bg-black/20">
                            <div className="p-3 border-b border-white/10 flex items-center gap-2 bg-white/5 shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); setActiveChannelId(null); }} className="p-1.5 hover:bg-teal-500/20 rounded-lg text-white/50 hover:text-teal-300 transition-colors">
                                    <ArrowRight size={16} className="rotate-180" />
                                </button>
                                <div className="font-bold text-white text-sm flex items-center gap-1">
                                    <Hash size={14} className="text-teal-400"/> 
                                    {dashboardChannels.find(c => c.id === activeChannelId)?.name}
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 flex flex-col-reverse gap-3 custom-scrollbar">
                                {dashboardChannels.find(c => c.id === activeChannelId)?.allMessages.map((m: any, idx: number, arr: any[]) => {
                                    const isMe = m.user_id === user?.id;
                                    const showHeader = idx === arr.length - 1 || arr[idx + 1].user_id !== m.user_id;

                                    return (
                                        <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                            {showHeader && (
                                                <span className="mb-0.5 px-1 text-[10px] font-medium text-white/50">
                                                    {isMe ? 'Ich' : m.user_email?.split('@')[0]}
                                                </span>
                                            )}
                                            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
                                                isMe ? 'rounded-tr-sm bg-gradient-to-r from-emerald-500/90 to-teal-600/90 text-white' 
                                                     : 'rounded-tl-sm border border-white/10 bg-white/10 text-white/90'
                                            } whitespace-pre-wrap`}>
                                                {m.content}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <form onSubmit={(e) => { e.stopPropagation(); handleSendMessage(e); }} className="p-3 border-t border-white/10 bg-white/5 flex gap-2 shrink-0">
                                <input 
                                    value={chatInputMessage} 
                                    onChange={e => setChatInputMessage(e.target.value)} 
                                    className="flex-1 bg-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-teal-500/50" 
                                    placeholder="Nachricht schreiben..."
                                />
                                <button type="submit" disabled={!chatInputMessage.trim()} className="p-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg text-white disabled:opacity-50 hover:opacity-90">
                                    <Send size={18}/>
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 pb-12">
            {/* HEADER */}
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                        {profile?.full_name ? `Moin, ${profile.full_name.split(' ')[0]}` : 'Dashboard'}
                    </h1>
                    <p className="text-white/50 text-sm mt-1">Aktueller Statusbericht</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowChangelogHistory(true)}
                        className="relative p-3 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 shadow-lg group"
                        title="Versionsverlauf anzeigen"
                    >
                        <History size={20} />
                        <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-black/50">
                            v0.0.70
                        </span>
                    </button>
                    <button
                        onClick={() => { fetchMachinesData(); fetchCommissionsData(); fetchRecentEvents(); }}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 shadow-lg"
                        title="Aktualisieren"
                    >
                        <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={() => setShowAppDrawer(true)}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 shadow-lg"
                    >
                        <Grid size={24} />
                    </button>
                </div>
            </header>

            {/* --- DASHBOARD GRID (Note: Split View Logic Added) --- */}

            {/* Fullscreen Overlay (unchanged) */}
            {isCommissionTileFullscreen && (
                <div className="fixed inset-4 z-[100]">
                    <GlassCard className="flex flex-col p-0 overflow-hidden border-none bg-gray-900/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl h-full" contentClassName="!p-0 flex flex-col h-full">
                        {renderCommissionTileContent(true)}
                    </GlassCard>
                </div>
            )}

            {isTasksTileFullscreen && (
                <div className="fixed inset-4 z-[100]">
                    <GlassCard className="flex flex-col p-0 overflow-hidden border-none bg-gray-900/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl h-full w-full mx-auto" contentClassName="!p-0 flex flex-col h-full w-full">
                        {renderTasksTileContent(true)}
                    </GlassCard>
                </div>
            )}

            <div className="flex flex-row h-[calc(100vh-140px)] overflow-hidden gap-4 pb-4">
                {/* LEFT: GRID AREA */}
                {(() => {
                    return (
                        <div
                            onClick={() => {
                                if (isSplitView) {
                                    setViewingCommission(null);
                                    setSelectedMachine(null);
                                    setSelectedKey(null);
                                    setSelectedDashboardTask(null);
                                    setShowChangelogHistory(false);
                                }
                            }}
                            className={`transition-all duration-300 ease-in-out h-full overflow-y-auto custom-scrollbar ${isSplitView ? 'w-[60%] pr-2' : 'w-full'}`}
                        >
                            <ResponsiveGridLayout
                                className="layout"
                                layouts={layouts}
                                // If split view, force 1 column for stacking
                                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                                cols={isSplitView ? { lg: 1, md: 1, sm: 1, xs: 1, xxs: 1 } : { lg: 4, md: 3, sm: 2, xs: 1, xxs: 1 }}
                                rowHeight={100}
                                onLayoutChange={handleLayoutChange}
                                isDraggable={!isCommissionTileFullscreen && !isSplitView}
                                isResizable={!isCommissionTileFullscreen && !isSplitView}
                                draggableHandle=".drag-handle"
                            >
                                {/* --- TILE 1: MASCHINENSTATUS --- */}
                                <div key="machines">
                                    <GlassCard className="flex flex-col h-full p-0 overflow-hidden border-none bg-white/5" contentClassName="!p-0 flex flex-col h-full">
                                        <div className={`px-6 py-5 border-b border-white/10 bg-white/5 backdrop-blur-xl flex justify-between items-center shrink-0`}>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    className={`drag-handle p-1.5 rounded-lg hover:bg-white/10 transition-colors ${isTileLocked('machines') ? 'cursor-default text-white/5 opacity-30' : 'cursor-move text-white/10 hover:text-white/50'}`}
                                                    title="Verschieben"
                                                >
                                                    <Move size={18} />
                                                </button>
                                                <h2 className="text-xl font-bold text-white">Maschinenstatus</h2>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onTouchStart={(e) => e.stopPropagation()}
                                                    onClick={() => toggleTileLock('machines')}
                                                    className="p-2 text-white/40 hover:text-white transition-colors"
                                                >
                                                    {isTileLocked('machines') ? <Lock size={16} className="text-rose-500" /> : <Unlock size={16} />}
                                                </button>
                                                <button
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onTouchStart={(e) => e.stopPropagation()}
                                                    onClick={() => navigate('/machines')}
                                                    className="text-white/40 hover:text-white"
                                                >
                                                    <ArrowRight size={20} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex-1 grid grid-cols-2 divide-x divide-white/10 overflow-hidden">
                                            {/* Left: Verliehen (Rented) */}
                                            <div className="p-4 flex flex-col gap-3 overflow-hidden h-full">
                                                <div className="flex justify-between items-center mb-2 shrink-0">
                                                    <span className="text-sm font-bold text-white">Verliehen ({rentedMachines.length})</span>
                                                </div>

                                                <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4">
                                                    {rentedMachines.length === 0 && <div className="text-xs text-white/30 italic">Keine Maschinen verliehen.</div>}
                                                    {rentedMachines.map(m => (
                                                        <div key={m.id} onClick={(e) => { e.stopPropagation(); setSelectedMachine(m); }} className="group cursor-pointer">
                                                            <div className="font-medium text-white text-sm group-hover:text-emerald-300 transition-colors truncate">{m.name}</div>
                                                            <div className="flex items-center gap-1.5 mt-1">
                                                                <User size={12} className="text-amber-400" />
                                                                <span className="text-xs text-white/50 truncate">{m.profiles?.full_name || m.externalBorrower || 'Unbekannt'}</span>
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
                                                    {repairMachines.length === 0 && <div className="text-xs text-white/30 italic">Keine Defekte.</div>}
                                                    {repairMachines.map(m => (
                                                        <div key={m.id} onClick={(e) => { e.stopPropagation(); setSelectedMachine(m); }} className="group cursor-pointer">
                                                            <div className="font-medium text-white text-sm group-hover:text-rose-300 transition-colors truncate">{m.name}</div>
                                                            <div className="flex items-center gap-1.5 mt-1">
                                                                <Wrench size={12} className="text-rose-500" />
                                                                <span className="text-xs text-white/50 truncate italic">{m.notes || 'Keine Notiz'}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </GlassCard>
                                </div>

                                {/* --- TILE 1.5: KEY STATUS (NEW) --- */}
                                <div key="keys">
                                    <GlassCard className="flex flex-col h-full p-0 overflow-hidden border-none bg-white/5" contentClassName="!p-0 flex flex-col h-full">
                                        <div className={`px-6 py-5 border-b border-white/10 bg-white/5 backdrop-blur-xl flex justify-between items-center shrink-0`}>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    className={`drag-handle p-1.5 rounded-lg hover:bg-white/10 transition-colors ${isTileLocked('keys') ? 'cursor-default text-white/5 opacity-30' : 'cursor-move text-white/10 hover:text-white/50'}`}
                                                    title="Verschieben"
                                                >
                                                    <Move size={18} />
                                                </button>
                                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                                    <KeyIcon size={20} className="text-amber-500" /> Ausgeliehen
                                                </h2>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onTouchStart={(e) => e.stopPropagation()}
                                                    onClick={() => toggleTileLock('keys')}
                                                    className="p-2 text-white/40 hover:text-white transition-colors"
                                                >
                                                    {isTileLocked('keys') ? <Lock size={16} className="text-rose-500" /> : <Unlock size={16} />}
                                                </button>
                                                <button
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onTouchStart={(e) => e.stopPropagation()}
                                                    onClick={() => navigate('/keys')}
                                                    className="text-white/40 hover:text-white"
                                                >
                                                    <ArrowRight size={20} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="p-4 flex flex-col gap-3 overflow-hidden h-full">
                                            <div className="flex justify-between items-center mb-2 shrink-0">
                                                <span className="text-sm font-bold text-white">Schlüssel in Verwendung ({rentedKeys.length})</span>
                                            </div>

                                            <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4">
                                                {rentedKeys.length === 0 && <div className="text-xs text-white/30 italic">Alle Schlüssel im Kasten.</div>}
                                                {rentedKeys.map(k => (
                                                    <div key={k.id} onClick={(e) => { e.stopPropagation(); setSelectedKey(k); }} className="group cursor-pointer p-2 rounded hover:bg-white/5 border border-transparent hover:border-white/5">
                                                        <div className="flex justify-between items-start">
                                                            <div className="font-medium text-white text-sm group-hover:text-amber-400 transition-colors truncate">{k.name}</div>
                                                            <span className="text-xs font-mono text-emerald-400">#{k.slot_number}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-1">
                                                            <User size={12} className="text-amber-500/70" />
                                                            <span className="text-xs text-white/50 truncate">{k.holder_name || 'Unbekannt'}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </GlassCard>
                                </div>

                                {/* --- TILE 2: KOMMISSIONEN --- */}
                                <div key="commissions">
                                    <GlassCard className={`flex flex-col h-full p-0 overflow-hidden border-none bg-white/5`} contentClassName="!p-0 flex flex-col h-full">
                                        {renderCommissionTileContent(false)}
                                    </GlassCard>
                                </div>

                                {/* --- TILE 3: EREIGNISLISTE --- */}
                                <div key="events">
                                    <GlassCard className="flex flex-col h-full p-0 overflow-hidden border-none bg-white/5" contentClassName="!p-0 flex flex-col h-full">
                                        <div className={`px-6 py-5 border-b border-white/10 bg-white/5 backdrop-blur-xl flex items-center gap-3 shrink-0`}>
                                            <button
                                                className={`drag-handle p-1.5 rounded-lg hover:bg-white/10 transition-colors ${isTileLocked('events') ? 'cursor-default text-white/5 opacity-30' : 'cursor-move text-white/10 hover:text-white/50'}`}
                                                title="Verschieben"
                                            >
                                                <Move size={18} />
                                            </button>
                                            <div className="flex-1 flex items-center gap-2">
                                                <StickyNote size={20} className="text-blue-400" />
                                                <h2 className="text-xl font-bold text-white">Letzte Aktivitäten</h2>
                                            </div>
                                            <button
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onTouchStart={(e) => e.stopPropagation()}
                                                onClick={() => toggleTileLock('events')}
                                                className="p-2 text-white/40 hover:text-white transition-colors"
                                            >
                                                {isTileLocked('events') ? <Lock size={16} className="text-rose-500" /> : <Unlock size={16} />}
                                            </button>
                                        </div>

                                        <div className="p-0 overflow-y-auto flex-1 min-h-0 pb-12">
                                            {recentEvents.length === 0 ? (
                                                <div className="p-8 text-center text-white/30 italic">
                                                    Noch keine Aktivitäten verzeichnet.
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-white/5">
                                                    {recentEvents.map((event) => (
                                                        <div key={`${event.type}-${event.id}`} className="p-4 flex items-start gap-4 hover:bg-white/5 transition-colors">
                                                            {/* Icon based on type */}
                                                            <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 
                                                                ${event.type === 'machine' ? 'bg-amber-500/10 text-amber-400' : ''}
                                                                ${event.type === 'commission' ? 'bg-emerald-500/10 text-emerald-400' : ''}
                                                                ${event.type === 'order' ? 'bg-purple-500/10 text-purple-400' : ''}
                                                                ${event.type === 'key' ? 'bg-blue-500/10 text-blue-400' : ''}
                                                            `}>
                                                                {event.type === 'machine' && <Wrench size={14} />}
                                                                {event.type === 'commission' && <CheckCircle2 size={14} />}
                                                                {event.type === 'order' && <ShoppingCart size={14} />}
                                                                {event.type === 'key' && <KeyIcon size={14} />}
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex justify-between items-start">
                                                                    <span className="text-sm font-bold text-white truncate">
                                                                        {event.user_name}
                                                                    </span>
                                                                    <span className="text-xs text-white/40 whitespace-nowrap ml-2">
                                                                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: de })}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm text-white/70 mt-0.5">
                                                                    <span className="font-medium text-white/50 uppercase text-[10px] tracking-wider mr-2 border border-white/10 px-1.5 py-0.5 rounded">
                                                                        {event.type === 'machine' ? 'Gerät' : event.type === 'commission' ? 'Kommission' : event.type === 'key' ? 'Schlüssel' : 'Bestellung'}
                                                                    </span>
                                                                    <span className="font-bold text-white mr-1">
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

                                {/* --- TILE 4: AUFGABEN & CHAT --- */}
                                <div key="tasks">
                                    <GlassCard className="flex flex-col h-full p-0 overflow-hidden border-none bg-white/5" contentClassName="!p-0 flex flex-col h-full relative">
                                        {renderTasksTileContent(false)}
                                    </GlassCard>
                                </div>
                            </ResponsiveGridLayout>
                            <div className="h-24" /> {/* Spacer */}
                        </div>
                    );
                })()}

                {/* RIGHT: DETAIL PANEL */}
                {(() => {
                    if (!isSplitView) return null;

                    return (
                        <div className="w-[40%] bg-transparent h-full animate-in slide-in-from-right-10 duration-300">
                            {/* MACHINE CONTENT */}
                            {selectedMachine && (
                                <div className="h-full bg-gray-900/50 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-xl overflow-hidden flex flex-col relative">
                                    <div className="absolute top-4 right-4 z-50">
                                        <button onClick={() => setSelectedMachine(null)} className="p-2 bg-black/50 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors">
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                                        <MachineDetailContent
                                            machine={selectedMachine}
                                            users={allUsers}
                                            onClose={() => setSelectedMachine(null)}
                                            onUpdate={() => {
                                                fetchMachinesData();
                                                fetchRecentEvents();
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* KEY CONTENT */}
                            {selectedKey && (
                                <div className="h-full bg-gray-900/50 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-xl overflow-hidden flex flex-col relative">
                                    {/* onClose is passed to content, but we can also add a close button here if header allows */}
                                    <KeyHandoverContent
                                        selectedKeys={[selectedKey]}
                                        type="return"
                                        onClose={() => setSelectedKey(null)}
                                        onSave={() => {
                                            fetchKeysData();
                                            fetchRecentEvents();
                                            setSelectedKey(null);
                                        }}
                                    />
                                </div>
                            )}

                            {/* TASK CONTENT */}
                            {selectedDashboardTask && (
                                <div className="h-full bg-gray-900/50 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-xl overflow-hidden flex flex-col relative">
                                    <div className="absolute top-4 right-4 z-[60]">
                                        <button onClick={() => setSelectedDashboardTask(null)} className="p-2 bg-black/50 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors">
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-12">
                                        {renderTaskDetailNode()}
                                    </div>
                                </div>
                            )}

                            {/* COMMISSION CONTENT */}
                            {viewingCommission && (
                                <div className="h-full bg-gray-900/50 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-xl overflow-hidden flex flex-col relative">
                                    {/* ... existing commission logic ... */}
                                    {/* Conditional Render based on Status */}
                                    {['Draft', 'Preparing'].includes(viewingCommission.status) ? (
                                        <CommissionDetailContent
                                            commission={viewingCommission}
                                            items={(viewingCommission as any).commission_items || []}
                                            localHistoryLogs={[]}
                                            allItemsPicked={false}
                                            hasBackorders={false}
                                            isSubmitting={false}
                                            onSetReady={() => toast.info("Bitte in der Kommissionierungs-Ansicht durchführen")}
                                            onWithdraw={() => toast.info("Bitte in der Kommissionierungs-Ansicht durchführen")}
                                            onResetStatus={() => toast.info("Bitte in der Kommissionierungs-Ansicht durchführen")}
                                            onRevertWithdraw={() => toast.info("Bitte in der Kommissionierungs-Ansicht durchführen")}
                                            onInitReturn={() => toast.info("Bitte in der Kommissionierungs-Ansicht durchführen")}
                                            onReturnToReady={() => toast.info("Bitte in der Kommissionierungs-Ansicht durchführen")}
                                            onCompleteReturn={() => toast.info("Bitte in der Kommissionierungs-Ansicht durchführen")}
                                            onEdit={(e) => {
                                                e.stopPropagation();
                                                setViewingCommission(null);
                                                navigate('/commissions', { state: { editCommissionId: viewingCommission.id } });
                                            }}
                                            onPrint={() => toast.info("Drucken...")}
                                            onTogglePicked={() => { }}
                                            onToggleBackorder={() => { }}
                                            onSaveNote={() => { }}
                                            onClose={() => setViewingCommission(null)}
                                            onSaveOfficeData={handleSaveOfficeData}
                                            onRequestCancellation={async (id, type, note) => {
                                                if (!window.confirm("Kommission wirklich stornieren?")) return;

                                                const instruction = type === 'restock' ? 'ACTION: ZURÜCK INS LAGER.' : 'ACTION: RETOURE AN LIEFERANT.';
                                                const fullNote = `${instruction} ${note ? `(${note})` : ''} [Storno: ${new Date().toLocaleDateString()}]`;
                                                const currentNotes = viewingCommission?.notes || '';
                                                const newNotes = currentNotes ? `${fullNote}\n${currentNotes}` : fullNote;

                                                try {
                                                    const { error } = await supabase.from('commissions').update({
                                                        status: 'ReturnPending',
                                                        is_processed: false,
                                                        notes: newNotes
                                                    }).eq('id', id);

                                                    if (error) throw error;

                                                    await supabase.from('commission_events').insert({
                                                        commission_id: id,
                                                        commission_name: viewingCommission?.name || 'Unbekannt',
                                                        event_type: 'status_change',
                                                        details: `Storno beauftragt: ${type === 'restock' ? 'Einlagern' : 'Lieferant'}`,
                                                        created_by: user?.id
                                                    });

                                                    setViewingCommission(null);
                                                    fetchRecentEvents();
                                                } catch (e) {
                                                    console.error(e);
                                                    alert("Fehler beim Stornieren");
                                                }
                                            }}
                                        />
                                    ) : (
                                        <CommissionOfficeContent
                                            commission={viewingCommission}
                                            onClose={() => setViewingCommission(null)}
                                            onSave={handleSaveOfficeData}
                                            isSaving={isSavingProcess}
                                        />
                                    )}
                                </div>
                            )}

                            {/* CHANGELOG CONTENT (New) */}
                            {showChangelogHistory && (
                                <div className="h-full bg-gray-900/50 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-xl overflow-hidden flex flex-col relative">
                                    <div className="absolute top-4 right-4 z-50">
                                        <button onClick={() => setShowChangelogHistory(false)} className="p-2 bg-black/50 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors">
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                                        <ChangelogHistoryContent />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>

            {/* --- MOBILE DETAIL MODALS --- */}
            {isMobile && (
                <>
                    <GlassModal
                        isOpen={!!selectedMachine}
                        onClose={() => setSelectedMachine(null)}
                        title="Maschinendetails"
                    >
                        {selectedMachine && (
                            <MachineDetailContent
                                machine={selectedMachine}
                                users={allUsers}
                                onClose={() => setSelectedMachine(null)}
                                onUpdate={() => {
                                    fetchMachinesData();
                                    fetchRecentEvents();
                                }}
                            />
                        )}
                    </GlassModal>

                    <GlassModal
                        isOpen={!!selectedKey}
                        onClose={() => setSelectedKey(null)}
                        title="Schlüsselrückgabe"
                    >
                        {selectedKey && (
                            <KeyHandoverContent
                                selectedKeys={[selectedKey]}
                                type="return"
                                onClose={() => setSelectedKey(null)}
                                onSave={() => {
                                    fetchKeysData();
                                    fetchRecentEvents();
                                    setSelectedKey(null);
                                }}
                            />
                        )}
                    </GlassModal>

                    <GlassModal
                        isOpen={!!viewingCommission}
                        onClose={() => setViewingCommission(null)}
                        title="Kommission"
                        fullScreen // Commissions might need more space
                    >
                        {viewingCommission && (
                            ['Draft', 'Preparing'].includes(viewingCommission.status) ? (
                                <CommissionDetailContent
                                    commission={viewingCommission}
                                    items={(viewingCommission as any).commission_items || []}
                                    localHistoryLogs={[]}
                                    allItemsPicked={false}
                                    hasBackorders={false}
                                    isSubmitting={false}
                                    onSetReady={() => toast.info("Bitte in der Kommissionierungs-Ansicht durchführen")}
                                    onWithdraw={() => toast.info("Bitte in der Kommissionierungs-Ansicht durchführen")}
                                    onResetStatus={() => toast.info("Bitte in der Kommissionierungs-Ansicht durchführen")}
                                    onRevertWithdraw={() => toast.info("Bitte in der Kommissionierungs-Ansicht durchführen")}
                                    onInitReturn={() => toast.info("Bitte in der Kommissionierungs-Ansicht durchführen")}
                                    onReturnToReady={() => toast.info("Bitte in der Kommissionierungs-Ansicht durchführen")}
                                    onCompleteReturn={() => toast.info("Bitte in der Kommissionierungs-Ansicht durchführen")}
                                    onEdit={(e) => {
                                        e.stopPropagation();
                                        setViewingCommission(null);
                                        navigate('/commissions', { state: { editCommissionId: viewingCommission.id } });
                                    }}
                                    onPrint={() => toast.info("Drucken...")}
                                    onTogglePicked={() => { }}
                                    onToggleBackorder={() => { }}
                                    onSaveNote={() => { }}
                                    onClose={() => setViewingCommission(null)}
                                    onSaveOfficeData={handleSaveOfficeData}
                                    onRequestCancellation={async (id, type, note) => {
                                        if (!window.confirm("Kommission wirklich stornieren?")) return;

                                        const instruction = type === 'restock' ? 'ACTION: ZURÜCK INS LAGER.' : 'ACTION: RETOURE AN LIEFERANT.';
                                        const fullNote = `${instruction} ${note ? `(${note})` : ''} [Storno: ${new Date().toLocaleDateString()}]`;
                                        const currentNotes = viewingCommission?.notes || '';
                                        const newNotes = currentNotes ? `${fullNote}\n${currentNotes}` : fullNote;

                                        try {
                                            const { error } = await supabase.from('commissions').update({
                                                status: 'ReturnPending',
                                                is_processed: false,
                                                notes: newNotes
                                            }).eq('id', id);

                                            if (error) throw error;

                                            await supabase.from('commission_events').insert({
                                                commission_id: id,
                                                commission_name: viewingCommission?.name || 'Unbekannt',
                                                event_type: 'status_change',
                                                details: `Storno beauftragt: ${type === 'restock' ? 'Einlagern' : 'Lieferant'}`,
                                                created_by: user?.id
                                            });

                                            setViewingCommission(null);
                                            fetchRecentEvents();
                                            // Ideally refresh stats too if they exist
                                        } catch (e) {
                                            console.error(e);
                                            alert("Fehler beim Stornieren");
                                        }
                                    }}
                                />
                            ) : (
                                <CommissionOfficeContent
                                    commission={viewingCommission}
                                    onClose={() => setViewingCommission(null)}
                                    onSave={handleSaveOfficeData}
                                    isSaving={isSavingProcess}
                                />
                            )
                        )}
                    </GlassModal>

                    <GlassModal
                        isOpen={showChangelogHistory}
                        onClose={() => setShowChangelogHistory(false)}
                        title="Update Verlauf"
                    >
                        <div className="max-h-[70vh] overflow-y-auto">
                            <ChangelogHistoryContent />
                        </div>
                    </GlassModal>
                </>
            )}


            {/* --- UTILITY MODALS (App Drawer & SQL Fix) --- */}

            {/* CREATE COMMISSION MODAL (Directly on Dashboard) */}
            {showCreateCommissionModal && (
                <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="w-full max-w-5xl h-[85vh] overflow-hidden rounded-2xl bg-[#0a0a0a] border border-white/10 shadow-2xl flex flex-col relative"
                    >
                        <CommissionEditContent
                            isEditMode={false}
                            initialCommission={null}
                            primaryWarehouseId={profile?.primary_warehouse_id || null}
                            availableArticles={availableArticles}
                            suppliers={suppliers}
                            onSave={() => { setShowCreateCommissionModal(false); fetchCommissionsData(); }}
                            onClose={() => setShowCreateCommissionModal(false)}
                        />
                    </div>
                </div>
            )}





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
                                        <div className="text-sm font-medium text-white">Layout zurücksetzen</div>
                                        <div className="text-xs text-white/40">Standard wiederherstellen</div>
                                    </div>
                                </div>
                                <Button onClick={resetLayout} variant="secondary" className="text-xs py-1 h-8">
                                    Reset
                                </Button>
                            </div>

                            {/* iOS Performance Mode Toggle */}
                            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${isLowPerfMode ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white/50'}`}>
                                        <Zap size={18} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-white">iOS Performance</div>
                                        <div className="text-xs text-white/40">{isLowPerfMode ? 'Aktiviert (schneller)' : 'Deaktiviert (Blur aktiv)'}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={toggleLowPerfMode}
                                    className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${isLowPerfMode ? 'bg-amber-500' : 'bg-gray-300'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${isLowPerfMode ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
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

                        {/* App: Image Optimizer */}
                        <button onClick={() => navigate('/image-optimizer')} className="flex flex-col items-center gap-2 group">
                            <div className="w-16 h-16 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center group-hover:bg-fuchsia-500/20 transition-colors">
                                <Wand2 size={28} className="text-fuchsia-400" />
                            </div>
                            <span className="text-xs text-white/70 group-hover:text-white text-center">Optimierer</span>
                        </button>

                        {/* App: Page Manager (NEW) */}
                        <button onClick={() => { setShowAppDrawer(false); setShowSidebarManager(true); }} className="flex flex-col items-center gap-2 group">
                            <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center group-hover:bg-teal-500/20 transition-colors">
                                <LayoutDashboard size={28} className="text-teal-400" />
                            </div>
                            <span className="text-xs text-white/70 group-hover:text-white text-center">Seiten</span>
                        </button>
                    </div>
                </div>
            </GlassModal>

            {/* SQL Manual Fix Modal */}
            {
                showSqlModal && (
                    <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
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
            {/* PAGE MANAGER MODAL */}
            {showSidebarManager && (
                <GlassModal
                    isOpen={showSidebarManager}
                    onClose={() => setShowSidebarManager(false)}
                    title="Seiten Verwaltung"
                >
                    <div className="p-6 space-y-6">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
                            <p className="text-sm text-white/60">
                                Hier kannst du entscheiden, welche Seiten in der Sidebar (und mobil unten) angezeigt werden und in welcher Reihenfolge.
                            </p>
                        </div>

                        {/* ACTIVE PAGES LIST (REORDERABLE) */}
                        <div>
                            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">Aktive Seiten ("Anzeige")</h3>
                            <div className="space-y-2">
                                {activeOrder.map((itemId, index) => {
                                    const item = ALL_NAV_ITEMS.find(i => i.id === itemId);
                                    if (!item) return null;

                                    return (
                                        <div key={itemId} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl group hover:bg-white/10 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="text-white/50">{item.icon}</div>
                                                <span className="font-medium text-white">{item.label}</span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {/* Reorder Buttons */}
                                                <div className="flex flex-col gap-0.5 mr-2">
                                                    <button
                                                        disabled={index === 0}
                                                        onClick={() => moveSidebarItem(index, 'up')}
                                                        className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white disabled:opacity-20"
                                                    >
                                                        <ChevronUp size={14} />
                                                    </button>
                                                    <button
                                                        disabled={index === activeOrder.length - 1}
                                                        onClick={() => moveSidebarItem(index, 'down')}
                                                        className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white disabled:opacity-20"
                                                    >
                                                        <ChevronDown size={14} />
                                                    </button>
                                                </div>

                                                <button
                                                    onClick={() => toggleSidebarItem(itemId)}
                                                    className="p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg transition-colors"
                                                    title="Ausblenden"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* INACTIVE PAGES LIST */}
                        <div>
                            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3 mt-6">Verfügbare Seiten ("Ausgeblendet")</h3>
                            <div className="space-y-2">
                                {ALL_NAV_ITEMS.filter(i => !activeOrder.includes(i.id)).length === 0 && (
                                    <div className="text-white/30 text-sm italic py-2">Alle Seiten sind aktiv.</div>
                                )}
                                {ALL_NAV_ITEMS.filter(i => !activeOrder.includes(i.id)).map(item => (
                                    <div key={item.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl opacity-60 hover:opacity-100 transition-opacity">
                                        <div className="flex items-center gap-3">
                                            <div className="text-white/50 grayscale">{item.icon}</div>
                                            <span className="font-medium text-white/70">{item.label}</span>
                                        </div>
                                        <button
                                            onClick={() => toggleSidebarItem(item.id)}
                                            className="p-2 bg-white/10 text-white/40 hover:bg-white/20 hover:text-white rounded-lg transition-colors"
                                            title="Einblenden"
                                        >
                                            <EyeOff size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
        </GlassModal>
            )}

            {/* Task Details Modal For Mobile */}
            {isMobile && (
                <GlassModal isOpen={!!selectedDashboardTask} onClose={() => setSelectedDashboardTask(null)} title="Aufgabendetails" fullScreen={isMobile}>
                    {selectedDashboardTask && (
                        <div className="w-[600px] max-w-full h-full">
                            {renderTaskDetailNode()}
                        </div>
                    )}
                </GlassModal>
            )}

            {/* Iframe Modal for Task App */}
            {showTaskAppIframe && (
                <GlassModal isOpen={showTaskAppIframe} onClose={() => setShowTaskAppIframe(false)} title="Tasks App" fullScreen={true}>
                    <div className="w-full h-full overflow-hidden flex flex-col pt-2">
                        <iframe 
                            src="https://task.rebeleinapp.de/" 
                            className="w-full h-full border-0 bg-white/5"
                            title="Tasks App Integration"
                        />
                    </div>
                </GlassModal>
            )}

        </div >
    );
};

export default Dashboard;
