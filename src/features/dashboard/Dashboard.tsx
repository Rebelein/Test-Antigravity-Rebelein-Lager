import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GlassCard, StatusBadge, Button, GlassModal } from '../../components/UIComponents';
import { AlertTriangle, Wrench, User, ArrowRight, Grid, X, RefreshCw, Check, Factory, Maximize2, Minimize2, Plus, MessageSquare, Lock, Unlock, History, Move, Hash, Send, CheckCheck, CheckCircle2, Circle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { usePersistentState } from '../../../hooks/usePersistentState';
import { initializeDatabase, MANUAL_SETUP_SQL } from '../../../utils/dbInit';
import { useAuth } from '../../../contexts/AuthContext';
import { useUserPreferences } from '../../../contexts/UserPreferencesContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { CommissionDetailContent } from '../../features/commissions/components/CommissionDetailContent';
import { MachineDetailContent } from '../../features/machines/components/MachineDetailContent';
import { KeyHandoverContent } from '../../features/keys/components/KeyComponents';
import { ChangelogHistoryContent } from '../../components/ChangelogHistoryContent'; // Updated Import
import { supabase } from '../../../supabaseClient';
import { Machine, MachineStatus, Commission, UserProfile, Key, Article, Supplier } from '../../../types';
import { CommissionEditContent } from '../../features/commissions/components/CommissionEditContent';
import { CommissionOfficeContent } from '../../components/CommissionOfficeContent';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { toast } from 'sonner'; // Added toast import
import { Key as KeyIcon } from 'lucide-react'; // Added KeyIcon
import { ALL_NAV_ITEMS, DEFAULT_SIDEBAR_ORDER } from '../../components/NavConfig';
import { useSuppliers, useArticles, useUsers } from '../../../hooks/queries';
import { SqlSetupModal } from '../../features/dashboard/components/modals/SqlSetupModal';
import { AppDrawerModal } from '../../features/dashboard/components/modals/AppDrawerModal';
import { PageManagerModal } from '../../features/dashboard/components/modals/PageManagerModal';
import { MachinesTile } from '../../features/dashboard/components/tiles/MachinesTile';
import { KeysTile } from '../../features/dashboard/components/tiles/KeysTile';
import { EventsTile } from '../../features/dashboard/components/tiles/EventsTile';
import { CommissionsTile } from '../../features/dashboard/components/tiles/CommissionsTile';
import { TasksTile } from '../../features/dashboard/components/tiles/TasksTile';
import { DashboardDetailPanel, TaskDetailContent } from '../../features/dashboard/components/DashboardDetailPanel';
import { useDashboardData } from '../../features/dashboard/hooks/useDashboardData';
import { DashboardToolbar } from '../../features/dashboard/components/DashboardToolbar';

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

    const {
        isLoading,
        rentedMachines,
        repairMachines,
        rentedKeys,
        openCommissions,
        backlogCommissions,
        returnCommissions,
        recentEvents,
        dashboardTasks,
        dashboardChannels,
        selectedDashboardTask,
        setSelectedDashboardTask,
        fetchAllData,
        fetchTasksData,
        fetchChannelsData,
        fetchCommissionsData,
        fetchMachinesData,
        fetchKeysData,
        fetchRecentEvents
    } = useDashboardData();

    // Helper Data for Create Modal
    const { data: suppliers = [] } = useSuppliers();
    const { data: availableArticles = [] } = useArticles(primaryWarehouseId);
    const [showCreateCommissionModal, setShowCreateCommissionModal] = useState(false);

    // Split View / Modal States for Machines & Keys
    const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
    const [selectedKey, setSelectedKey] = useState<Key | null>(null);
    const { data: allUsers = [] } = useUsers();
    
    // UI Local State
    const [isTasksTileFullscreen, setIsTasksTileFullscreen] = useState(false);
    const [showTaskAppIframe, setShowTaskAppIframe] = useState(false);

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

    // --- TASK HELPERS (used by DashboardDetailPanel) ---
    const updateTaskStatus = async (taskId: string, status: string) => {
        try {
            await supabase.from('tasks').update({ status }).eq('id', taskId);
            fetchTasksData();
            if (status === 'done' && selectedDashboardTask?.id === taskId) {
                setSelectedDashboardTask(null);
            }
        } catch (e) { console.error(e); }
    };

    const toggleSubtask = async (subtaskId: string, currentCompleted: boolean) => {
        try {
            await supabase.from('subtasks').update({ completed: !currentCompleted }).eq('id', subtaskId);
            fetchTasksData();
        } catch (e) { console.error(e); }
    };

    return (
        <div className="space-y-6 pb-12">
            {/* HEADER */}
            <DashboardToolbar 
                profileName={profile?.full_name}
                isLoading={isLoading}
                onRefresh={fetchAllData}
                onShowHistory={() => setShowChangelogHistory(true)}
                onShowDrawer={() => setShowAppDrawer(true)}
            />

            {/* --- DASHBOARD GRID (Note: Split View Logic Added) --- */}

            {/* Fullscreen Overlays */}
            {isCommissionTileFullscreen && (
                <div className="fixed inset-4 z-[100]">
                    <GlassCard className="flex flex-col p-0 overflow-hidden border-none bg-gray-900/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl h-full" contentClassName="!p-0 flex flex-col h-full">
                        <CommissionsTile
                            openCommissions={openCommissions}
                            backlogCommissions={backlogCommissions}
                            returnCommissions={returnCommissions}
                            isLocked={isTileLocked('commissions')}
                            isFullscreen={true}
                            mobileTab={mobileTab}
                            onToggleLock={() => toggleTileLock('commissions')}
                            onToggleFullscreen={() => setIsCommissionTileFullscreen(false)}
                            onSelectCommission={setViewingCommission}
                            onCreateNew={() => setShowCreateCommissionModal(true)}
                            onMarkAllAsRead={handleMarkAllAsRead}
                            onMobileTabChange={setMobileTab}
                        />
                    </GlassCard>
                </div>
            )}

            {isTasksTileFullscreen && (
                <div className="fixed inset-4 z-[100]">
                    <GlassCard className="flex flex-col p-0 overflow-hidden border-none bg-gray-900/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl h-full w-full mx-auto" contentClassName="!p-0 flex flex-col h-full w-full">
                        <TasksTile
                            tasks={dashboardTasks}
                            channels={dashboardChannels}
                            userId={user?.id}
                            userDisplayName={profile?.full_name || user?.email}
                            isLocked={isTileLocked('tasks')}
                            isFullscreen={true}
                            onToggleLock={() => toggleTileLock('tasks')}
                            onToggleFullscreen={() => setIsTasksTileFullscreen(false)}
                            onSelectTask={setSelectedDashboardTask}
                            onOpenApp={() => setShowTaskAppIframe(true)}
                            onTasksRefresh={fetchTasksData}
                            onChannelsRefresh={fetchChannelsData}
                        />
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
                                    <MachinesTile
                                        rentedMachines={rentedMachines}
                                        repairMachines={repairMachines}
                                        isLocked={isTileLocked('machines')}
                                        onToggleLock={() => toggleTileLock('machines')}
                                        onSelectMachine={setSelectedMachine}
                                    />
                                </div>

                                {/* --- TILE 1.5: KEY STATUS (NEW) --- */}
                                <div key="keys">
                                    <KeysTile
                                        rentedKeys={rentedKeys}
                                        isLocked={isTileLocked('keys')}
                                        onToggleLock={() => toggleTileLock('keys')}
                                        onSelectKey={setSelectedKey}
                                    />
                                </div>

                                {/* --- TILE 2: KOMMISSIONEN --- */}
                                <div key="commissions">
                                    <CommissionsTile
                                        openCommissions={openCommissions}
                                        backlogCommissions={backlogCommissions}
                                        returnCommissions={returnCommissions}
                                        isLocked={isTileLocked('commissions')}
                                        isFullscreen={false}
                                        mobileTab={mobileTab}
                                        onToggleLock={() => toggleTileLock('commissions')}
                                        onToggleFullscreen={() => setIsCommissionTileFullscreen(true)}
                                        onSelectCommission={setViewingCommission}
                                        onCreateNew={() => setShowCreateCommissionModal(true)}
                                        onMarkAllAsRead={handleMarkAllAsRead}
                                        onMobileTabChange={setMobileTab}
                                    />
                                </div>

                                {/* --- TILE 3: EREIGNISLISTE --- */}
                                <div key="events">
                                    <EventsTile
                                        recentEvents={recentEvents}
                                        isLocked={isTileLocked('events')}
                                        onToggleLock={() => toggleTileLock('events')}
                                    />
                                </div>

                                {/* --- TILE 4: AUFGABEN & CHAT --- */}
                                <div key="tasks">
                                    <TasksTile
                                        tasks={dashboardTasks}
                                        channels={dashboardChannels}
                                        userId={user?.id}
                                        userDisplayName={profile?.full_name || user?.email}
                                        isLocked={isTileLocked('tasks')}
                                        isFullscreen={false}
                                        onToggleLock={() => toggleTileLock('tasks')}
                                        onToggleFullscreen={() => setIsTasksTileFullscreen(true)}
                                        onSelectTask={setSelectedDashboardTask}
                                        onOpenApp={() => setShowTaskAppIframe(true)}
                                        onTasksRefresh={fetchTasksData}
                                        onChannelsRefresh={fetchChannelsData}
                                    />
                                </div>
                            </ResponsiveGridLayout>
                            <div className="h-24" /> {/* Spacer */}
                        </div>
                    );
                })()}

                {/* RIGHT: DETAIL PANEL */}
                {isSplitView && (
                    <DashboardDetailPanel
                        selectedMachine={selectedMachine}
                        selectedKey={selectedKey}
                        viewingCommission={viewingCommission}
                        selectedDashboardTask={selectedDashboardTask}
                        showChangelogHistory={showChangelogHistory}
                        allUsers={allUsers}
                        isSavingProcess={isSavingProcess}
                        userId={user?.id}
                        onCloseMachine={() => setSelectedMachine(null)}
                        onCloseKey={() => setSelectedKey(null)}
                        onCloseCommission={() => setViewingCommission(null)}
                        onCloseTask={() => setSelectedDashboardTask(null)}
                        onCloseChangelog={() => setShowChangelogHistory(false)}
                        onMachinesRefresh={fetchMachinesData}
                        onKeysRefresh={fetchKeysData}
                        onEventsRefresh={fetchRecentEvents}
                        onSaveOfficeData={handleSaveOfficeData}
                        onUpdateTask={updateTaskStatus}
                        onToggleSubtask={toggleSubtask}
                        onOpenTaskApp={() => setShowTaskAppIframe(true)}
                    />
                )}

            </div>



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





            <AppDrawerModal
                isOpen={showAppDrawer}
                onClose={() => setShowAppDrawer(false)}
                onResetLayout={resetLayout}
                onOpenSqlModal={() => setShowSqlModal(true)}
                onOpenPageManager={() => setShowSidebarManager(true)}
            />

            <SqlSetupModal
                isOpen={showSqlModal}
                onClose={() => setShowSqlModal(false)}
                onSuccess={() => {
                    fetchMachinesData();
                    fetchCommissionsData();
                }}
            />

            <PageManagerModal
                isOpen={showSidebarManager}
                onClose={() => setShowSidebarManager(false)}
            />

            {/* Task Details Modal For Mobile */}
            {isMobile && (
                <GlassModal isOpen={!!selectedDashboardTask} onClose={() => setSelectedDashboardTask(null)} title="Aufgabendetails" fullScreen={isMobile}>
                    {selectedDashboardTask && (
                        <div className="w-[600px] max-w-full h-full">
                            <TaskDetailContent 
                                task={selectedDashboardTask}
                                onUpdateStatus={updateTaskStatus}
                                onToggleSubtask={toggleSubtask}
                                onOpenApp={() => setShowTaskAppIframe(true)}
                            />
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
