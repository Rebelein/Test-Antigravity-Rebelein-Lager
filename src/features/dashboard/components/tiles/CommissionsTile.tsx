import React from 'react';
import {
    ArrowRight, Plus, AlertTriangle, Check, CheckCheck, Factory, Undo2
} from 'lucide-react';
import { DashboardTile } from '../DashboardTile';
import { Commission } from '../../../../../types';
import { useDeviceMode } from '../../../../../hooks/useDeviceMode';
import { usePersistentState } from '../../../../../hooks/usePersistentState';

interface CommissionsTileProps {
    openCommissions: Commission[];
    backlogCommissions: Commission[];
    returnCommissions: Commission[];
    onSelectCommission: (c: Commission) => void;
    onCreateNew: () => void;
    onMarkAllAsRead: () => void;
}

type CommTab = 'open' | 'backlog' | 'returns';

const TAB_CONFIG: { id: CommTab; label: string; activeClass: string; barClass: string }[] = [
    { id: 'open', label: 'Büro', activeClass: 'text-foreground', barClass: 'bg-primary' },
    { id: 'backlog', label: 'Rückstand', activeClass: 'dark:text-rose-400 text-rose-800', barClass: 'bg-rose-500' },
    { id: 'returns', label: 'Rückgabe', activeClass: 'text-purple-400', barClass: 'bg-purple-500' },
];

export const CommissionsTile: React.FC<CommissionsTileProps> = React.memo(({
    openCommissions,
    backlogCommissions,
    returnCommissions,
    onSelectCommission,
    onCreateNew,
    onMarkAllAsRead,
}) => {
    const device = useDeviceMode();
    const showColumns = device.isDesktop; // Desktop: 3 columns side by side, else tabs
    const [activeTab, setActiveTab] = usePersistentState<CommTab>('dashboard-commissions-tab', 'open');

    const totalCount = openCommissions.length + backlogCommissions.length + returnCommissions.length;

    // --- Column renderers (shared between tab view and 3-column view) ---

    const renderOpenColumn = () => (
        <div className="p-4 flex flex-col gap-3 bg-gradient-to-b from-white/5 to-transparent overflow-hidden h-full">
            <div className="flex justify-between items-center mb-2 shrink-0">
                <span className="text-sm font-bold text-foreground">Aktion Büro ({openCommissions.length})</span>
                {openCommissions.some(c => c.status === 'Ready' && !c.is_processed) && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onMarkAllAsRead(); }}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 dark:text-emerald-400 text-emerald-800 text-[10px] font-bold transition-all border border-emerald-500/20"
                        title="Alle 'Bereit' als gelesen markieren"
                    >
                        <CheckCheck size={12} />
                        Alle gelesen
                    </button>
                )}
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4 custom-scrollbar">
                {openCommissions.length === 0 && <div className="text-xs text-muted-foreground italic">Keine Aktionen offen.</div>}
                {openCommissions.map((c: any) => {
                    const isReady = c.status === 'Ready' && !c.is_processed;
                    const isNew = !c.is_processed;
                    const hasFlag = c.is_price_inquiry || c.delivery_date_unknown;

                    return (
                        <div
                            key={c.id}
                            onClick={(e) => { e.stopPropagation(); onSelectCommission(c); }}
                            className={`p-3 rounded-xl cursor-pointer transition-all relative group border ${
                                isReady ? 'bg-primary/10 border-emerald-500 animate-border-pulse-green' :
                                hasFlag ? 'bg-amber-500/10 border-amber-500/50 hover:bg-amber-500/20' :
                                'bg-white/[0.03] border-border/60 hover:bg-white/[0.06]'
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="min-w-0 flex-1 pr-2">
                                    <div className="font-bold text-foreground text-sm truncate">{c.name}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">{c.order_number}</div>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {isReady && (
                                            <span className="text-[10px] font-black dark:text-emerald-400 text-emerald-800 bg-emerald-900/40 px-2 py-1 rounded uppercase border border-emerald-500/40 animate-pulse tracking-wider">Termin vereinbaren</span>
                                        )}
                                        {c.is_price_inquiry && (
                                            <span className="text-[9px] font-bold dark:text-amber-400 text-amber-800 bg-amber-900/30 px-1.5 py-0.5 rounded uppercase border border-amber-500/20">Preisanfrage</span>
                                        )}
                                        {c.delivery_date_unknown && (
                                            <span className="text-[9px] font-bold dark:text-blue-400 text-blue-800 bg-blue-900/30 px-1.5 py-0.5 rounded uppercase border border-blue-500/20">Termin offen</span>
                                        )}
                                    </div>
                                </div>
                                {(isNew || isReady) && (
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shadow-lg shrink-0 ${isReady ? 'bg-primary text-emerald-950' : 'bg-primary text-white shadow-emerald-500/40'}`} title="Aktion erforderlich!">
                                        <Check size={10} strokeWidth={4} />
                                    </div>
                                )}
                            </div>
                            {c.notes && <div className="mt-2 text-[10px] text-muted-foreground italic truncate">{c.notes}</div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderBacklogColumn = () => (
        <div className="p-4 flex flex-col gap-3 relative overflow-hidden h-full">
            <div className="flex justify-between items-center mb-2 shrink-0">
                <span className="text-sm font-bold dark:text-rose-400 text-rose-800">Rückstand ({backlogCommissions.length})</span>
            </div>
            <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4 custom-scrollbar">
                {backlogCommissions.length === 0 && <div className="text-xs text-muted-foreground italic">Kein Rückstand.</div>}
                {backlogCommissions.map((c: any) => (
                    <div
                        key={c.id}
                        onClick={(e) => { e.stopPropagation(); onSelectCommission(c); }}
                        className="p-3 rounded-xl cursor-pointer transition-all relative group border bg-rose-500/10 border-rose-500/50 hover:bg-rose-500/20"
                    >
                        <div className="flex justify-between items-start">
                            <div className="min-w-0 flex-1 pr-2">
                                <div className="font-bold text-foreground text-sm truncate">{c.name}</div>
                                <div className="text-xs text-rose-200/60 mt-0.5">{c.order_number}</div>
                            </div>
                            <AlertTriangle size={14} className="dark:text-rose-400 text-rose-800 shrink-0" />
                        </div>
                        <div className="mt-2 text-[9px] font-bold dark:text-rose-400 text-rose-800 uppercase tracking-wide bg-rose-900/30 px-1.5 py-0.5 rounded inline-block">
                            Rückstand!
                        </div>
                        {c.notes && <div className="mt-2 text-[10px] text-muted-foreground italic truncate">{c.notes}</div>}
                    </div>
                ))}
            </div>
        </div>
    );

    const renderReturnsColumn = () => (
        <div className="p-4 flex flex-col gap-3 bg-gradient-to-b from-purple-500/5 to-transparent overflow-hidden h-full">
            <div className="flex justify-between items-center mb-2 shrink-0">
                <span className="text-sm font-bold text-purple-400">Rückgabe ({returnCommissions.length})</span>
            </div>
            <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4 custom-scrollbar">
                {returnCommissions.length === 0 && <div className="text-xs text-muted-foreground italic">Keine offenen Rückgaben.</div>}
                {returnCommissions.map(c => (
                    <div
                        key={c.id}
                        onClick={(e) => { e.stopPropagation(); onSelectCommission(c); }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${c.status === 'ReturnReady' ? 'bg-purple-500/20 border-purple-500 text-purple-100' : 'bg-white/[0.03] border-purple-500/30 hover:bg-white/[0.06]'}`}
                    >
                        <div className="flex justify-between items-start">
                            <div className="min-w-0">
                                <div className="font-bold text-foreground text-sm truncate">{c.name}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">{c.order_number}</div>
                                {c.status === 'ReturnReady' && <div className="mt-2 text-[10px] font-bold dark:text-purple-300 text-purple-800 bg-purple-900/40 px-2 py-1 rounded inline-block">ABHOLBEREIT</div>}
                                {c.status === 'ReturnPending' && <div className="mt-2 text-[10px] font-bold text-orange-300 bg-orange-900/40 px-2 py-1 rounded inline-block">Wartet auf Lager</div>}
                            </div>
                            <Undo2 size={14} className="text-purple-400" />
                        </div>
                        {c.office_notes && (
                            <div className="mt-2 p-1.5 dark:bg-black/20 bg-muted/60 rounded-lg text-[10px] text-muted-foreground border dark:border-white/5 border-border">
                                {c.office_notes}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <DashboardTile
            tileId="commissions"
            title="Kommissionen"
            icon={<Factory size={18} className="dark:text-emerald-400 text-emerald-800" />}
            badgeCount={totalCount}
            badgeClassName="bg-emerald-500/10 dark:text-emerald-400 text-emerald-800 border-emerald-500/30"
            navigateTo="/commissions"
            headerActions={
                <button
                    onClick={onCreateNew}
                    className="p-2 bg-white/5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 border border-border/60 transition-colors"
                    title="Neue Kommission erstellen"
                >
                    <Plus size={16} />
                </button>
            }
        >
            {/* Tabs (all devices except desktop wide view) */}
            {!showColumns && (
                <div className="flex border-b border-border shrink-0">
                    {TAB_CONFIG.map((tab) => {
                        const count = tab.id === 'open' ? openCommissions.length : tab.id === 'backlog' ? backlogCommissions.length : returnCommissions.length;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors relative flex items-center justify-center gap-1.5 ${activeTab === tab.id ? tab.activeClass : 'text-muted-foreground'}`}
                            >
                                {tab.label}
                                {count > 0 && <span className="text-[10px] opacity-70">({count})</span>}
                                {activeTab === tab.id && <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${tab.barClass}`} />}
                            </button>
                        );
                    })}
                </div>
            )}

            {showColumns ? (
                <div className="flex-1 grid grid-cols-3 divide-x divide-white/10 overflow-hidden min-h-0">
                    {renderOpenColumn()}
                    {renderBacklogColumn()}
                    {renderReturnsColumn()}
                </div>
            ) : (
                <div className="flex-1 overflow-hidden min-h-0">
                    {activeTab === 'open' && renderOpenColumn()}
                    {activeTab === 'backlog' && renderBacklogColumn()}
                    {activeTab === 'returns' && renderReturnsColumn()}
                </div>
            )}
        </DashboardTile>
    );
});

CommissionsTile.displayName = 'CommissionsTile';
