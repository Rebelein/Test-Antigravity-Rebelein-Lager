import React, { useState } from 'react';
import { useDeviceMode } from '../../../hooks/useDeviceMode';
import { useAuth } from '../../../contexts/AuthContext';
import { useUserPreferences } from '../../../contexts/UserPreferencesContext';
import { CommissionEditContent } from '../../features/commissions/components/CommissionEditContent';
import { supabase } from '../../../supabaseClient';
import { Machine, Commission, Key } from '../../../types';
import { toast } from 'sonner';
import { useSuppliers, useArticles, useUsers } from '../../../hooks/queries';
import { SqlSetupModal } from '../../features/dashboard/components/modals/SqlSetupModal';
import { AppDrawerModal } from '../../features/dashboard/components/modals/AppDrawerModal';
import { PageManagerModal } from '../../features/dashboard/components/modals/PageManagerModal';
import { MachinesTile } from '../../features/dashboard/components/tiles/MachinesTile';
import { KeysTile } from '../../features/dashboard/components/tiles/KeysTile';
import { EventsTile } from '../../features/dashboard/components/tiles/EventsTile';
import { CommissionsTile } from '../../features/dashboard/components/tiles/CommissionsTile';
import { DashboardDetailContent } from '../../features/dashboard/components/DashboardDetailPanel';
import { useDashboardData } from '../../features/dashboard/hooks/useDashboardData';
import { useDashboardLayout, DashboardTileId } from '../../features/dashboard/hooks/useDashboardLayout';
import { DashboardToolbar } from '../../features/dashboard/components/DashboardToolbar';
import { QuickActions } from '../../features/dashboard/components/QuickActions';
import { DashboardCustomize } from '../../features/dashboard/components/DashboardCustomize';
import { MasterDetailLayout } from '../../components/MasterDetailLayout';
import { PageWrapper } from '../../components/ui/PageWrapper';

// --- CURATED DEVICE GRIDS (slot styles per tile position) ---
// The order of visible tiles determines which tile lands in which slot.

const SLOTS_TABLET_PORTRAIT: React.CSSProperties[] = [
    { gridColumn: '1 / -1' },                          // quick actions (full width)
    { gridColumn: '1', gridRow: '2' },                 // big left
    { gridColumn: '2', gridRow: '2' },                 // big right
    { gridColumn: '1', gridRow: '3' },                 // small left
    { gridColumn: '2', gridRow: '3' },                 // small right
    { gridColumn: '1 / -1', gridRow: '4' },            // full width bottom
];

const SLOTS_TABLET_LANDSCAPE: React.CSSProperties[] = [
    { gridColumn: '1 / -1' },                          // quick actions (full width)
    { gridColumn: '1', gridRow: '2 / span 3' },        // tall left
    { gridColumn: '2', gridRow: '2 / span 3' },        // tall center
    { gridColumn: '3', gridRow: '2' },                 // right 1
    { gridColumn: '3', gridRow: '3' },                 // right 2
    { gridColumn: '3', gridRow: '4' },                 // right 3
];

const SLOTS_DESKTOP: React.CSSProperties[] = [
    { gridColumn: '1 / -1' },                          // quick actions (full width)
    { gridColumn: '1 / span 7', gridRow: '2 / span 3' }, // hero (7/12)
    { gridColumn: '8 / span 5', gridRow: '2' },        // right top
    { gridColumn: '8 / span 3', gridRow: '3' },        // right middle (wide)
    { gridColumn: '11 / span 2', gridRow: '3' },       // right middle (narrow)
    { gridColumn: '8 / span 5', gridRow: '4' },        // right bottom
];

// Natural heights for the smartphone vertical stack
const MOBILE_TILE_HEIGHTS: Record<DashboardTileId, string> = {
    quickActions: 'auto',
    commissions: '480px',
    machines: '340px',
    keys: '300px',
    events: '420px',
};

const Dashboard: React.FC = () => {
    const { user, profile } = useAuth();
    const { primaryWarehouseId } = useUserPreferences();
    const device = useDeviceMode();

    const {
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
    } = useDashboardData();

    // Helper Data for Create Modal
    const { data: suppliers = [] } = useSuppliers();
    const { data: availableArticles = [] } = useArticles(primaryWarehouseId);
    const { data: allUsers = [] } = useUsers();

    // --- LAYOUT (curated + reorder/hide per device group) ---
    const {
        visibleTiles,
        hiddenTiles,
        setOrder,
        toggleHidden,
        resetLayout,
        isCustomized,
    } = useDashboardLayout();
    const [isCustomizing, setIsCustomizing] = useState(false);

    // --- SELECTION / DETAIL STATE ---
    const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
    const [selectedKey, setSelectedKey] = useState<Key | null>(null);
    const [viewingCommission, setViewingCommission] = useState<Commission | null>(null);
    const [showChangelogHistory, setShowChangelogHistory] = useState(false);

    // --- MODAL STATES ---
    const [showCreateCommissionModal, setShowCreateCommissionModal] = useState(false);
    const [showAppDrawer, setShowAppDrawer] = useState(false);
    const [showSqlModal, setShowSqlModal] = useState(false);
    const [showSidebarManager, setShowSidebarManager] = useState(false);
    const [isSavingProcess, setIsSavingProcess] = useState(false);

    const isDetailOpen = !!selectedMachine || !!selectedKey || !!viewingCommission || showChangelogHistory;

    const closeAllDetails = () => {
        setSelectedMachine(null);
        setSelectedKey(null);
        setViewingCommission(null);
        setShowChangelogHistory(false);
    };

    const detailTitle = selectedMachine?.name
        || (selectedKey ? `Schlüssel: ${selectedKey.name}` : null)
        || viewingCommission?.name
        || (showChangelogHistory ? 'Update Verlauf' : 'Details');

    // --- DATA ACTIONS ---

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
            fetchCommissionsData();
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

    // --- TILE RENDERING ---

    const renderTile = (tileId: DashboardTileId) => {
        switch (tileId) {
            case 'quickActions':
                return (
                    <QuickActions
                        officeCount={openCommissions.length}
                        backlogCount={backlogCommissions.length}
                        repairCount={repairMachines.length}
                        isCompact={device.isMobile}
                        onNewCommission={() => setShowCreateCommissionModal(true)}
                    />
                );
            case 'commissions':
                return (
                    <CommissionsTile
                        openCommissions={openCommissions}
                        backlogCommissions={backlogCommissions}
                        returnCommissions={returnCommissions}
                        onSelectCommission={setViewingCommission}
                        onCreateNew={() => setShowCreateCommissionModal(true)}
                        onMarkAllAsRead={handleMarkAllAsRead}
                    />
                );
            case 'machines':
                return (
                    <MachinesTile
                        rentedMachines={rentedMachines}
                        repairMachines={repairMachines}
                        onSelectMachine={setSelectedMachine}
                    />
                );
            case 'keys':
                return (
                    <KeysTile
                        rentedKeys={rentedKeys}
                        onSelectKey={setSelectedKey}
                    />
                );
            case 'events':
                return <EventsTile recentEvents={recentEvents} />;
            default:
                return null;
        }
    };

    // --- GRID AREA (curated per device mode) ---

    const renderGrid = () => {
        // SMARTPHONE: vertical stack with natural per-tile heights, page scrolls
        if (device.isMobile) {
            return (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    <div className="flex flex-col gap-4 pb-4">
                        {visibleTiles.map((tileId) => (
                            <div
                                key={tileId}
                                style={{ height: MOBILE_TILE_HEIGHTS[tileId] }}
                                className="shrink-0"
                            >
                                {renderTile(tileId)}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // TABLET / DESKTOP: fixed curated grid, fills available height
        const isTabletPortrait = device.isTabletPortrait;
        const isTabletLandscape = device.isTabletLandscape;

        const gridStyle: React.CSSProperties = isTabletPortrait
            ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridTemplateRows: 'auto minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 0.9fr)', gap: '1rem', height: '100%' }
            : isTabletLandscape
                ? { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridTemplateRows: 'auto repeat(3, minmax(0, 1fr))', gap: '1rem', height: '100%' }
                : { display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gridTemplateRows: 'auto repeat(3, minmax(0, 1fr))', gap: '1rem', height: '100%' };

        const slots = isTabletPortrait
            ? SLOTS_TABLET_PORTRAIT
            : isTabletLandscape
                ? SLOTS_TABLET_LANDSCAPE
                : SLOTS_DESKTOP;

        return (
            <div className="flex-1 min-h-0 overflow-hidden">
                <div style={gridStyle}>
                    {visibleTiles.slice(0, slots.length).map((tileId, index) => (
                        <div key={tileId} style={{ ...slots[index], minWidth: 0, minHeight: 0 }}>
                            {renderTile(tileId)}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // --- LIST CONTENT (toolbar + grid/customize) ---

    const listContent = (
        <div className="h-full flex flex-col gap-4 overflow-hidden">
            <DashboardToolbar
                profileName={profile?.full_name}
                isLoading={isLoading}
                isCustomized={isCustomized}
                onRefresh={fetchAllData}
                onShowHistory={() => setShowChangelogHistory(true)}
                onShowDrawer={() => setShowAppDrawer(true)}
                onToggleCustomize={() => setIsCustomizing(prev => !prev)}
            />
            {isCustomizing ? (
                <DashboardCustomize
                    visibleTiles={visibleTiles}
                    hiddenTiles={hiddenTiles}
                    onReorder={setOrder}
                    onToggleHidden={toggleHidden}
                    onReset={resetLayout}
                    onDone={() => setIsCustomizing(false)}
                />
            ) : (
                renderGrid()
            )}
        </div>
    );

    return (
        <PageWrapper>
            <>
                <MasterDetailLayout
                    isOpen={isDetailOpen}
                    onClose={closeAllDetails}
                    title={detailTitle}
                    contentClassName="p-0 overflow-y-auto custom-scrollbar h-full"
                    listContent={listContent}
                    detailContent={
                        <DashboardDetailContent
                            selectedMachine={selectedMachine}
                            selectedKey={selectedKey}
                            viewingCommission={viewingCommission}
                            showChangelogHistory={showChangelogHistory}
                            allUsers={allUsers}
                            isSavingProcess={isSavingProcess}
                            userId={user?.id}
                            onCloseMachine={() => setSelectedMachine(null)}
                            onCloseKey={() => setSelectedKey(null)}
                            onCloseCommission={() => setViewingCommission(null)}
                            onMachinesRefresh={fetchMachinesData}
                            onKeysRefresh={fetchKeysData}
                            onEventsRefresh={fetchRecentEvents}
                            onSaveOfficeData={handleSaveOfficeData}
                        />
                    }
                />

                {/* --- CREATE COMMISSION MODAL --- */}
                {showCreateCommissionModal && (
                    <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 dark:bg-black/30 bg-muted/70 backdrop-blur-sm">
                        <div
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            className="w-full max-w-5xl h-[85vh] overflow-hidden rounded-2xl bg-[#0a0a0a] border border-border shadow-2xl flex flex-col relative"
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

                {/* --- UTILITY MODALS --- */}
                <AppDrawerModal
                    isOpen={showAppDrawer}
                    onClose={() => setShowAppDrawer(false)}
                    onOpenCustomize={() => { setShowAppDrawer(false); setIsCustomizing(true); }}
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
            </>
        </PageWrapper>
    );
};

export default Dashboard;
