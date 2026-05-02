import React, { useState, useMemo } from 'react';
import { Button, StatusBadge, GlassModal } from '../../../components/UIComponents';
import { ExtendedCommission, CommissionItem } from '../../../../types';
import { supabase } from '../../../../supabaseClient';
import { X, CheckCircle2, Truck, RotateCcw, Edit2, Printer, Check, Undo2, Package, ExternalLink, MessageSquare, Eye, AlertTriangle, FileText, History, PackageX, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface CommissionDetailContentProps {
    commission: ExtendedCommission | null;
    items: any[];
    localHistoryLogs: any[];
    allItemsPicked: boolean;
    hasBackorders: boolean;
    isSubmitting: boolean;
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
    onClose?: () => void;
    onSaveOfficeData?: (isProcessed: boolean, notes: string) => void;
    onRequestCancellation?: (id: string, type: 'restock' | 'return_supplier', note: string) => void;
    onStartScan?: () => void;
    onDelete?: (e: React.MouseEvent) => void;
}

export const CommissionDetailContent: React.FC<CommissionDetailContentProps> = ({
    commission,
    items,
    localHistoryLogs,
    allItemsPicked,
    hasBackorders,
    isSubmitting,
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
    onClose,
    onSaveOfficeData,
    onRequestCancellation,
    onStartScan,
    onDelete
}) => {
    const [editingItemNote, setEditingItemNote] = useState<{ itemId: string; note: string } | null>(null);
    const [viewingAttachment, setViewingAttachment] = useState<string | null>(null);

    // Storno State
    const [showStornoModal, setShowStornoModal] = useState(false);
    const [stornoType, setStornoType] = useState<'restock' | 'return_supplier'>('restock');
    const [stornoNote, setStornoNote] = useState('');

    // Office Data State
    const [officeNotes, setOfficeNotes] = useState(commission?.office_notes || '');
    const [isProcessed, setIsProcessed] = useState(commission?.is_processed || false);

    // Sync state when commission changes
    React.useEffect(() => {
        if (commission) {
            setOfficeNotes(commission.office_notes || '');
            setIsProcessed(commission.is_processed || false);
        }
    }, [commission]);

    const handleSaveOffice = () => {
        if (onSaveOfficeData) {
            onSaveOfficeData(isProcessed, officeNotes);
        }
    };

    const translateStatus = (s: string) => {
        switch (s) {
            case 'Draft': return 'Entwurf';
            case 'Preparing': return 'In Vorbereitung';
            case 'Ready': return 'Bereitgestellt';
            case 'Withdrawn': return 'Entnommen';
            case 'ReturnReady': return 'Abholbereit (Retoure)';
            case 'ReturnPending': return 'Angemeldet (Retoure)';
            case 'ReturnComplete': return 'Retoure Abgeschlossen';
            default: return s;
        }
    };

    // Kanban Logic: Split items into Open and Picked
    const openItems = useMemo(() => items.filter(item => !item.is_picked), [items]);
    const pickedItems = useMemo(() => items.filter(item => item.is_picked), [items]);

    const renderItemCard = (item: any) => (
        <div key={item.id} className={`group flex items-start gap-3 p-3.5 rounded-xl border transition-all hover:shadow-md ${item.is_backorder ? 'bg-rose-500/5 border-rose-500/30' : item.is_picked ? 'bg-background border-primary/30 opacity-90' : 'bg-background border-border hover:border-primary/30'}`}>
            {/* Checkbox */}
            <button
                onClick={() => onTogglePicked(item.id, item.is_picked)}
                className={`mt-0.5 shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${item.is_picked ? 'bg-primary border-primary text-primary-foreground scale-105' : 'border-muted-foreground/40 hover:border-primary text-transparent'}`}
            >
                <Check size={14} strokeWidth={3} />
            </button>

            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onTogglePicked(item.id, item.is_picked)}>
                <div className="font-semibold text-foreground text-sm leading-tight mb-1">{item.type === 'Stock' ? item.article?.name : item.custom_name}</div>
                <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-2">
                    {item.type === 'Stock' ? (
                        <span className="flex items-center gap-1"><Package size={10} className="opacity-70" /> {item.article?.location}</span>
                    ) : (
                        <span className="flex items-center gap-1"><ExternalLink size={10} className="opacity-70" /> Ref: {item.external_reference || '-'}</span>
                    )}
                </div>
                {item.notes && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 text-amber-500 text-[10px] font-medium bg-amber-500/10 px-2 py-0.5 rounded-md">
                        <MessageSquare size={10} /> {item.notes}
                    </div>
                )}
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="font-black text-foreground text-lg bg-muted border border-border px-2 py-0.5 rounded-lg min-w-[2.5rem] text-center shadow-inner leading-none">{item.amount}</div>
                <div className="flex items-center gap-1.5">
                    {item.type === 'External' && (
                        <button onClick={(e) => { e.stopPropagation(); onToggleBackorder(item.id, item.is_backorder || false); }} className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition-colors border ${item.is_backorder ? 'bg-rose-500 text-white border-rose-500' : 'bg-muted text-muted-foreground border-border hover:bg-rose-500/10'}`}>
                            Rückstd.
                        </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setEditingItemNote({ itemId: item.id, note: item.notes || '' }); }} className={`p-1.5 rounded-md transition-colors ${item.notes ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`} title="Notiz">
                        <MessageSquare size={14} />
                    </button>
                </div>
            </div>
        </div>
    );

    if (!commission) return null;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* SCROLL CONTAINER */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6 @container">
                
                {/* HEADER BENTO CARD */}
                <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                    className="bg-card border border-border rounded-2xl p-5 shadow-sm relative overflow-hidden"
                >
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-blue-500" />
                    <div className="flex flex-wrap justify-between items-start gap-4 mb-2">
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">{commission.name}</h2>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="px-3 py-1 rounded-full text-xs font-bold border bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[inset_0_0_10px_rgba(59,130,246,0.1)]">
                                {commission.order_number}
                            </span>
                            <StatusBadge status={translateStatus(commission.status)} />
                        </div>
                    </div>
                    {commission.warehouse_notes && (
                        <div className="text-sm font-medium text-amber-200 bg-amber-500/20 p-4 rounded-xl border border-amber-500/40 mb-2 mt-4 shadow-inner flex items-start gap-3">
                            <AlertTriangle size={20} className="text-amber-400 mt-0.5 shrink-0" />
                            <div className="flex-1">
                                <div className="text-amber-400 font-bold mb-1 uppercase tracking-wider text-xs">Information ans Lager</div>
                                <div className="whitespace-pre-wrap leading-relaxed">{commission.warehouse_notes}</div>
                            </div>
                        </div>
                    )}
                    {commission.notes && (
                        <div className={`text-sm text-muted-foreground bg-muted/50 p-3 rounded-xl border border-border/50 whitespace-pre-wrap inline-block max-w-full ${commission.warehouse_notes ? 'mt-2' : 'mt-4'}`}>
                            {commission.notes}
                        </div>
                    )}
                </motion.div>

                {/* RESPONSIVE LAYOUT (Fluid Flexbox instead of strict grid) */}
                <div className="flex flex-wrap gap-6 items-start">
                    
                    {/* LEFT AREA: Action Bar & Kanban Columns (Takes remaining space, min-width forces wrap on narrow) */}
                    <div className="flex-1 min-w-[300px] flex flex-col gap-6 w-full">
                        
                        {/* ACTION BAR */}
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}
                            className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-wrap gap-3 items-center justify-between"
                        >
                            <div className="flex flex-wrap gap-2">
                                {/* ACTIVE WORKFLOW */}
                                {!commission.status.startsWith('Return') && commission.status !== 'Withdrawn' && !commission.deleted_at && (
                                    <>
                                        {commission.status !== 'Ready' && (
                                            <div className="relative group">
                                                <Button
                                                    onClick={onSetReady}
                                                    className={`whitespace-nowrap shadow-lg ${(!allItemsPicked || hasBackorders) ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed' : 'bg-primary hover:bg-primary shadow-primary/20'}`}
                                                    icon={<CheckCircle2 size={18} />}
                                                    disabled={isSubmitting || !allItemsPicked || hasBackorders}
                                                >
                                                    Jetzt bereitstellen
                                                </Button>
                                                {hasBackorders && (
                                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-red-950 text-red-200 text-xs rounded-lg shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 text-center border border-red-500/50">
                                                        Rückstände vorhanden! <br />Nicht bereitstellbar.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {commission.status === 'Ready' && (
                                            <>
                                                <Button onClick={onWithdraw} className="bg-purple-600 hover:bg-purple-500 whitespace-nowrap shadow-lg shadow-purple-500/20" icon={<Truck size={18} />} disabled={isSubmitting}>Entnehmen</Button>
                                                <Button onClick={onResetStatus} className="bg-amber-600 hover:bg-amber-500 whitespace-nowrap" icon={<RotateCcw size={18} />} disabled={isSubmitting}>Zurückstellen</Button>
                                            </>
                                        )}
                                        {onRequestCancellation && (
                                            <Button onClick={() => setShowStornoModal(true)} className="bg-rose-600 hover:bg-rose-500 whitespace-nowrap" icon={<Undo2 size={18} />} disabled={isSubmitting}>Storno</Button>
                                        )}
                                    </>
                                )}

                                {/* RETURN WORKFLOW */}
                                {commission.status.startsWith('Return') && commission.status !== 'ReturnComplete' && !commission.deleted_at && (
                                    <>
                                        {commission.status === 'ReturnPending' && (
                                            <>
                                                {(commission.notes?.includes('Einlagern') || commission.notes?.includes('ZURÜCK INS LAGER')) ? (
                                                    <Button onClick={onCompleteReturn} className="bg-primary hover:bg-primary whitespace-nowrap" icon={<CheckCircle2 size={18} />} disabled={isSubmitting}>Eingelagert</Button>
                                                ) : (
                                                    <Button onClick={onReturnToReady} className="bg-purple-600 hover:bg-purple-500 whitespace-nowrap" icon={<Printer size={18} />} disabled={isSubmitting}>Ins Abholregal</Button>
                                                )}
                                            </>
                                        )}
                                        {commission.status === 'ReturnReady' && (
                                            <Button onClick={onCompleteReturn} className="bg-primary hover:bg-primary whitespace-nowrap" icon={<Check size={18} />} disabled={isSubmitting}>Wurde abgeholt</Button>
                                        )}
                                    </>
                                )}

                                {/* WITHDRAWN ACTIONS */}
                                {commission.status === 'Withdrawn' && !commission.deleted_at && (
                                    <>
                                        <Button onClick={onRevertWithdraw} className="bg-amber-600 hover:bg-amber-500 whitespace-nowrap" icon={<RotateCcw size={18} />} disabled={isSubmitting}>Wiederherstellen</Button>
                                        <Button onClick={onInitReturn} className="bg-orange-600 hover:bg-orange-500 whitespace-nowrap" icon={<Undo2 size={18} />} disabled={isSubmitting}>Retoure buchen</Button>
                                    </>
                                )}
                            </div>

                            {/* Secondary Actions */}
                            <div className="flex items-center gap-2">
                                <Button variant="secondary" onClick={(e) => onEdit(e)} icon={<Edit2 size={16} className="text-muted-foreground" />} className="px-3 h-10"></Button>
                                <Button variant="secondary" onClick={onPrint} icon={<Printer size={16} className="text-muted-foreground" />} className="px-3 h-10"></Button>
                            </div>
                        </motion.div>

                        {/* KANBAN BOARD COLUMNS */}
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}
                            className="flex flex-wrap gap-4 w-full"
                        >
                            {/* Column 1: To Pick */}
                            <div className="flex-1 min-w-[280px] bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col max-h-[70vh]">
                                <div className="flex items-center justify-between mb-4 px-1 pb-2 border-b border-border/50">
                                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                        <Package size={16} className="text-muted-foreground" /> 
                                        Noch Offen
                                    </h3>
                                    <span className="bg-muted text-muted-foreground text-xs font-bold px-2 py-0.5 rounded-full">{openItems.length}</span>
                                </div>
                                <div className="space-y-3 overflow-y-auto custom-scrollbar pr-1 flex-1">
                                    {openItems.length === 0 && <div className="text-center text-muted-foreground py-8 text-sm italic">Alles gepickt! 🎉</div>}
                                    {openItems.map(renderItemCard)}
                                </div>
                            </div>

                            {/* Column 2: Picked */}
                            <div className="flex-1 min-w-[280px] bg-primary/5 border border-primary/20 rounded-2xl p-4 shadow-sm flex flex-col max-h-[70vh]">
                                <div className="flex items-center justify-between mb-4 px-1 pb-2 border-b border-primary/20">
                                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                                        <CheckCircle2 size={16} /> 
                                        Gepickt
                                    </h3>
                                    <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded-full">{pickedItems.length}</span>
                                </div>
                                <div className="space-y-3 overflow-y-auto custom-scrollbar pr-1 flex-1">
                                    {pickedItems.length === 0 && <div className="text-center text-muted-foreground py-8 text-sm italic opacity-50">Noch nichts gepickt.</div>}
                                    {pickedItems.map(renderItemCard)}
                                </div>
                            </div>
                        </motion.div>

                    </div>

                    {/* RIGHT AREA: Admin & History (Fixed width, stacks if container is narrow) */}
                    <div className="w-full @3xl:w-[320px] lg:w-[320px] shrink-0 flex flex-col gap-6">
                        
                        {/* OFFICE / ADMIN BENTO */}
                        {onSaveOfficeData && (
                            <motion.div 
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
                                className="bg-card border border-border rounded-2xl p-5 shadow-sm"
                            >
                                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <FileText size={16} /> Büro
                                </h3>

                                <div
                                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 mb-5 ${isProcessed ? 'bg-primary/10 border-primary shadow-[inset_0_0_15px_rgba(16,185,129,0.1)]' : 'bg-background border-border hover:border-primary/50'}`}
                                    onClick={() => setIsProcessed(!isProcessed)}
                                >
                                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isProcessed ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'}`}>
                                        {isProcessed && <Check size={14} strokeWidth={3} />}
                                    </div>
                                    <div>
                                        <div className={`font-bold text-sm ${isProcessed ? 'text-primary' : 'text-foreground'}`}>Abgeschlossen</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">Vom Büro geprüft</div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Interne Notizen</label>
                                    <textarea
                                        className="w-full bg-background border border-border rounded-xl p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all min-h-[80px] resize-none"
                                        placeholder="Notizen..."
                                        value={officeNotes}
                                        onChange={e => setOfficeNotes(e.target.value)}
                                    />
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {['Kunde informiert', 'Großhändler', 'Erledigt'].map(tag => (
                                            <button key={tag} onClick={() => setOfficeNotes(prev => (prev ? prev + '\n' : '') + tag)} className="px-2.5 py-1 rounded-full bg-background border border-border text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                                                + {tag}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-5 pt-5 border-t border-border">
                                    <Button onClick={handleSaveOffice} disabled={isSubmitting} className="w-full bg-primary hover:bg-primary text-sm h-10 shadow-lg shadow-primary/20">
                                        Speichern
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {/* HISTORY BENTO */}
                        <motion.div 
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
                            className="bg-card border border-border rounded-2xl p-5 shadow-sm flex-1 flex flex-col"
                        >
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                <History size={16} /> Verlauf
                            </h3>

                            <div className="bg-background rounded-xl p-4 flex-1 overflow-y-auto border border-border/50 max-h-[300px] custom-scrollbar space-y-4">
                                {localHistoryLogs.length === 0 ? (
                                    <div className="text-center text-sm text-muted-foreground italic py-4">Noch keine Einträge.</div>
                                ) : (
                                    localHistoryLogs.map((log) => (
                                        <div key={log.id} className="flex gap-3 text-sm relative before:absolute before:left-1 before:top-5 before:bottom-[-1rem] before:w-px before:bg-border last:before:hidden">
                                            <div className="w-2.5 h-2.5 rounded-full bg-primary/50 mt-1.5 shrink-0 ring-4 ring-background z-10" />
                                            <div className="flex-1 pb-1">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className="font-semibold text-foreground text-xs">{log.profiles?.full_name?.split(' ')[0] || 'System'}</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono">
                                                        {new Date(log.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <div className="text-muted-foreground text-xs leading-relaxed">{log.details}</div>
                                                <div className="text-[9px] text-muted-foreground/50 mt-1">
                                                    {new Date(log.created_at).toLocaleDateString('de-DE')}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>

                    </div>
                </div>
            </div>

            {/* ITEM NOTE EDIT MODAL */}
            <GlassModal isOpen={!!editingItemNote} onClose={() => setEditingItemNote(null)} className="max-w-sm">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="text-xl font-bold text-foreground">Positions-Notiz</h3>
                    </div>
                    <textarea
                        className="w-full h-32 bg-background border border-border rounded-xl p-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                        placeholder="Notiz eingeben..."
                        defaultValue={editingItemNote?.note}
                        id="commission-item-note-input-content"
                    />
                    <div className="flex justify-end gap-3 mt-5">
                        <Button variant="secondary" onClick={() => setEditingItemNote(null)}>Abbrechen</Button>
                        <Button onClick={() => {
                            const val = (document.getElementById('commission-item-note-input-content') as HTMLTextAreaElement).value;
                            if (editingItemNote) {
                                onSaveNote(editingItemNote.itemId, val);
                                setEditingItemNote(null);
                            }
                        }}>Speichern</Button>
                    </div>
                </div>
            </GlassModal>

            {/* STORNO MODAL */}
            <GlassModal isOpen={showStornoModal} onClose={() => setShowStornoModal(false)} className="max-w-sm">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4 text-rose-500">
                        <div className="p-3 bg-rose-500/10 rounded-full"><Undo2 size={24} /></div>
                        <h3 className="text-xl font-bold text-foreground">Stornieren</h3>
                    </div>
                    <p className="text-muted-foreground text-sm mb-6">Wie sollen die Artikel dieser Kommission behandelt werden?</p>
                    <div className="grid grid-cols-2 gap-3 mb-5">
                        <button onClick={() => setStornoType('restock')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${stornoType === 'restock' ? 'bg-rose-500/10 border-rose-500 text-rose-500' : 'bg-background border-border text-muted-foreground hover:border-rose-500/50'}`}>
                            <PackageX size={24} />
                            <span className="text-xs font-bold uppercase">Einlagern</span>
                        </button>
                        <button onClick={() => setStornoType('return_supplier')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${stornoType === 'return_supplier' ? 'bg-purple-500/10 border-purple-500 text-purple-500' : 'bg-background border-border text-muted-foreground hover:border-purple-500/50'}`}>
                            <Truck size={24} />
                            <span className="text-xs font-bold uppercase">Lieferant</span>
                        </button>
                    </div>
                    <div className="mb-6">
                        <label className="text-xs font-bold text-muted-foreground uppercase block mb-2">Grund (Optional)</label>
                        <textarea value={stornoNote} onChange={(e) => setStornoNote(e.target.value)} className="w-full bg-background border border-border rounded-xl p-3 text-sm text-foreground focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 outline-none resize-none" placeholder="Grund für Storno..." />
                    </div>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setShowStornoModal(false)} className="flex-1">Abbrechen</Button>
                        <Button onClick={() => { if (onRequestCancellation && commission) { onRequestCancellation(commission.id, stornoType, stornoNote); setShowStornoModal(false); } }} className="flex-1 bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-500/20">Ausführen</Button>
                    </div>
                </div>
            </GlassModal>

            {/* FAB Scanner Button (Mobile Only) */}
            {onStartScan && (
                <div className="md:hidden fixed bottom-6 right-6 z-50">
                    <button onClick={onStartScan} className="w-14 h-14 bg-primary hover:bg-primary text-primary-foreground rounded-full shadow-xl shadow-primary/40 flex items-center justify-center transition-transform active:scale-95">
                        <ScanLine size={24} />
                    </button>
                </div>
            )}
        </div>
    );
};