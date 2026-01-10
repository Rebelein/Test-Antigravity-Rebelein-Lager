import React from 'react';
import { Printer, ChevronDown, Check, Loader2 } from 'lucide-react';
import { Button } from './UIComponents';

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
}

export const PrintingSection: React.FC<PrintingSectionProps> = ({
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
    onReprint
}) => {

    const toggleQueueSelection = (id: string) => {
        const newSet = new Set(selectedPrintIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedPrintIds(newSet);
    };

    return (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6 animate-in fade-in">
            <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setShowPrintArea(!showPrintArea)}>
                <div className="flex items-center gap-2 text-blue-300">
                    <Printer size={20} />
                    <span className="font-bold">Etikettendruck</span>
                </div>
                <ChevronDown size={18} className={`text-blue-300/50 transition-transform ${showPrintArea ? 'rotate-180' : ''}`} />
            </div>

            {showPrintArea && (
                <div className="mt-4">
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
                                    <div className="max-h-40 overflow-y-auto border-t border-white/5 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                        <div className="space-y-2 animate-in fade-in max-h-60 overflow-y-auto">
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
                </div>
            )}
        </div>
    );
};
