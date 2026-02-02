import React, { useState, useMemo } from 'react';
import { Printer, ChevronDown, Check, Loader2, Undo2, ArrowRight, PackageX, Truck } from 'lucide-react';
import { Button, GlassInput } from './UIComponents';
import { Commission } from '../types';

interface PrintingSectionProps {
    showPrintArea: boolean;
    setShowPrintArea: (show: boolean) => void;
    printTab: 'queue' | 'history';
    setPrintTab: (tab: 'queue' | 'history') => void;
    queueItems: { id: string; name: string }[];
    selectedPrintIds: Set<string>;
    setSelectedPrintIds: (ids: Set<string>) => void;
    onMarkAsPrinted: () => void;
    isSubmitting: boolean;
    loadingHistory: boolean;
    printLogs: any[];
    onReprint: (id: string) => void;
    // New Props for Storno
    activeCommissions: Commission[];
}

const PrintingSectionComponent: React.FC<PrintingSectionProps> = ({
    showPrintArea,
    setShowPrintArea,
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
    activeCommissions = []
}) => {
    const [mode, setMode] = useState<'print' | 'storno'>('print');

    const toggleQueueSelection = (id: string) => {
        const newSet = new Set(selectedPrintIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedPrintIds(newSet);
    };

    // Memoize storno calculations
    const stornoCommissions = useMemo(() => {
        return activeCommissions.filter(c => c.status === 'ReturnPending');
    }, [activeCommissions]);

    const stornoCount = stornoCommissions.length;

    return (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-0 mb-6 animate-in fade-in overflow-hidden">
            {/* Header / Mode Switch */}
            <div className="flex border-b border-blue-500/20">
                <button
                    onClick={() => {
                        if (mode === 'print') setShowPrintArea(!showPrintArea);
                        else { setMode('print'); setShowPrintArea(true); }
                    }}
                    className={`flex-1 p-4 flex items-center justify-center gap-2 transition-colors ${mode === 'print' ? 'bg-blue-500/10 text-blue-300' : 'text-blue-300/50 hover:bg-white/5'}`}
                >
                    <Printer size={20} />
                    <span className="font-bold">Etikettendruck</span>
                    {queueItems.length > 0 && (
                        <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                            {queueItems.length}
                        </span>
                    )}
                    {mode === 'print' && <ChevronDown size={16} className={`transition-transform ${showPrintArea ? 'rotate-180' : ''}`} />}
                </button>
                <div className="w-px bg-blue-500/20" />
                <button
                    onClick={() => {
                        if (mode === 'storno') setShowPrintArea(!showPrintArea);
                        else { setMode('storno'); setShowPrintArea(true); }
                    }}
                    className={`flex-1 p-4 flex items-center justify-center gap-2 transition-colors ${mode === 'storno' ? 'bg-rose-500/10 text-rose-300' : 'text-rose-300/50 hover:bg-white/5'}`}
                >
                    <Undo2 size={20} />
                    <span className="font-bold">Storno / Rückbau</span>
                    {stornoCount > 0 && (
                        <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                            {stornoCount}
                        </span>
                    )}
                    {mode === 'storno' && <ChevronDown size={16} className={`transition-transform ${showPrintArea ? 'rotate-180' : ''}`} />}
                </button>
            </div>

            {/* Toggle Arrow (only if we want to collapse, but tabs imply open. keeping toggle for overall section) */}
            {/* We remove the old toggle header and rely on the tabs, or keep collapse? 
                Let's keep the content showing if showPrintArea is true.
            */}

            {showPrintArea && (
                <div className="p-4 bg-transparent">
                    {mode === 'print' ? (
                        <>
                            {/* Tabs */}
                            <div className="flex gap-2 mb-4 border-b border-white/10 pb-1">
                                <button
                                    onClick={() => setPrintTab('queue')}
                                    className={`text-xs font-medium px-3 py-2 rounded-t-lg transition-colors ${printTab === 'queue' ? 'bg-blue-600 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
                                >
                                    Warteschlange ({queueItems.length})
                                </button>
                                <button
                                    onClick={() => setPrintTab('history')}
                                    className={`text-xs font-medium px-3 py-2 rounded-t-lg transition-colors ${printTab === 'history' ? 'bg-blue-600 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
                                >
                                    Zuletzt gedruckt
                                </button>
                            </div>

                            {/* Content */}
                            {printTab === 'queue' ? (
                                <div className="space-y-3 animate-in fade-in">
                                    {queueItems.length > 0 ? (
                                        <>
                                            <div className="flex gap-2">
                                                <Button
                                                    className="text-xs h-8 bg-blue-600 hover:bg-blue-500 border-none"
                                                    onClick={onMarkAsPrinted}
                                                    disabled={selectedPrintIds.size === 0 || isSubmitting}
                                                >
                                                    {isSubmitting ? <Loader2 className="animate-spin" /> : `Ausgewählte Drucken (${selectedPrintIds.size})`}
                                                </Button>
                                                <button onClick={() => setSelectedPrintIds(new Set(queueItems.map(c => c.id)))} className="text-xs text-white/50 hover:text-white px-2">Alle wählen</button>
                                                <button onClick={() => setSelectedPrintIds(new Set())} className="text-xs text-white/50 hover:text-white px-2">Keine</button>
                                            </div>
                                            <div className="max-h-[200px] overflow-y-auto touch-pan-y border-t border-white/5 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {queueItems.map(c => (
                                                    <div key={c.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border ${selectedPrintIds.has(c.id) ? 'bg-blue-500/20 border-blue-500/40' : 'bg-white/5 border-transparent hover:bg-white/10'}`} onClick={() => toggleQueueSelection(c.id)}>
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedPrintIds.has(c.id) ? 'bg-blue-500 border-blue-500 text-white' : 'border-white/30'}`}>
                                                            {selectedPrintIds.has(c.id) && <Check size={10} />}
                                                        </div>
                                                        <span className="text-sm text-white truncate">{c.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center py-4 text-white/40 text-xs">Keine ausstehenden Druckaufträge.</div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2 animate-in fade-in max-h-[200px] overflow-y-auto touch-pan-y">
                                    {loadingHistory ? (
                                        <div className="text-center py-4"><Loader2 className="animate-spin text-blue-400 mx-auto" /></div>
                                    ) : printLogs.length === 0 ? (
                                        <div className="text-center py-4 text-white/40 text-xs">Keine Historie vorhanden.</div>
                                    ) : (
                                        printLogs.map(log => {
                                            const commExists = !!log.commission;
                                            return (
                                                <div key={log.id} className={`flex items-center justify-between p-2 rounded-lg border border-white/5 ${commExists ? 'bg-white/5' : 'bg-white/5 opacity-50'}`}>
                                                    <div className="min-w-0 flex-1 pr-2">
                                                        <div className="text-sm font-bold text-white truncate">{log.commission_name}</div>
                                                        <div className="text-xs text-white/50 flex gap-2">
                                                            <span>{new Date(log.created_at).toLocaleString()}</span>
                                                            <span>• {log.profiles?.full_name?.split(' ')[0]}</span>
                                                        </div>
                                                    </div>
                                                    {commExists ? (
                                                        <button
                                                            onClick={() => onReprint(log.commission_id)}
                                                            className="p-2 bg-blue-500/20 text-blue-300 hover:bg-blue-500 hover:text-white rounded-lg transition-colors"
                                                            title="Erneut drucken"
                                                        >
                                                            <Printer size={16} />
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] text-rose-400 italic">Gelöscht</span>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="animate-in fade-in space-y-4">
                            {/* 1. LIST OF PENDING STORNOS (Tasks) */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-white/50 uppercase">Offene Rückbau-Aufgaben</h4>
                                {stornoCommissions.length === 0 ? (
                                    <div className="text-center py-4 bg-white/5 rounded-lg border border-white/5 text-white/40 text-xs">
                                        Keine offenen Stornos.
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto touch-pan-y">
                                        {stornoCommissions.map(c => {
                                            const isRestock = c.notes?.includes('Einlagern') || c.notes?.includes('ZURÜCK INS LAGER');
                                            // Cast to any to access commission_items which are fetched but not in base type
                                            const items = (c as any).commission_items || [];

                                            return (
                                                <div key={c.id} className={`p-3 rounded-lg border flex flex-col gap-2 ${isRestock ? 'bg-rose-500/10 border-rose-500/20' : 'bg-purple-500/10 border-purple-500/20'}`}>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-white text-sm truncate">{c.name}</div>
                                                            <div className={`text-xs flex items-center gap-1 ${isRestock ? 'text-rose-300' : 'text-purple-300'}`}>
                                                                {isRestock ? <PackageX size={12} /> : <Truck size={12} />}
                                                                {isRestock ? 'Einlagern' : 'An Lieferant senden'}
                                                                {!isRestock && (c as any).suppliers?.name && (
                                                                    <span className="opacity-70 truncate max-w-[100px]">• {(c as any).suppliers.name}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col gap-1 items-end">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (c.order_number) navigator.clipboard.writeText(c.order_number);
                                                                }}
                                                                className="text-[10px] text-white/40 bg-white/5 px-2 py-1 rounded h-fit hover:bg-white/10 hover:text-white transition-colors cursor-pointer border border-transparent"
                                                                title="Klicken zum Kopieren"
                                                            >
                                                                {c.order_number || 'Keine Ref.'}
                                                            </button>
                                                            {c.supplier_order_number && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        navigator.clipboard.writeText(c.supplier_order_number!);
                                                                    }}
                                                                    className="text-[10px] text-amber-200/70 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded h-fit hover:bg-amber-500/20 hover:text-amber-100 transition-colors cursor-pointer flex items-center gap-1"
                                                                    title="Lieferant Vorgangsnr. kopieren"
                                                                >
                                                                    <span className="opacity-50 text-[8px]">Lief:</span>
                                                                    {c.supplier_order_number}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {!isRestock && (
                                                        <div className="mt-1 pt-2 border-t border-purple-500/20 text-xs text-purple-100/80 space-y-2">
                                                            {c.notes && (
                                                                <div className="bg-purple-500/20 p-2 rounded italic flex gap-2 items-start">
                                                                    <div className="shrink-0 mt-0.5"><Undo2 size={12} /></div>
                                                                    <span>{c.notes}</span>
                                                                </div>
                                                            )}
                                                            {items.length > 0 && (
                                                                <div className="space-y-1">
                                                                    <div className="font-semibold opacity-50 uppercase text-[10px]">Positionen ({items.length}):</div>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {items.map((item: any) => (
                                                                            <button
                                                                                key={item.id}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    // User Request: Copy Supplier Order Number when clicking badge
                                                                                    if (c.supplier_order_number) navigator.clipboard.writeText(c.supplier_order_number);
                                                                                }}
                                                                                className="flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 rounded-md px-2 py-1.5 transition-colors text-xs text-left group"
                                                                                title={c.supplier_order_number ? `Lieferantennummer kopieren: ${c.supplier_order_number}` : 'Keine Lieferantennummer'}
                                                                            >
                                                                                <span className="font-bold text-purple-200">{item.amount}x</span>
                                                                                <span className="text-white/80">{item.article?.name || item.custom_name}</span>
                                                                                {item.external_reference && (
                                                                                    <>
                                                                                        <span className="text-white/30">:</span>
                                                                                        <span className="text-amber-200/70 font-mono">{item.external_reference}</span>
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

                            {/* 2. CREATE NEW STORNO FORM - REMOVED AS REQUESTED */}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const PrintingSection = React.memo(PrintingSectionComponent);
