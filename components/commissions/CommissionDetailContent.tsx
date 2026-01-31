import React, { useState } from 'react';
import { Button, StatusBadge, GlassModal } from '../UIComponents';
import { X, CheckCircle2, Truck, RotateCcw, Edit2, Printer, Check, Undo2, Package, ExternalLink, MessageSquare, Eye, History, FileText, PackageX, Trash2 } from 'lucide-react';

interface ExtendedCommission {
    id: string;
    name: string;
    order_number?: string;
    status: string;
    notes?: string;
    commission_items?: any[];
    deleted_at?: string | null;
    suppliers?: { name: string };
}

interface CommissionDetailContentProps {
    commission: ExtendedCommission;
    items: any[];
    localHistoryLogs: any[];
    allItemsPicked: boolean;
    hasBackorders: boolean;
    isSubmitting: boolean;
    onClose?: () => void; // Optional if needed for header close button
    onSetReady: () => void;
    onWithdraw: () => void;
    onResetStatus: () => void;
    onRevertWithdraw: () => void;
    onInitReturn: () => void;
    onReturnToReady: () => void;
    onCompleteReturn: () => void;
    onEdit: (e: React.MouseEvent) => void;
    onPrint: () => void;
    onTogglePicked: (itemId: string, current: boolean) => void;
    onToggleBackorder: (itemId: string, current: boolean) => void;
    onSaveNote: (itemId: string, note: string) => void;
    onRequestCancellation?: (id: string, type: 'restock' | 'return_supplier', note: string) => void;
    onDelete?: (e: React.MouseEvent) => void;
}

export const CommissionDetailContent: React.FC<CommissionDetailContentProps> = ({
    commission,
    items,
    localHistoryLogs,
    allItemsPicked,
    hasBackorders,
    isSubmitting,
    onClose,
    onSetReady,
    onWithdraw,
    onResetStatus,
    onRevertWithdraw,
    onInitReturn,
    onReturnToReady,
    onCompleteReturn,
    onEdit,
    onPrint,
    onTogglePicked,
    onToggleBackorder,
    onSaveNote,
    onRequestCancellation,
    onDelete
}) => {
    const [editingItemNote, setEditingItemNote] = useState<{ itemId: string; note: string } | null>(null);
    const [viewingAttachment, setViewingAttachment] = useState<string | null>(null);

    // Storno State
    const [showStornoModal, setShowStornoModal] = useState(false);
    const [stornoType, setStornoType] = useState<'restock' | 'return_supplier'>('restock');
    const [stornoNote, setStornoNote] = useState('');

    // Helper for Status Translation
    const translateStatus = (s: string) => {
        switch (s) {
            case 'Draft': return 'Entwurf';
            case 'Preparing': return 'In Vorbereitung';
            case 'Ready': return 'Bereit';
            case 'Withdrawn': return 'Entnommen';
            case 'ReturnReady': return 'Abholbereit (Retoure)';
            case 'ReturnPending': return 'Angemeldet (Retoure)';
            case 'ReturnComplete': return 'Retoure Abgeschlossen';
            default: return s;
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-transparent text-slate-100">
            {/* HEADER */}
            {/* Only show header actions if onClose is present (mobile modal style) or handled by MasterLayout? */}
            {/* MasterLayout provides title, but we might want custom header info here. */}
            <div className="p-4 border-b border-white/5 bg-white/[0.02] shrink-0">
                <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{commission.name}</h2>
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-500/30">
                                        {commission.order_number}
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-white/30" />
                                    <StatusBadge status={translateStatus(commission.status)} />
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <Button variant="secondary" onClick={(e) => onEdit(e)} className="w-9 h-9 p-0 rounded-lg" icon={<Edit2 size={16} />}></Button>
                                <Button variant="secondary" onClick={onPrint} className="w-9 h-9 p-0 rounded-lg" icon={<Printer size={16} />}></Button>
                                <Button variant="secondary" onClick={(e) => {
                                    if (onDelete) onDelete(e);
                                }} className="w-9 h-9 p-0 rounded-lg text-rose-400 hover:text-white hover:bg-rose-500/20" icon={<Trash2 size={16} />}></Button>
                            </div>
                        </div>
                        {/* FULL NOTES DISPLAY */}
                        {commission.notes && (
                            <div className="text-sm text-gray-600 dark:text-white/70 mt-3 bg-white dark:bg-white/5 p-3 rounded-lg whitespace-pre-wrap border border-gray-200 dark:border-white/5">
                                {commission.notes}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* ACTIVE WORKFLOW ACTIONS */}
                {!commission.status.startsWith('Return') && commission.status !== 'Withdrawn' && !commission.deleted_at && (
                    <div className="grid grid-cols-2 gap-3 pb-6 border-b border-white/5 mb-6">
                        {commission.status !== 'Ready' && (
                            <div className="col-span-2 relative group">
                                <button
                                    onClick={onSetReady}
                                    disabled={isSubmitting || !allItemsPicked || hasBackorders}
                                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all duration-300 flex items-center justify-center gap-3
                                        ${(!allItemsPicked || hasBackorders)
                                            ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
                                            : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/20 hover:shadow-emerald-500/40 border border-emerald-400/50'
                                        }`}
                                >
                                    <CheckCircle2 size={20} />
                                    Jetzt bereitstellen
                                </button>
                                {hasBackorders && (
                                    <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-48 p-2 bg-rose-950/90 text-rose-200 text-xs rounded-lg shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 text-center border border-rose-500/30 backdrop-blur-md">
                                        Rückstände vorhanden! <br />Nicht bereitstellbar.
                                    </div>
                                )}
                            </div>
                        )}
                        {commission.status === 'Ready' && (
                            <button
                                onClick={onWithdraw}
                                disabled={isSubmitting}
                                className="col-span-2 py-6 rounded-xl font-bold text-xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3
                                         bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500
                                         text-white border border-violet-400/30 shadow-violet-500/25 hover:shadow-violet-500/40"
                            >
                                <Truck size={28} />
                                Entnehmen (Abschluss)
                            </button>
                        )}

                        {/* Secondary Actions Row */}
                        {commission.status === 'Ready' && (
                            <button
                                onClick={onResetStatus}
                                disabled={isSubmitting}
                                className="py-3 rounded-lg font-medium text-amber-100 transition-all duration-200 flex items-center justify-center gap-2
                                         bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40"
                            >
                                <RotateCcw size={18} /> Zurückstellen
                            </button>
                        )}

                        {onRequestCancellation && (
                            <button
                                onClick={() => setShowStornoModal(true)}
                                disabled={isSubmitting}
                                className={`py-3 rounded-lg font-medium text-rose-100 transition-all duration-200 flex items-center justify-center gap-2
                                         bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40
                                         ${commission.status !== 'Ready' ? 'col-span-2' : ''}`}
                            >
                                <Undo2 size={18} /> Storno
                            </button>
                        )}
                    </div>
                )}

                {/* RETURN WORKFLOW ACTIONS */}
                {commission.status.startsWith('Return') && commission.status !== 'ReturnComplete' && !commission.deleted_at && (
                    <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-200 dark:border-white/5 mb-4">
                        {commission.status === 'ReturnPending' && (
                            <>
                                {(commission.notes?.includes('Einlagern') || commission.notes?.includes('ZURÜCK INS LAGER')) ? (
                                    <Button onClick={onCompleteReturn} className="bg-emerald-600 hover:bg-emerald-500 whitespace-nowrap" icon={<CheckCircle2 size={18} />} disabled={isSubmitting}>
                                        Eingelagert (Abschließen)
                                    </Button>
                                ) : (
                                    <Button onClick={onReturnToReady} className="bg-purple-600 hover:bg-purple-500 whitespace-nowrap" icon={<Printer size={18} />} disabled={isSubmitting}>
                                        Ins Abholregal (Label)
                                    </Button>
                                )}
                            </>
                        )}
                        {commission.status === 'ReturnReady' && (
                            <Button onClick={onCompleteReturn} className="bg-emerald-600 hover:bg-emerald-500 whitespace-nowrap" icon={<Check size={18} />} disabled={isSubmitting}>
                                Wurde abgeholt
                            </Button>
                        )}
                    </div>
                )}

                {/* WITHDRAWN ACTIONS */}
                {commission.status === 'Withdrawn' && !commission.deleted_at && (
                    <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-200 dark:border-white/5 mb-4">
                        <Button
                            onClick={onRevertWithdraw}
                            className="bg-amber-600 hover:bg-amber-500 whitespace-nowrap"
                            icon={<RotateCcw size={18} />}
                            disabled={isSubmitting}
                        >
                            Wiederherstellen (Bereit)
                        </Button>
                        <Button
                            onClick={onInitReturn}
                            className="bg-orange-600 hover:bg-orange-500 whitespace-nowrap"
                            icon={<Undo2 size={18} />}
                            disabled={isSubmitting}
                        >
                            Retoure / Zurückschreiben
                        </Button>
                    </div>
                )}

                {/* ITEMS LIST */}
                <div className="space-y-2">
                    {items.length === 0 && <div className="text-center text-gray-400 dark:text-white/30 py-4">Keine Positionen.</div>}
                    {items.map(item => (
                        <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${item.is_backorder ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/50' : item.is_picked ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 opacity-70' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/5'}`}>
                            {/* Disabled button if backorder */}
                            <button
                                onClick={() => onTogglePicked(item.id, item.is_picked)}
                                disabled={item.is_backorder || false}
                                className={`w-6 h-6 shrink-0 rounded border flex items-center justify-center transition-colors ${item.is_backorder ? 'bg-white/50 dark:bg-white/5 border-gray-200 dark:border-white/10 cursor-not-allowed opacity-50' : item.is_picked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 dark:border-white/30 hover:border-emerald-400'}`}
                            >
                                {item.is_picked && <Check size={14} />}
                            </button>

                            <div className={`flex-1 min-w-0 ${item.is_backorder ? 'cursor-default' : 'cursor-pointer'}`} onClick={() => !item.is_backorder && onTogglePicked(item.id, item.is_picked)}>
                                <div className="font-medium text-gray-900 dark:text-white truncate">{item.type === 'Stock' ? item.article?.name : item.custom_name}</div>
                                <div className="text-xs text-gray-500 dark:text-white/50 flex flex-wrap items-center gap-2">
                                    {item.type === 'Stock' ? <><Package size={12} /> Lager: {item.article?.location}</> : <><ExternalLink size={12} /> Extern • Ref: {item.external_reference || '-'}</>}
                                    {item.notes && <span className="flex items-center gap-1 text-amber-500 dark:text-amber-300"><MessageSquare size={10} /> {item.notes}</span>}
                                </div>
                            </div>

                            {/* Right Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                                {/* Note Button */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEditingItemNote({ itemId: item.id, note: item.notes || '' }); }}
                                    className={`p-1.5 rounded transition-colors ${item.notes ? 'text-amber-500 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20' : 'text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white'}`}
                                    title="Notiz hinzufügen"
                                >
                                    <MessageSquare size={16} />
                                </button>

                                {/* Backorder Toggle */}
                                {item.type === 'External' && (
                                    <div className="flex items-center gap-2 bg-gray-100 dark:bg-black/20 p-1 rounded-lg border border-gray-200 dark:border-white/5" title="Rückstand umschalten">
                                        <span className={`text-[9px] uppercase font-bold px-1 ${item.is_backorder ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-white/30'}`}>Rückstd.</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onToggleBackorder(item.id, item.is_backorder || false); }}
                                            className={`w-8 h-4 rounded-full relative transition-colors ${item.is_backorder ? 'bg-red-500' : 'bg-gray-300 dark:bg-white/20'}`}
                                        >
                                            <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${item.is_backorder ? 'translate-x-4' : ''}`} />
                                        </button>
                                    </div>
                                )}

                                {/* Attachment View Button */}
                                {item.attachment_data && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setViewingAttachment(item.attachment_data!); }}
                                        className="p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 hover:bg-blue-500 hover:text-white rounded-lg transition-colors"
                                        title="Anhang ansehen"
                                    >
                                        <Eye size={18} />
                                    </button>
                                )}

                                <div className="font-bold text-gray-900 dark:text-white text-lg px-2">{item.amount}x</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* --- HISTORY SECTION --- */}
                <div className="mt-8 border-t border-gray-200 dark:border-white/10 pt-6">
                    <div className="flex items-center gap-2 mb-4">
                        <History size={18} className="text-gray-400 dark:text-white/50" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Verlauf</h3>
                    </div>

                    <div className="bg-gray-50 dark:bg-black/20 rounded-xl p-4 max-h-60 overflow-y-auto space-y-3">
                        {localHistoryLogs.length === 0 ? (
                            <div className="text-center text-sm text-gray-400 dark:text-white/30 italic py-2">Noch keine Einträge vorhanden.</div>
                        ) : (
                            localHistoryLogs.map((log) => (
                                <div key={log.id} className="flex gap-3 text-sm">
                                    <div className="min-w-[120px] text-gray-500 dark:text-white/40 text-xs mt-0.5">
                                        {new Date(log.created_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-gray-700 dark:text-white/90">
                                                {log.profiles?.full_name?.split(' ')[0] || 'Unbekannt'}
                                            </span>
                                            <span className="text-gray-400 dark:text-white/30 text-xs">•</span>
                                            <span className="text-gray-600 dark:text-white/70">{log.details}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* ITEM NOTE EDIT MODAL */}
            <GlassModal isOpen={!!editingItemNote} onClose={() => setEditingItemNote(null)} className="max-w-sm">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-900 dark:text-white">Notiz zur Position</h3>
                        <button onClick={() => setEditingItemNote(null)} className="text-gray-400 dark:text-white/50 hover:text-gray-900 dark:hover:text-white"><X size={20} /></button>
                    </div>
                    <textarea
                        className="w-full h-32 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="Notiz eingeben..."
                        defaultValue={editingItemNote?.note}
                        autoFocus
                        id="commission-item-note-input"
                    />
                    <div className="flex justify-end gap-3 mt-4">
                        <Button variant="secondary" onClick={() => setEditingItemNote(null)}>Abbrechen</Button>
                        <Button onClick={() => {
                            const val = (document.getElementById('commission-item-note-input') as HTMLTextAreaElement).value;
                            if (editingItemNote) {
                                onSaveNote(editingItemNote.itemId, val);
                                setEditingItemNote(null);
                            }
                        }}>Speichern</Button>
                    </div>
                </div>
            </GlassModal>

            {/* ATTACHMENT VIEWER MODAL */}
            <GlassModal isOpen={!!viewingAttachment} onClose={() => setViewingAttachment(null)} className="max-w-[95vw] h-[95vh] max-h-[95vh]">
                <div className="flex flex-col h-full bg-gray-900 rounded-2xl overflow-hidden">
                    <div className="p-3 border-b border-white/10 flex justify-between items-center bg-white/5">
                        <h3 className="text-white font-bold flex items-center gap-2"><FileText size={18} /> Anhang Vorschau</h3>
                        <button onClick={() => setViewingAttachment(null)} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white"><X size={20} /></button>
                    </div>
                    <div className="flex-1 bg-black p-4 overflow-auto flex items-center justify-center">
                        {viewingAttachment?.startsWith('data:application/pdf') ? (
                            <iframe src={viewingAttachment} className="w-full h-full border-none rounded-lg" title="PDF Vorschau" />
                        ) : (
                            <img src={viewingAttachment || ''} className="max-w-full max-h-full object-contain rounded-lg" alt="Anhang" />
                        )}
                    </div>
                </div>
            </GlassModal>

            {/* STORNO MODAL */}
            <GlassModal isOpen={showStornoModal} onClose={() => setShowStornoModal(false)} className="max-w-sm">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4 text-rose-500">
                        <div className="p-3 bg-rose-500/10 rounded-full"><Undo2 size={24} /></div>
                        <h3 className="text-lg font-bold text-white">Kommission stornieren</h3>
                    </div>

                    <p className="text-white/60 text-sm mb-6">
                        Wie sollen die Artikel dieser Kommission behandelt werden?
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <button
                            onClick={() => setStornoType('restock')}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${stornoType === 'restock' ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}
                        >
                            <PackageX size={24} />
                            <span className="text-xs font-bold uppercase">Einlagern</span>
                        </button>
                        <button
                            onClick={() => setStornoType('return_supplier')}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${stornoType === 'return_supplier' ? 'bg-purple-500 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}
                        >
                            <Truck size={24} />
                            <span className="text-xs font-bold uppercase">Lieferant</span>
                        </button>
                    </div>

                    <div className="mb-6">
                        <label className="text-xs text-white/50 block mb-2">Notiz (Optional)</label>
                        <textarea
                            value={stornoNote}
                            onChange={(e) => setStornoNote(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-rose-500 outline-none"
                            placeholder="Grund für Storno..."
                        />
                    </div>

                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setShowStornoModal(false)} className="flex-1">Abbrechen</Button>
                        <Button
                            onClick={() => {
                                if (onRequestCancellation) {
                                    onRequestCancellation(commission.id, stornoType, stornoNote);
                                    setShowStornoModal(false);
                                }
                            }}
                            className="flex-1 bg-rose-600 hover:bg-rose-500"
                        >
                            Storno ausführen
                        </Button>
                    </div>
                </div>
            </GlassModal>
        </div>
    );
};
