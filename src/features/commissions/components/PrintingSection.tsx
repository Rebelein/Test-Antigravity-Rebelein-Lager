'use client';
import React, { useState, useMemo } from 'react';
import {
    Printer, ChevronUp, Check, Loader2, Undo2,
    PackageX, Truck, ListChecks, History, Copy, AlertCircle,
    X, Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../../components/UIComponents';
import { Commission } from '../../../../types';
import { useTheme } from '../../../../contexts/ThemeContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import { copyTextToClipboard } from '../../../../utils/clipboard';

function cn(...inputs: any[]) {
    return twMerge(clsx(inputs));
}

interface PrintingSectionProps {
    showPrintArea: boolean;
    setShowPrintArea: (show: boolean) => void;
    minimized: boolean;
    setMinimized: (minimized: boolean) => void;
    printTab: 'queue' | 'history';
    setPrintTab: (tab: 'queue' | 'history') => void;
    queueItems: { id: string; name: string }[];
    selectedPrintIds: Set<string>;
    setSelectedPrintIds: (ids: Set<string>) => void;
    onMarkAsPrinted: (specificIds?: Set<string>) => void;
    isSubmitting: boolean;
    loadingHistory: boolean;
    printLogs: any[];
    onReprint: (id: string) => void;
    selectedHistoryPrintIds: Set<string>;
    setSelectedHistoryPrintIds: (ids: Set<string>) => void;
    onReprintBatch: (ids: string[]) => void;
    activeCommissions: Commission[];
}

const PrintingSectionComponent: React.FC<PrintingSectionProps> = ({
    setShowPrintArea,
    minimized,
    setMinimized,
    printTab,
    setPrintTab,
    queueItems,
    selectedPrintIds,
    setSelectedPrintIds,
    onMarkAsPrinted,
    isSubmitting,
    loadingHistory,
    printLogs,
    onReprint,
    selectedHistoryPrintIds,
    setSelectedHistoryPrintIds,
    onReprintBatch,
    activeCommissions = []
}) => {
    const { theme } = useTheme();
    const isGlass = theme === 'glass';
    const [mode, setMode] = useState<'print' | 'storno'>('print');

    const toggleQueueSelection = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const newSet = new Set(selectedPrintIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedPrintIds(newSet);
    };

    const toggleHistorySelection = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const newSet = new Set(selectedHistoryPrintIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedHistoryPrintIds(newSet);
    };

    const groupedLogs = useMemo(() => {
        const groups: { [key: string]: { batchId: string; timestamp: Date; user: string; logs: any[] } } = {};
        printLogs.forEach(log => {
            const match = log.details?.match(/\[Batch:([^\]]+)\]/);
            const batchId = match ? match[1] : `legacy-${log.id}`;
            if (!groups[batchId]) {
                groups[batchId] = {
                    batchId,
                    timestamp: new Date(log.created_at),
                    user: log.profiles?.full_name?.split(' ')[0] || 'Unbekannt',
                    logs: []
                };
            }
            groups[batchId].logs.push(log);
        });
        return Object.values(groups).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [printLogs]);

    const stornoCommissions = useMemo(
        () => activeCommissions.filter(c => c.status === 'ReturnPending'),
        [activeCommissions]
    );
    const stornoCount = stornoCommissions.length;
    const totalBadge = queueItems.length + stornoCount;

    // Wenn nichts zu drucken ist – nichts anzeigen
    if (totalBadge === 0) return null;

    const handlePrintAll = () => {
        if (queueItems.length === 0) return;
        onMarkAsPrinted(new Set(queueItems.map(c => c.id)));
    };

    const panelBg = isGlass
        ? 'bg-background/70 backdrop-blur-xl border border-border/50 shadow-2xl shadow-black/30'
        : 'bg-card border border-border shadow-2xl shadow-black/20';

    /* ── MINIMIZED pill ── */
    if (minimized) {
        return (
            <motion.div
                key="pill"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-24 lg:bottom-6 right-6 z-[var(--z-top)]"
            >
                <button
                    onClick={() => setMinimized(false)}
                    className={cn(
                        'flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm font-bold shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer',
                        queueItems.length > 0
                            ? 'bg-blue-600 text-white hover:bg-blue-500'
                            : 'bg-rose-600 text-white hover:bg-rose-500'
                    )}
                >
                    <Printer size={16} />
                    {queueItems.length > 0 && (
                        <span>{queueItems.length} Etiketten</span>
                    )}
                    {stornoCount > 0 && queueItems.length === 0 && (
                        <span>{stornoCount} Stornos</span>
                    )}
                    {queueItems.length > 0 && stornoCount > 0 && (
                        <span className="opacity-70 text-xs">+{stornoCount} Storno</span>
                    )}
                    <ChevronUp size={14} />
                </button>
            </motion.div>
        );
    }

    /* ── EXPANDED floating panel ── */
    return (
        <motion.div
            key="panel"
            initial={{ opacity: 0, y: 40, scale: 0.97, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: 40, scale: 0.97, x: '-50%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={cn(
                'fixed bottom-24 lg:bottom-6 left-1/2 z-[var(--z-top)] w-[min(96vw,720px)] rounded-2xl overflow-hidden',
                panelBg
            )}
        >
            {/* ── Header bar ── */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border/50 bg-muted/40">
                {/* Mode pills */}
                <div className="flex items-center gap-1 flex-1 min-w-0">
                    <button
                        onClick={() => { setMode('print'); setShowPrintArea(true); }}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0',
                            mode === 'print'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-default-100'
                        )}
                    >
                        <Printer size={13} />
                        Etikettendruck
                        {queueItems.length > 0 && (
                            <span className={cn(
                                'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.2rem] text-center',
                                mode === 'print' ? 'bg-white/20' : 'bg-blue-600/20 dark:text-blue-400 text-blue-800'
                            )}>
                                {queueItems.length}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => { setMode('storno'); setShowPrintArea(true); }}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0',
                            mode === 'storno'
                                ? 'bg-rose-600 text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-default-100'
                        )}
                    >
                        <Undo2 size={13} />
                        Storno / Rückbau
                        {stornoCount > 0 && (
                            <span className={cn(
                                'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.2rem] text-center',
                                mode === 'storno' ? 'bg-white/20' : 'bg-rose-600/20 dark:text-rose-400 text-rose-800'
                            )}>
                                {stornoCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Window controls */}
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={() => setMinimized(true)}
                        title="Minimieren"
                        aria-label="Minimieren"
                        className="p-1.5 min-w-[44px] min-h-[44px] rounded-lg text-muted-foreground hover:text-foreground hover:bg-default-100 transition-colors cursor-pointer"
                    >
                        <Minus size={14} />
                    </button>
                </div>
            </div>

            {/* ── Collapsible body ── */}
            <AnimatePresence initial={false}>
                    <motion.div
                        key="body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                        className="overflow-hidden"
                    >
                        <div className="p-5 max-h-[55vh] overflow-y-auto custom-scrollbar">
                            {/* ─── PRINT MODE ─── */}
                            {mode === 'print' && (
                                <div className="space-y-4">
                                    {/* Sub-tabs */}
                                    <div className="flex gap-2 border-b border-border/50 pb-2">
                                        <button
                                            onClick={() => setPrintTab('queue')}
                                            className={cn(
                                                'text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer',
                                                printTab === 'queue'
                                                    ? 'bg-default-200 dark:bg-default-100 text-foreground'
                                                    : 'text-muted-foreground hover:text-foreground hover:bg-default-100/50'
                                            )}
                                        >
                                            <ListChecks size={13} />
                                            Warteschlange ({queueItems.length})
                                        </button>
                                        <button
                                            onClick={() => setPrintTab('history')}
                                            className={cn(
                                                'text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer',
                                                printTab === 'history'
                                                    ? 'bg-default-200 dark:bg-default-100 text-foreground'
                                                    : 'text-muted-foreground hover:text-foreground hover:bg-default-100/50'
                                            )}
                                        >
                                            <History size={13} />
                                            Zuletzt gedruckt
                                        </button>
                                    </div>

                                    {/* Queue content */}
                                    {printTab === 'queue' ? (
                                        queueItems.length > 0 ? (
                                            <div className="space-y-3">
                                                {/* Action bar */}
                                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-blue-500/8 dark:bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Button
                                                            className="text-xs h-9 bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md cursor-pointer border-none"
                                                            onClick={handlePrintAll}
                                                            disabled={isSubmitting}
                                                            icon={isSubmitting
                                                                ? <Loader2 size={14} className="animate-spin" />
                                                                : <Printer size={14} />
                                                            }
                                                        >
                                                            Alle drucken ({queueItems.length})
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            className="text-xs h-9 font-semibold cursor-pointer border border-border"
                                                            onClick={() => onMarkAsPrinted()}
                                                            disabled={selectedPrintIds.size === 0 || isSubmitting}
                                                        >
                                                            Auswahl drucken ({selectedPrintIds.size})
                                                        </Button>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => setSelectedPrintIds(new Set(queueItems.map(c => c.id)))}
                                                            className="text-xs text-blue-500 hover:underline cursor-pointer px-2"
                                                        >Alle wählen</button>
                                                        <div className="w-px h-3 bg-border" />
                                                        <button
                                                            onClick={() => setSelectedPrintIds(new Set())}
                                                            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer px-2"
                                                        >Keine</button>
                                                    </div>
                                                </div>

                                                {/* Grid of queue items */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                                                    {queueItems.map(c => {
                                                        const isSel = selectedPrintIds.has(c.id);
                                                        return (
                                                            <div
                                                                key={c.id}
                                                                className={cn(
                                                                    'flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer select-none group',
                                                                    isSel
                                                                        ? 'bg-blue-600/10 border-blue-500/40'
                                                                        : 'bg-default-100 hover:bg-default-200 border-transparent'
                                                                )}
                                                                onClick={e => toggleQueueSelection(c.id, e)}
                                                            >
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <div className={cn(
                                                                        'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all',
                                                                        isSel
                                                                            ? 'bg-blue-600 border-blue-600 text-white'
                                                                            : 'border-default-400 bg-background'
                                                                    )}>
                                                                        {isSel && <Check size={9} strokeWidth={3} />}
                                                                    </div>
                                                                    <span className="text-xs font-medium text-foreground truncate" title={c.name}>
                                                                        {c.name}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={e => { e.stopPropagation(); onMarkAsPrinted(new Set([c.id])); }}
                                                                    title="Einzeln drucken"
                                                                    aria-label="Einzeln drucken"
                                                                    className="p-1 min-w-[44px] min-h-[44px] bg-blue-500/10 hover:bg-blue-600 dark:text-blue-400 text-blue-800 hover:text-foreground rounded-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
                                                                >
                                                                    <Printer size={11} />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-xs gap-2">
                                                <div className="p-3 rounded-full bg-default-100">
                                                    <Printer size={20} className="opacity-40" />
                                                </div>
                                                <span>Keine ausstehenden Druckaufträge.</span>
                                            </div>
                                        )
                                    ) : (
                                        /* History content */
                                        <div className="space-y-3">
                                            <div className="flex gap-2">
                                                <Button
                                                    className="text-xs h-9 bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer border-none"
                                                    onClick={() => onReprintBatch(Array.from(selectedHistoryPrintIds))}
                                                    disabled={selectedHistoryPrintIds.size === 0 || isSubmitting}
                                                    icon={<Printer size={13} />}
                                                >
                                                    {isSubmitting
                                                        ? <Loader2 size={14} className="animate-spin" />
                                                        : `Ausgewählte nachdrucken (${selectedHistoryPrintIds.size})`
                                                    }
                                                </Button>
                                            </div>
                                            {loadingHistory ? (
                                                <div className="text-center py-6">
                                                    <Loader2 className="animate-spin text-blue-500 mx-auto" size={22} />
                                                </div>
                                            ) : groupedLogs.length === 0 ? (
                                                <div className="text-center py-6 text-muted-foreground text-xs">Keine Historie vorhanden.</div>
                                            ) : (
                                                groupedLogs.map(batch => {
                                                    const allSel = batch.logs.every(l => selectedHistoryPrintIds.has(l.commission_id) && !!l.commission);
                                                    return (
                                                        <div key={batch.batchId} className="bg-default-50 border border-border/70 rounded-xl p-3">
                                                            <div className="flex justify-between items-center mb-2 pb-2 border-b border-border/50">
                                                                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                                    <span className="font-bold text-foreground">{batch.timestamp.toLocaleString('de-DE')}</span>
                                                                    <span>•</span>
                                                                    <span>{batch.user}</span>
                                                                </div>
                                                                <button
                                                                    className="text-[10px] text-blue-500 hover:dark:text-blue-400 text-blue-800 font-semibold cursor-pointer px-2 py-0.5 rounded hover:bg-default-100"
                                                                    onClick={() => {
                                                                        const s = new Set(selectedHistoryPrintIds);
                                                                        batch.logs.forEach(l => {
                                                                            if (l.commission) {
                                                                                if (allSel) s.delete(l.commission_id);
                                                                                else s.add(l.commission_id);
                                                                            }
                                                                        });
                                                                        setSelectedHistoryPrintIds(s);
                                                                    }}
                                                                >
                                                                    {allSel ? 'Abwählen' : 'Auswählen'}
                                                                </button>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                                {batch.logs.map(log => {
                                                                    const exists = !!log.commission;
                                                                    const isSel = selectedHistoryPrintIds.has(log.commission_id);
                                                                    return (
                                                                        <div
                                                                            key={log.id}
                                                                            className={cn(
                                                                                'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition-all select-none group',
                                                                                !exists
                                                                                    ? 'opacity-50 border-transparent bg-default-100/50 cursor-not-allowed'
                                                                                    : isSel
                                                                                        ? 'bg-blue-600/10 border-blue-500/30 cursor-pointer'
                                                                                        : 'bg-default-100 hover:bg-default-200 border-transparent cursor-pointer'
                                                                            )}
                                                                            onClick={() => exists && toggleHistorySelection(log.commission_id)}
                                                                        >
                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                {exists && (
                                                                                    <div className={cn(
                                                                                        'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all',
                                                                                        isSel ? 'bg-blue-600 border-blue-600 text-white' : 'border-default-400 bg-background'
                                                                                    )}>
                                                                                        {isSel && <Check size={9} strokeWidth={3} />}
                                                                                    </div>
                                                                                )}
                                                                                <span className="text-xs font-medium text-foreground truncate">{log.commission_name}</span>
                                                                            </div>
                                                                            {!exists
                                                                                ? <span className="text-[10px] text-rose-500 italic bg-rose-500/10 px-1.5 py-0.5 rounded shrink-0">Gelöscht</span>
                                                                                : (
                                                                                    <button
                                                                                        onClick={e => { e.stopPropagation(); onReprint(log.commission_id); }}
                                                                                        title="Einzeln nachdrucken"
                                                                                        aria-label="Einzeln nachdrucken"
                                                                                        className="p-1 min-w-[44px] min-h-[44px] bg-blue-500/10 hover:bg-blue-600 dark:text-blue-400 text-blue-800 hover:text-foreground rounded-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
                                                                                    >
                                                                                        <Printer size={11} />
                                                                                    </button>
                                                                                )
                                                                            }
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ─── STORNO MODE ─── */}
                            {mode === 'storno' && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle size={15} className="text-rose-500" />
                                        <h4 className="text-xs font-bold text-rose-500 uppercase tracking-wider">
                                            Offene Rückbau-Aufgaben ({stornoCount})
                                        </h4>
                                    </div>
                                    {stornoCommissions.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-xs gap-2">
                                            <div className="p-3 rounded-full bg-default-100">
                                                <Undo2 size={20} className="opacity-40" />
                                            </div>
                                            <span>Keine offenen Stornos.</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {stornoCommissions.map(c => {
                                                const isRestock = c.notes?.includes('Einlagern') || c.notes?.includes('ZURÜCK INS LAGER');
                                                const items = (c as any).commission_items || [];
                                                return (
                                                    <div
                                                        key={c.id}
                                                        className={cn(
                                                            'p-3 rounded-xl border flex flex-col gap-2',
                                                            isRestock
                                                                ? 'bg-rose-500/5 border-rose-500/20'
                                                                : 'bg-purple-500/5 border-purple-500/20'
                                                        )}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="font-bold text-foreground text-sm truncate">{c.name}</div>
                                                                <div className={cn(
                                                                    'text-xs flex items-center gap-1 mt-0.5 font-semibold',
                                                                    isRestock ? 'dark:text-rose-400 text-rose-800' : 'text-purple-400'
                                                                )}>
                                                                    {isRestock ? <PackageX size={11} /> : <Truck size={11} />}
                                                                    <span>{isRestock ? 'Einlagern' : 'An Lieferant senden'}</span>
                                                                    {!isRestock && (c as any).suppliers?.name && (
                                                                        <span className="opacity-70 truncate max-w-[100px]">• {(c as any).suppliers.name}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
                                                                <button
                                                                    onClick={async () => {
                                                                        if (c.order_number) {
                                                                            const success = await copyTextToClipboard(c.order_number);
                                                                            if (success) toast.success("Auftragsnummer kopiert");
                                                                        }
                                                                    }}
                                                                    className="text-[10px] text-muted-foreground hover:text-foreground bg-default-100 hover:bg-default-200 px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer font-medium"
                                                                    title="Referenz kopieren"
                                                                >
                                                                    <Copy size={9} />
                                                                    {c.order_number || 'Keine Ref.'}
                                                                </button>
                                                                {c.supplier_order_number && (
                                                                    <button
                                                                        onClick={async () => {
                                                                            const success = await copyTextToClipboard(c.supplier_order_number!);
                                                                            if (success) toast.success("Lieferantennummer kopiert");
                                                                        }}
                                                                        className="text-[10px] text-amber-500 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer hover:bg-amber-500/20 font-medium"
                                                                        title="Lieferantennummer kopieren"
                                                                    >
                                                                        <Copy size={9} />
                                                                        <span className="opacity-60 text-[11px]">Lief:</span>
                                                                        {c.supplier_order_number}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {!isRestock && (
                                                            <div className="pt-2 border-t border-border/30 text-xs space-y-2">
                                                                {c.notes && (
                                                                    <div className="bg-default-100/50 p-2 rounded-lg italic flex gap-2 items-start text-muted-foreground">
                                                                        <Undo2 size={11} className="shrink-0 mt-0.5 text-purple-400" />
                                                                        <span>{c.notes}</span>
                                                                    </div>
                                                                )}
                                                                {items.length > 0 && (
                                                                    <div className="space-y-1">
                                                                        <div className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                                                                            Positionen ({items.length}):
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {items.map((item: any) => (
                                                                                <button
                                                                                    key={item.id}
                                                                                    onClick={async () => {
                                                                                        if (c.supplier_order_number) {
                                                                                            const success = await copyTextToClipboard(c.supplier_order_number);
                                                                                            if (success) toast.success("Lieferantennummer kopiert");
                                                                                        }
                                                                                    }}
                                                                                    className="flex items-center gap-1 bg-default-100 hover:bg-default-200 border border-border/50 rounded-lg px-2 py-1 text-xs cursor-pointer font-medium"
                                                                                    title={c.supplier_order_number ? `Lieferantennummer kopieren: ${c.supplier_order_number}` : 'Keine Lieferantennummer'}
                                                                                >
                                                                                    <span className="font-bold text-purple-500">{item.amount}x</span>
                                                                                    <span className="text-foreground">{item.article?.name || item.custom_name}</span>
                                                                                    {item.external_reference && (
                                                                                        <>
                                                                                            <span className="text-muted-foreground">:</span>
                                                                                            <span className="text-amber-500 dark:text-amber-400 font-mono text-[10px]">{item.external_reference}</span>
                                                                                        </>
                                                                                    )}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
            </AnimatePresence>
        </motion.div>
    );
};

export const PrintingSection = React.memo(PrintingSectionComponent);
