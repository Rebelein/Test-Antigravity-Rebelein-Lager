import { useMemo, useCallback, useEffect } from 'react';
import { usePersistentState } from '../../../../hooks/usePersistentState';
import { useDeviceMode } from '../../../../hooks/useDeviceMode';

// Legacy keys from the old react-grid-layout dashboard & removed chat/tasks – cleaned up once
const LEGACY_STORAGE_KEYS = ['dashboard_layouts', 'tasks_tile_split', 'channel_read_timestamps', 'dashboard_collapsed_tasks'];

export type DashboardTileId = 'quickActions' | 'commissions' | 'machines' | 'keys' | 'events';

type LayoutGroup = 'smartphone' | 'tablet' | 'desktop';

interface TileLayoutState {
    order: DashboardTileId[];
    hidden: DashboardTileId[];
}

export const TILE_LABELS: Record<DashboardTileId, string> = {
    quickActions: 'Schnellaktionen',
    commissions: 'Kommissionen',
    machines: 'Maschinen',
    keys: 'Schlüssel',
    events: 'Aktivitäten',
};

export const ALL_TILE_IDS = Object.keys(TILE_LABELS) as DashboardTileId[];

const DEFAULT_STATE: TileLayoutState = { order: ALL_TILE_IDS, hidden: [] };

// Migration: drop unknown ids, append new tiles that didn't exist when the user saved
const migrateTileLayout = (saved: any): TileLayoutState => {
    if (!saved || !Array.isArray(saved.order)) return DEFAULT_STATE;
    const order = saved.order.filter((id: string) => ALL_TILE_IDS.includes(id as DashboardTileId));
    ALL_TILE_IDS.forEach(id => { if (!order.includes(id)) order.push(id); });
    const hidden = Array.isArray(saved.hidden)
        ? saved.hidden.filter((id: string) => ALL_TILE_IDS.includes(id as DashboardTileId))
        : [];
    return { order, hidden };
};

export const useDashboardLayout = () => {
    const device = useDeviceMode();
    const group: LayoutGroup = device.isMobile ? 'smartphone' : device.isTablet ? 'tablet' : 'desktop';

    const [layout, setLayout] = usePersistentState<TileLayoutState>(
        `dashboard-v2-layout-${group}`,
        DEFAULT_STATE,
        { migrate: migrateTileLayout }
    );

    // One-time cleanup of legacy localStorage keys from the old dashboard
    useEffect(() => {
        try {
            LEGACY_STORAGE_KEYS.forEach(key => window.localStorage.removeItem(key));
        } catch { /* ignore */ }
    }, []);

    const visibleTiles = useMemo(
        () => layout.order.filter(id => !layout.hidden.includes(id)),
        [layout]
    );
    const hiddenTiles = useMemo(
        () => layout.order.filter(id => layout.hidden.includes(id)),
        [layout]
    );

    const setOrder = useCallback(
        (order: DashboardTileId[]) => setLayout(prev => ({ ...prev, order })),
        [setLayout]
    );

    const toggleHidden = useCallback(
        (id: DashboardTileId) => setLayout(prev => ({
            ...prev,
            hidden: prev.hidden.includes(id)
                ? prev.hidden.filter(h => h !== id)
                : [...prev.hidden, id]
        })),
        [setLayout]
    );

    const resetLayout = useCallback(() => setLayout(DEFAULT_STATE), [setLayout]);

    const isCustomized =
        layout.hidden.length > 0 || layout.order.some((id, idx) => id !== ALL_TILE_IDS[idx]);

    return {
        group,
        visibleTiles,
        hiddenTiles,
        setOrder,
        toggleHidden,
        resetLayout,
        isCustomized,
    };
};
