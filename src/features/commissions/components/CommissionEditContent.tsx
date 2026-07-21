import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../../../components/UIComponents';
import { Plus, Search, Package, Trash2, Save, X, BoxSelect, Paperclip, Check, MapPin, FileText, ShoppingCart, Loader2, Edit, AlertTriangle } from 'lucide-react';
import { Article, Supplier, Commission, CommissionItem, ExtendedCommission } from '../../../../types';
import { supabase } from '../../../../supabaseClient';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import { DuplicateCommissionModal } from './DuplicateCommissionModal';
import { StockPickerModal } from './StockPickerModal';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export interface TempCommissionItem {
    uniqueId: string;
    type: 'Stock' | 'External';
    amount: number;
    article?: Article;
    customName?: string;
    externalReference?: string;
    attachmentData?: string;
    isBackorder?: boolean;
    notes?: string;
    supplierId?: string;
    isPicked?: boolean;
    isDragging?: boolean;
}

interface CommissionEditContentProps {
    isEditMode: boolean;
    initialCommission: ExtendedCommission | null;
    initialItems?: any[];
    primaryWarehouseId: string | null;
    availableArticles: Article[];
    suppliers: Supplier[];
    onSave: (id?: string, isNew?: boolean) => void;
    onClose: () => void;
    onLogEvent?: (commId: string, commName: string, action: string, details: string) => Promise<void>;
}

export const CommissionEditContent: React.FC<CommissionEditContentProps> = ({
    isEditMode,
    initialCommission,
    initialItems = [],
    primaryWarehouseId,
    availableArticles,
    suppliers,
    onSave,
    onClose,
    onLogEvent
}) => {
    // --- STATE ---
    const [newComm, setNewComm] = useState({ 
        order_number: '', 
        name: '', 
        notes: '',
        warehouse_notes: '',
        is_price_inquiry: false,
        delivery_date_unknown: false
    });
    const [stagingLocations, setStagingLocations] = useState<string[]>(['Regal']);
    const [customLocationInput, setCustomLocationInput] = useState('');
    const [showCustomLocationInput, setShowCustomLocationInput] = useState(false);
    const [tempItems, setTempItems] = useState<TempCommissionItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Duplikatprüfung
    const [duplicateFound, setDuplicateFound] = useState<Commission | null>(null);
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);

    // Modal State
    const [isStockPickerOpen, setIsStockPickerOpen] = useState(false);
    const isMobile = useIsMobile();

    // --- INITIALIZATION ---
    useEffect(() => {
        if (isEditMode && initialCommission) {
            setNewComm({
                order_number: initialCommission.order_number || '',
                name: initialCommission.name,
                notes: initialCommission.notes || '',
                warehouse_notes: initialCommission.warehouse_notes || '',
                is_price_inquiry: !!initialCommission.is_price_inquiry,
                delivery_date_unknown: !!initialCommission.delivery_date_unknown
            });
            setStagingLocations(initialCommission.staging_locations || ['Regal']);

            if (initialItems && initialItems.length > 0) {
                const mapped: TempCommissionItem[] = initialItems.map((item: any) => ({
                    uniqueId: Math.random().toString(36).substr(2, 9),
                    type: item.type,
                    amount: item.amount,
                    article: item.article,
                    customName: item.custom_name,
                    externalReference: item.external_reference,
                    attachmentData: item.attachment_data,
                    isBackorder: item.is_backorder,
                    notes: item.notes,
                    isPicked: item.is_picked
                }));
                setTempItems(mapped);
            } else {
                setTempItems([]);
            }
        } else {
            // New Mode
            setNewComm({ 
                order_number: '', 
                name: '', 
                notes: '',
                warehouse_notes: '',
                is_price_inquiry: false,
                delivery_date_unknown: false
            });
            setStagingLocations(['Regal']);
            setTempItems([]);
        }
        setIsStockPickerOpen(false);
    }, [isEditMode, initialCommission?.id]);

    // --- LOGIC HANDLERS ---
    const addStockItems = (items: { article: Article, amount: number }[]) => {
        setTempItems(prev => {
            const next = [...prev];
            items.forEach(({ article, amount }) => {
                const existingIndex = next.findIndex(i => i.type === 'Stock' && i.article?.id === article.id);
                if (existingIndex !== -1) {
                    next[existingIndex] = { ...next[existingIndex], amount: next[existingIndex].amount + amount };
                } else {
                    next.push({
                        uniqueId: Math.random().toString(36).substr(2, 9),
                        type: 'Stock',
                        amount: amount,
                        article: article,
                        isPicked: false
                    });
                }
            });
            return next;
        });
    };

    const addManualItem = () => {
        setTempItems(prev => [...prev, {
            uniqueId: Math.random().toString(36).substr(2, 9),
            type: 'External',
            amount: 1,
            customName: 'Neue Position',
            isPicked: false
        }]);
    };

    const addTempExternalItem = (sup: Supplier) => {
        setTempItems(prev => [...prev, {
            uniqueId: Math.random().toString(36).substr(2, 9),
            type: 'External',
            amount: 1,
            customName: `${sup.name} Position`,
            supplierId: sup.id,
            isPicked: false
        }]);
    };

    const updateTempItem = (uniqueId: string, field: keyof TempCommissionItem, value: any) => {
        setTempItems(prev => prev.map(item => {
            if (item.uniqueId === uniqueId) {
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    const removeTempItem = (uniqueId: string) => {
        setTempItems(prev => prev.filter(item => item.uniqueId !== uniqueId));
    };

    const handleFileUpload = (uniqueId: string, files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        const reader = new FileReader();
        reader.onloadend = () => {
            updateTempItem(uniqueId, 'attachmentData', reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleFinalizeCreate = async () => {
        if (!newComm.name.trim()) {
            alert("Bitte gib einen Namen/Projekt für die Kommission ein.");
            return;
        }

        if (!isEditMode && newComm.order_number.trim() && primaryWarehouseId) {
            const { data } = await supabase
                .from('commissions')
                .select('*')
                .eq('order_number', newComm.order_number.trim())
                .eq('warehouse_id', primaryWarehouseId)
                .is('deleted_at', null)
                .maybeSingle();

            if (data) {
                setDuplicateFound(data);
                setShowDuplicateModal(true);
                return;
            }
        }

        await executeSave();
    };

    const handleIntegrate = async () => {
        if (!duplicateFound) return;
        setIsSubmitting(true);
        try {
            if (tempItems.length > 0) {
                const itemsPayload = tempItems.map(item => ({
                    commission_id: duplicateFound.id,
                    type: item.type,
                    amount: item.amount,
                    article_id: item.type === 'Stock' ? item.article?.id : null,
                    custom_name: item.type === 'External' ? item.customName : null,
                    external_reference: item.type === 'External' ? item.externalReference : null,
                    attachment_data: item.attachmentData || null,
                    is_backorder: item.isBackorder || false,
                    notes: item.notes || null,
                    is_picked: false
                }));

                const { error } = await supabase.from('commission_items').insert(itemsPayload);
                if (error) throw error;
            }

            if (onLogEvent) {
                await onLogEvent(duplicateFound.id, duplicateFound.name, 'updated', `${tempItems.length} Positionen integriert`);
            }

            setShowDuplicateModal(false);
            onSave(duplicateFound.id, false);
            onClose();
        } catch (err: any) {
            alert("Fehler beim Integrieren: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const executeSave = async () => {
        setIsSubmitting(true);
        try {
            let commId = isEditMode ? initialCommission?.id : null;

            const payload: any = {
                name: newComm.name.trim(),
                order_number: newComm.order_number.trim() || null,
                notes: newComm.notes.trim() || null,
                warehouse_notes: newComm.warehouse_notes.trim() || null,
                warehouse_id: primaryWarehouseId,
                is_price_inquiry: newComm.is_price_inquiry,
                delivery_date_unknown: newComm.delivery_date_unknown,
                staging_locations: stagingLocations
            };

            if (!isEditMode) {
                payload.status = 'Draft';
                payload.needs_label = true;
            }

            Object.keys(payload).forEach(key => (payload as any)[key] === undefined && delete (payload as any)[key]);

            if (isEditMode && commId) {
                await supabase.from('commissions').update(payload).eq('id', commId);
            } else {
                const { data, error } = await supabase.from('commissions').insert(payload).select().single();
                if (error) throw error;
                commId = data.id;

                if (onLogEvent && commId) {
                    await onLogEvent(commId, newComm.name, 'created', 'Kommission angelegt');
                }
            }

            if (!commId) throw new Error("ID missing");

            if (isEditMode) {
                await supabase.from('commission_items').delete().eq('commission_id', commId);
            }

            if (tempItems.length > 0) {
                const itemsPayload = tempItems.map(item => ({
                    commission_id: commId,
                    type: item.type,
                    amount: item.amount,
                    article_id: item.type === 'Stock' ? item.article?.id : null,
                    custom_name: item.type === 'External' ? item.customName : null,
                    external_reference: item.type === 'External' ? item.externalReference : null,
                    attachment_data: item.attachmentData || null,
                    is_backorder: item.isBackorder || false,
                    notes: item.notes || null,
                    is_picked: item.isPicked || false
                }));
                const { error } = await supabase.from('commission_items').insert(itemsPayload);
                if (error) throw error;
            }

            onSave(commId, !isEditMode);
            onClose();
        } catch (err: any) {
            alert("Fehler: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-background text-foreground">
            {/* TOP HEADER BAR */}
            <div className="px-6 py-4 border-b border-border/60 bg-card/60 backdrop-blur-md flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shadow-xs">
                        {isEditMode ? <Edit size={20} /> : <Plus size={20} />}
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                            {isEditMode ? 'Kommission bearbeiten' : 'Neue Kommission anlegen'}
                        </h2>
                        <p className="text-xs text-muted-foreground">Stammdaten eingeben und benötigtes Material erfassen.</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="w-9 h-9 rounded-xl bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center cursor-pointer border border-border/40"
                    title="Schließen"
                >
                    <X size={18} />
                </button>
            </div>

            {/* MAIN 2-COLUMN WORKSPACE */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                    
                    {/* LEFT PANE (4 Cols / 33%): STAMMDATEN & HINWEISE */}
                    <div className="lg:col-span-4 flex flex-col gap-4">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-card/70 border border-border/60 rounded-2xl p-5 shadow-xs space-y-4"
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-border/50">
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <FileText size={14} className="text-primary" /> 1. Stammdaten & Bereitstellung
                                </span>
                            </div>

                            {/* Inputs */}
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase mb-1 block">Auftrags-Nr.</label>
                                    <input
                                        className="w-full bg-background border border-border/60 rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 shadow-xs"
                                        placeholder="Z.B. AB-2023-441"
                                        value={newComm.order_number}
                                        onChange={e => setNewComm({ ...newComm, order_number: e.target.value })}
                                        autoFocus={!isMobile}
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase mb-1 block">Name / Projekt *</label>
                                    <input
                                        className="w-full bg-background border border-border/60 rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 shadow-xs"
                                        placeholder="Z.B. Baustelle Müller"
                                        value={newComm.name}
                                        onChange={e => setNewComm({ ...newComm, name: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Bereitstellungsort-Chips */}
                            <div>
                                <label className="text-[11px] font-bold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
                                    <MapPin size={12} className="text-primary" /> Bereitstellungsort(e)
                                </label>
                                <div className="flex flex-wrap gap-1.5 items-center">
                                    {Array.from(new Set(['Regal', 'Garage', 'Hof', 'Palette', ...stagingLocations])).map(loc => {
                                        const isActive = stagingLocations.includes(loc);
                                        return (
                                            <button
                                                key={loc}
                                                type="button"
                                                onClick={() => {
                                                    let nextLocs = [...stagingLocations];
                                                    if (isActive) {
                                                        if (nextLocs.length <= 1) {
                                                            alert("Mindestens ein Bereitstellungsort muss aktiv bleiben.");
                                                            return;
                                                        }
                                                        nextLocs = nextLocs.filter(l => l !== loc);
                                                    } else {
                                                        nextLocs.push(loc);
                                                    }
                                                    setStagingLocations(nextLocs);
                                                }}
                                                className={clsx(
                                                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border",
                                                    isActive
                                                        ? "bg-primary/20 border-primary/40 text-primary"
                                                        : "bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted"
                                                )}
                                            >
                                                {isActive && <Check size={11} strokeWidth={3} />}
                                                {loc}
                                            </button>
                                        );
                                    })}

                                    {showCustomLocationInput ? (
                                        <div className="flex items-center gap-1 bg-background border border-border/60 rounded-lg px-2 py-0.5">
                                            <input
                                                type="text"
                                                className="bg-transparent border-none text-xs font-bold text-foreground focus:outline-none w-20 py-0.5"
                                                placeholder="Ort..."
                                                value={customLocationInput}
                                                onChange={e => setCustomLocationInput(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const trimmed = customLocationInput.trim();
                                                        if (trimmed && !stagingLocations.includes(trimmed)) {
                                                            setStagingLocations([...stagingLocations, trimmed]);
                                                        }
                                                        setCustomLocationInput('');
                                                        setShowCustomLocationInput(false);
                                                    }
                                                }}
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const trimmed = customLocationInput.trim();
                                                    if (trimmed && !stagingLocations.includes(trimmed)) {
                                                        setStagingLocations([...stagingLocations, trimmed]);
                                                    }
                                                    setCustomLocationInput('');
                                                    setShowCustomLocationInput(false);
                                                }}
                                                className="p-1 text-primary hover:bg-primary/10 rounded"
                                            >
                                                <Check size={11} strokeWidth={3} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setShowCustomLocationInput(true)}
                                            className="px-2 py-1 rounded-lg text-xs font-semibold border border-dashed border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex items-center gap-1 cursor-pointer"
                                        >
                                            <Plus size={11} strokeWidth={3} /> Ort +
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Notizen */}
                            <div className="space-y-3 pt-3 border-t border-border/50">
                                <div>
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase mb-1 block">Allgemeine Notizen</label>
                                    <textarea
                                        className="w-full bg-background border border-border/60 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 min-h-[50px] resize-none shadow-xs"
                                        placeholder="Hinweise zur Baustelle / Lieferung..."
                                        value={newComm.notes}
                                        onChange={e => setNewComm({ ...newComm, notes: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-amber-500 uppercase mb-1 flex items-center gap-1">
                                        ⚠️ Info ans Lager (wird groß gedruckt)
                                    </label>
                                    <textarea
                                        className="w-full bg-amber-500/5 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 min-h-[50px] resize-none shadow-xs"
                                        placeholder="Spezielle Hinweise für Lager-Mitarbeiter..."
                                        value={newComm.warehouse_notes}
                                        onChange={e => setNewComm({ ...newComm, warehouse_notes: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Optionale Flags */}
                            <div className="flex flex-col gap-2 pt-3 border-t border-border/50">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="checkbox" className="h-4 w-4 rounded border-border accent-amber-500 cursor-pointer" checked={newComm.is_price_inquiry} onChange={e => setNewComm({ ...newComm, is_price_inquiry: e.target.checked })} />
                                    <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground">Preisanfrage</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="checkbox" className="h-4 w-4 rounded border-border accent-blue-500 cursor-pointer" checked={newComm.delivery_date_unknown} onChange={e => setNewComm({ ...newComm, delivery_date_unknown: e.target.checked })} />
                                    <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground">Liefertermin unbekannt</span>
                                </label>
                            </div>
                        </motion.div>
                    </div>

                    {/* RIGHT PANE (8 Cols / 67%): MATERIAL-ERFASSUNG & POSITIONSLISTE */}
                    <div className="lg:col-span-8 flex flex-col gap-4">
                        {/* TOOLBAR FOR ADDING MATERIALS */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 }}
                            className="bg-card/70 border border-border/60 rounded-2xl p-4 shadow-xs flex items-center justify-between flex-wrap gap-3"
                        >
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setIsStockPickerOpen(true)}
                                    className="px-3.5 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                    <Package size={16} />
                                    <span>Lagerartikel picken</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={addManualItem}
                                    className="px-3.5 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                    <Plus size={16} />
                                    <span>Freitext-Position</span>
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">Großhändler:</span>
                                <select
                                    onChange={(e) => {
                                        const supId = e.target.value;
                                        if (!supId) return;
                                        const sup = suppliers.find(s => s.id === supId);
                                        if (sup) addTempExternalItem(sup);
                                        e.target.value = '';
                                    }}
                                    className="bg-background border border-border/60 rounded-xl px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:border-primary/50 cursor-pointer shadow-xs"
                                    defaultValue=""
                                >
                                    <option value="" disabled>+ Lieferant wählen...</option>
                                    {suppliers.map(sup => (
                                        <option key={sup.id} value={sup.id}>{sup.name}</option>
                                    ))}
                                </select>
                            </div>
                        </motion.div>

                        {/* POSITIONS LIST & TABLE */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-card/70 border border-border/60 rounded-2xl p-5 shadow-xs flex-1 flex flex-col min-h-[400px]"
                        >
                            {/* POSITIONS HEADER */}
                            <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/50 shrink-0">
                                <div className="flex items-center gap-2">
                                    <ShoppingCart size={16} className="text-primary" />
                                    <h3 className="text-sm font-bold text-foreground">Erfasste Positionsliste</h3>
                                    <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full font-mono">
                                        {tempItems.length} Positionen
                                    </span>
                                </div>
                                {tempItems.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => { if (confirm("Alle Positionen entfernen?")) setTempItems([]); }}
                                        className="text-xs text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                                    >
                                        <Trash2 size={12} /> Liste leeren
                                    </button>
                                )}
                            </div>

                            {/* COMPACT POSITIONS TABLE / ROW LIST */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 pb-4">
                                {tempItems.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3 border-2 border-dashed border-border/50 rounded-2xl bg-muted/20">
                                        <BoxSelect size={36} className="opacity-30" />
                                        <p className="text-xs font-bold text-foreground">Noch keine Material-Positionen hinzugefügt.</p>
                                        <p className="text-[11px] text-muted-foreground">Verwende oben die Buttons um Lagerartikel, Freitext oder Lieferanten-Positionen hinzuzufügen.</p>
                                    </div>
                                ) : (
                                    tempItems.map(item => (
                                        <div
                                            key={item.uniqueId}
                                            className={clsx(
                                                "p-3 rounded-xl border transition-all bg-background/80 shadow-xs flex flex-col gap-2.5",
                                                item.isBackorder ? "border-amber-500/40 bg-amber-500/5" : "border-border/60 hover:border-primary/30"
                                            )}
                                        >
                                            {/* Row 1: Item Name / Input + Quantity Counter */}
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <span className={clsx(
                                                        "text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0",
                                                        item.type === 'Stock' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                                    )}>
                                                        {item.type === 'Stock' ? 'Lager' : (item.supplierId ? 'Lieferant' : 'Freitext')}
                                                    </span>

                                                    {item.type === 'Stock' ? (
                                                        <span className="font-bold text-xs text-foreground truncate" title={item.article?.name}>
                                                            {item.article?.name}
                                                        </span>
                                                    ) : (
                                                        <input
                                                            className="flex-1 bg-transparent border-b border-border/60 text-xs font-bold text-foreground focus:outline-none focus:border-primary py-0.5 placeholder:text-muted-foreground"
                                                            value={item.customName}
                                                            onChange={(e) => updateTempItem(item.uniqueId, 'customName', e.target.value)}
                                                            placeholder="Position Name..."
                                                        />
                                                    )}
                                                </div>

                                                {/* Quantity Control */}
                                                <div className="flex items-center bg-muted/80 rounded-lg border border-border shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateTempItem(item.uniqueId, 'amount', Math.max(1, item.amount - 1))}
                                                        className="w-6 h-6 flex items-center justify-center hover:bg-card text-muted-foreground font-bold rounded-l-lg transition-colors cursor-pointer text-xs"
                                                    >-</button>
                                                    <span className="font-black text-xs text-foreground px-2.5 font-mono">{item.amount}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateTempItem(item.uniqueId, 'amount', item.amount + 1)}
                                                        className="w-6 h-6 flex items-center justify-center hover:bg-card text-muted-foreground font-bold rounded-r-lg transition-colors cursor-pointer text-xs"
                                                    >+</button>
                                                </div>
                                            </div>

                                            {/* Row 2: Vorgang, Notiz, Anhang, Rückstand-Toggle & Trash */}
                                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40 flex-wrap sm:flex-nowrap">
                                                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                                    <input
                                                        className="flex-1 bg-muted/50 border border-border/50 rounded-md px-2 py-1 text-[11px] text-foreground focus:outline-none focus:border-primary/40 font-mono"
                                                        placeholder={item.type === 'Stock' ? 'Lager (Kein Vorgang)' : 'Vorgang / Bestell-Nr.'}
                                                        value={item.externalReference || ''}
                                                        onChange={(e) => updateTempItem(item.uniqueId, 'externalReference', e.target.value)}
                                                        disabled={item.type === 'Stock'}
                                                    />
                                                    <input
                                                        className="flex-1 bg-muted/50 border border-border/50 rounded-md px-2 py-1 text-[11px] text-foreground focus:outline-none focus:border-primary/40"
                                                        placeholder="Notiz..."
                                                        value={item.notes || ''}
                                                        onChange={(e) => updateTempItem(item.uniqueId, 'notes', e.target.value)}
                                                    />
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {/* File Attachment */}
                                                    <div className="relative">
                                                        <input type="file" id={`file-${item.uniqueId}`} className="hidden" onChange={(e) => handleFileUpload(item.uniqueId, e.target.files)} />
                                                        <label
                                                            htmlFor={`file-${item.uniqueId}`}
                                                            className={clsx(
                                                                "p-1.5 rounded-lg text-[11px] font-bold cursor-pointer border flex items-center gap-1 transition-colors",
                                                                item.attachmentData ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'bg-muted/40 text-muted-foreground border-border/50 hover:text-foreground'
                                                            )}
                                                            title="Anhang (Bild/PDF) hochladen"
                                                        >
                                                            <Paperclip size={12} />
                                                        </label>
                                                    </div>

                                                    {/* Rückstand Toggle */}
                                                    <button
                                                        type="button"
                                                        onClick={() => updateTempItem(item.uniqueId, 'isBackorder', !item.isBackorder)}
                                                        className={clsx(
                                                            "px-2 py-1 rounded-md text-[10px] font-extrabold uppercase transition-colors border cursor-pointer",
                                                            item.isBackorder ? 'bg-amber-500 text-white border-amber-500 shadow-xs' : 'bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted'
                                                        )}
                                                        title="Als Rückstand markieren"
                                                    >
                                                        Rückstand
                                                    </button>

                                                    {/* Delete Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeTempItem(item.uniqueId)}
                                                        className="p-1.5 rounded-md text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                                        title="Position löschen"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* FOOTER ACTION BAR */}
                            <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-3 shrink-0 mt-auto">
                                <span className="text-xs text-muted-foreground font-semibold">
                                    Gesamt: <strong className="text-foreground">{tempItems.length}</strong> Positionen
                                </span>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="secondary"
                                        onClick={onClose}
                                        className="h-10 px-4 text-xs font-bold rounded-xl border border-border cursor-pointer"
                                    >
                                        Abbrechen
                                    </Button>
                                    <Button
                                        onClick={handleFinalizeCreate}
                                        disabled={isSubmitting || tempItems.length === 0}
                                        icon={isSubmitting ? <Loader2 className="animate-spin" size={16} /> : (isEditMode ? <Save size={16} /> : <Check size={16} strokeWidth={3} />)}
                                        className="h-10 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl text-xs shadow-md shadow-primary/20 transition-all cursor-pointer"
                                    >
                                        {isEditMode ? 'Änderungen Speichern' : 'Kommission Anlegen'}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                </div>
            </div>

            {duplicateFound && (
                <DuplicateCommissionModal 
                    isOpen={showDuplicateModal}
                    onClose={() => setShowDuplicateModal(false)}
                    onIntegrate={handleIntegrate}
                    existingCommission={duplicateFound}
                    isSubmitting={isSubmitting}
                />
            )}

            <StockPickerModal 
                isOpen={isStockPickerOpen}
                onClose={() => setIsStockPickerOpen(false)}
                articles={availableArticles}
                onAddItems={addStockItems}
            />
        </div>
    );
};