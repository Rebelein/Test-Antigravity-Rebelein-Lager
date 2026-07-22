import React from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Eye, EyeOff, RotateCcw, Check, Plus, Settings2 } from 'lucide-react';
import { DashboardTileId, TILE_LABELS } from '../hooks/useDashboardLayout';

interface DashboardCustomizeProps {
    visibleTiles: DashboardTileId[];
    hiddenTiles: DashboardTileId[];
    onReorder: (order: DashboardTileId[]) => void;
    onToggleHidden: (id: DashboardTileId) => void;
    onReset: () => void;
    onDone: () => void;
}

/** Single reorderable row – needs its own drag controls instance */
const CustomizeRow: React.FC<{
    tileId: DashboardTileId;
    onToggleHidden: (id: DashboardTileId) => void;
}> = ({ tileId, onToggleHidden }) => {
    const controls = useDragControls();

    return (
        <Reorder.Item
            value={tileId}
            dragListener={false}
            dragControls={controls}
            className="flex items-center gap-3 p-3 rounded-xl bg-card/80 backdrop-blur-md border border-border/80 select-none"
            whileDrag={{ scale: 1.02, boxShadow: '0 10px 30px rgba(0,0,0,0.35)' }}
        >
            <button
                onPointerDown={(e) => controls.start(e)}
                className="p-2 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-grab active:cursor-grabbing touch-none"
                title="Ziehen zum Sortieren"
            >
                <GripVertical size={18} />
            </button>
            <span className="flex-1 font-bold text-foreground text-sm truncate">{TILE_LABELS[tileId]}</span>
            <button
                onClick={() => onToggleHidden(tileId)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                title="Kachel ausblenden"
            >
                <Eye size={18} />
            </button>
        </Reorder.Item>
    );
};

export const DashboardCustomize: React.FC<DashboardCustomizeProps> = ({
    visibleTiles,
    hiddenTiles,
    onReorder,
    onToggleHidden,
    onReset,
    onDone,
}) => {
    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header bar */}
            <div className="flex items-center justify-between gap-2 mb-4 shrink-0 flex-wrap">
                <div className="flex items-center gap-2">
                    <Settings2 size={20} className="text-primary" />
                    <h2 className="text-xl font-bold text-foreground">Dashboard anpassen</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onReset}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted border border-border text-muted-foreground hover:text-foreground text-xs font-bold transition-colors"
                        title="Standard-Layout wiederherstellen"
                    >
                        <RotateCcw size={14} />
                        Zurücksetzen
                    </button>
                    <button
                        onClick={onDone}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 hover:opacity-90 transition-opacity"
                    >
                        <Check size={14} />
                        Fertig
                    </button>
                </div>
            </div>

            <p className="text-xs text-muted-foreground mb-4 shrink-0">
                Ziehe die Kacheln in die gewünschte Reihenfolge oder blende sie aus. Die Einstellungen gelten für diesen Gerätetyp.
            </p>

            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 pb-4">
                <Reorder.Group
                    axis="y"
                    values={visibleTiles}
                    onReorder={onReorder}
                    className="space-y-2 max-w-2xl"
                >
                    {visibleTiles.map(tileId => (
                        <CustomizeRow key={tileId} tileId={tileId} onToggleHidden={onToggleHidden} />
                    ))}
                </Reorder.Group>

                {/* Hidden tiles */}
                {hiddenTiles.length > 0 && (
                    <div className="mt-6 max-w-2xl">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                            <EyeOff size={14} /> Ausgeblendet
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {hiddenTiles.map(tileId => (
                                <button
                                    key={tileId}
                                    onClick={() => onToggleHidden(tileId)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card/50 border border-dashed border-border/80 text-muted-foreground hover:text-foreground hover:border-emerald-500/40 text-sm font-medium transition-all"
                                    title="Kachel wieder einblenden"
                                >
                                    <Plus size={14} />
                                    {TILE_LABELS[tileId]}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
