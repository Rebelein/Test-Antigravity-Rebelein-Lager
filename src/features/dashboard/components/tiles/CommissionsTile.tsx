import React from 'react';
import {
    Move, Lock, Unlock, ArrowRight, Plus, Maximize2, Minimize2,
    AlertTriangle, Check, CheckCheck, Factory, Undo2
} from 'lucide-react';
import { GlassCard } from '../../../../components/UIComponents';
import { Commission } from '../../../../../types';
import { useNavigate } from 'react-router-dom';

interface CommissionsTileProps {
    openCommissions: Commission[];
    backlogCommissions: Commission[];
    returnCommissions: Commission[];
    isLocked: boolean;
    isFullscreen: boolean;
    mobileTab: 'open' | 'backlog' | 'returns';
    onToggleLock: () => void;
    onToggleFullscreen: () => void;
    onSelectCommission: (c: Commission) => void;
    onCreateNew: () => void;
    onMarkAllAsRead: () => void;
    onMobileTabChange: (tab: 'open' | 'backlog' | 'returns') => void;
}

export const CommissionsTile: React.FC<CommissionsTileProps> = ({
    openCommissions,
    backlogCommissions,
    returnCommissions,
    isLocked,
    isFullscreen,
    mobileTab,
    onToggleLock,
    onToggleFullscreen,
    onSelectCommission,
    onCreateNew,
    onMarkAllAsRead,
    onMobileTabChange,
}) => {
    const navigate = useNavigate();

    const content = (
        <>
            <div className={`px-6 py-5 border-b border-border bg-muted backdrop-blur-sm flex items-center gap-3 shrink-0`}>
                <button
                    className={`drag-handle p-1.5 rounded-lg hover:bg-muted transition-colors ${isLocked ? 'cursor-default text-white/5 opacity-30' : 'cursor-move text-muted-foreground hover:text-muted-foreground'}`}
                    title="Verschieben"
                >
                    <Move size={18} />
                </button>
                <div className="flex items-center gap-2 flex-1">
                    <Factory size={20} className="text-emerald-400" />
                    <h2 className="text-xl font-bold text-white">Kommissionen</h2>
                </div>

                <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={onToggleLock}
                    className="p-2 bg-muted rounded-lg text-muted-foreground hover:text-white transition-colors mr-2"
                    title={isLocked ? 'Kachel entsperren' : 'Kachel sperren'}
                >
                    {isLocked ? <Lock size={16} className="text-rose-500" /> : <Unlock size={16} />}
                </button>

                <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={onCreateNew}
                    className="p-2 bg-muted rounded-lg text-muted-foreground hover:text-white transition-colors mr-2"
                    title="Neue Kommission erstellen"
                >
                    <Plus size={18} />
                </button>

                <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={onToggleFullscreen}
                    className="p-2 bg-muted rounded-lg text-muted-foreground hover:text-white transition-colors mr-2"
                >
                    {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>

                <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={() => navigate('/commissions')}
                    className="text-muted-foreground hover:text-white"
                >
                    <ArrowRight size={20} />
                </button>
            </div>

            {/* Mobile Tabs */}
            <div className="flex md:hidden border-b border-border shrink-0">
                {(['open', 'backlog', 'returns'] as const).map((tab) => {
                    const label = tab === 'open' ? 'Offen' : tab === 'backlog' ? 'Rückstand' : 'Rückgabe';
                    const activeColor = tab === 'open' ? 'text-white' : tab === 'backlog' ? 'text-rose-400' : 'text-purple-400';
                    const barColor = tab === 'open' ? 'bg-primary' : tab === 'backlog' ? 'bg-rose-500' : 'bg-purple-500';
                    return (
                        <button
                            key={tab}
                            onClick={() => onMobileTabChange(tab)}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors relative ${mobileTab === tab ? activeColor : 'text-muted-foreground'}`}
                        >
                            {label}
                            {mobileTab === tab && <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${barColor}`} />}
                        </button>
                    );
                })}
            </div>

            <div className="flex-1 block md:grid md:grid-cols-3 md:divide-x divide-white/10 overflow-hidden relative">
                {/* Left: Offen */}
                <div className={`p-4 flex-col gap-3 bg-gradient-to-b from-white/5 to-transparent overflow-hidden h-full ${mobileTab === 'open' ? 'flex' : 'hidden md:flex'}`}>
                    <div className="flex justify-between items-center mb-2 shrink-0">
                        <span className="text-sm font-bold text-white">Aktion Büro ({openCommissions.length})</span>
                        {openCommissions.some(c => c.status === 'Ready' && !c.is_processed) && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onMarkAllAsRead(); }}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-emerald-400 text-[10px] font-bold transition-all border border-emerald-500/20"
                                title="Alle 'Bereit' als gelesen markieren"
                            >
                                <CheckCheck size={12} />
                                Alle gelesen
                            </button>
                        )}
                    </div>

                    <div className={`space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4`}>
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
                                        'bg-muted border-border hover:bg-muted'
                                    }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0 flex-1 pr-2">
                                            <div className="font-bold text-white text-sm truncate">{c.name}</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">{c.order_number}</div>
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

                {/* Center: Rückstand */}
                <div className={`p-4 flex-col gap-3 relative overflow-hidden h-full ${mobileTab === 'backlog' ? 'flex' : 'hidden md:flex'}`}>
                    <div className="flex justify-between items-center mb-2 shrink-0">
                        <span className="text-sm font-bold text-rose-400">Rückstand ({backlogCommissions.length})</span>
                    </div>
                    <div className={`space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-10`}>
                        {backlogCommissions.length === 0 && <div className="text-xs text-muted-foreground italic">Kein Rückstand.</div>}
                        {backlogCommissions.map((c: any) => (
                            <div
                                key={c.id}
                                onClick={(e) => { e.stopPropagation(); onSelectCommission(c); }}
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
                                {c.notes && <div className="mt-2 text-[10px] text-muted-foreground italic truncate">{c.notes}</div>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Rückgaben */}
                <div className={`p-4 flex-col gap-3 bg-gradient-to-b from-purple-500/5 to-transparent overflow-hidden h-full ${mobileTab === 'returns' ? 'flex' : 'hidden md:flex'}`}>
                    <div className="flex justify-between items-center mb-2 shrink-0">
                        <span className="text-sm font-bold text-purple-400">Rückgabe ({returnCommissions.length})</span>
                    </div>
                    <div className={`space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4`}>
                        {returnCommissions.length === 0 && <div className="text-xs text-muted-foreground italic">Keine offenen Rückgaben.</div>}
                        {returnCommissions.map(c => (
                            <div
                                key={c.id}
                                onClick={(e) => { e.stopPropagation(); onSelectCommission(c); }}
                                className={`p-3 rounded-xl border cursor-pointer transition-all hover:bg-muted ${c.status === 'ReturnReady' ? 'bg-purple-500/20 border-purple-500 text-purple-100' : 'bg-muted border-purple-500/30'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="min-w-0">
                                        <div className="font-bold text-white text-sm truncate">{c.name}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{c.order_number}</div>
                                        {c.status === 'ReturnReady' && <div className="mt-2 text-[10px] font-bold text-purple-300 bg-purple-900/40 px-2 py-1 rounded inline-block">ABHOLBEREIT</div>}
                                        {c.status === 'ReturnPending' && <div className="mt-2 text-[10px] font-bold text-orange-300 bg-orange-900/40 px-2 py-1 rounded inline-block">Wartet auf Lager</div>}
                                    </div>
                                    <Undo2 size={14} className="text-purple-400" />
                                </div>
                                {c.office_notes && (
                                    <div className="mt-2 p-1.5 bg-black/20 rounded-lg text-[10px] text-muted-foreground border border-white/5">
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

    if (isFullscreen) {
        return <>{content}</>;
    }

    return (
        <GlassCard className={`flex flex-col h-full p-0 overflow-hidden border-none bg-muted`} contentClassName="!p-0 flex flex-col h-full">
            {content}
        </GlassCard>
    );
};
