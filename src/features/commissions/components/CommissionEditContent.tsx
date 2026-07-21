import React, { useState, useEffect, useMemo } from 'react';
import { Button, GlassInput } from '../../../components/UIComponents';
import { Plus, Search, Package, ExternalLink, Trash2, Save, X, BoxSelect, Clipboard, Paperclip, ChevronDown, Loader2, Layers, FileText, ShoppingCart, Copy, Check, Menu, MapPin } from 'lucide-react';
import { Article, Supplier, Commission, CommissionItem, ExtendedCommission } from '../../../../types';
import { supabase } from '../../../../supabaseClient';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import { DuplicateCommissionModal } from './DuplicateCommissionModal';
import { StockPickerModal } from './StockPickerModal';
import { motion } from 'framer-motion';

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

    // Categories & Search
    const [isStockPickerOpen, setIsStockPickerOpen] = useState(false);
    const [expandSupplierList, setExpandSupplierList] = useState(false);
    const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'stock' | 'supplier'>('supplier');

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
        // Reset UI states
        setIsStockPickerOpen(false);
        setExpandSupplierList(false);
        setSupplierSearchTerm('');
        setActiveTab('supplier');
    }, [isEditMode, initialCommission?.id]);

    // --- LOGIC ---

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
            customName: 'Freitext Position',
            externalReference: '',
            isPicked: false
        }]);
    };

    const addTempExternalItem = (supplier: Supplier) => {
        setTempItems(prev => [...prev, {
            uniqueId: Math.random().toString(36).substr(2, 9),
            type: 'External',
            amount: 1,
            customName: supplier.name,
            supplierId: supplier.id,
            externalReference: '',
            isPicked: false
        }]);
    };

    const updateTempItem = (uniqueId: string, field: keyof TempCommissionItem, value: any) => {
        setTempItems(prev => prev.map(i => i.uniqueId === uniqueId ? { ...i, [field]: value } : i));
    };

    const removeTempItem = (uniqueId: string) => {
        setTempItems(prev => prev.filter(i => i.uniqueId !== uniqueId));
    };

    // --- ATTACHMENTS (Drag & Drop / Paste) ---
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handleFileUpload = async (uniqueId: string, files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        if (file.size > 3 * 1024 * 1024) { alert("Datei zu groß! Max 3MB."); return; }
        try {
            const base64 = await fileToBase64(file);
            updateTempItem(uniqueId, 'attachmentData', base64);
        } catch (e) { alert("Fehler beim Lesen der Datei."); }
    };

    const handlePasteAttachment = async (uniqueId: string) => {
        try {
            const clipboardItems = await navigator.clipboard.read();
            let foundImage = false;
            for (const item of clipboardItems) {
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    const file = new File([blob], `pasted_${Date.now()}.png`, { type: imageType });
                    if (file.size > 3 * 1024 * 1024) { alert("Bild zu groß! Max 3MB."); return; }
                    const base64 = await fileToBase64(file);
                    updateTempItem(uniqueId, 'attachmentData', base64);
                    foundImage = true;
                    break;
                }
            }
            if (!foundImage) alert("Kein Bild in der Zwischenablage.");
        } catch (err) {
            console.error(err);
            alert("Zugriff verweigert oder nicht unterstützt.");
        }
    };

    const handleDragEnter = (e: React.DragEvent, uniqueId: string) => { e.preventDefault(); e.stopPropagation(); updateTempItem(uniqueId, 'isDragging', true); };
    const handleDragOver = (e: React.DragEvent, uniqueId: string) => { e.preventDefault(); e.stopPropagation(); };
    const handleDragLeave = (e: React.DragEvent, uniqueId: string) => { e.preventDefault(); e.stopPropagation(); if (e.currentTarget.contains(e.relatedTarget as Node)) return; updateTempItem(uniqueId, 'isDragging', false); };
    const handleDrop = async (e: React.DragEvent, uniqueId: string) => { e.preventDefault(); e.stopPropagation(); updateTempItem(uniqueId, 'isDragging', false); if (e.dataTransfer.files?.length > 0) await handleFileUpload(uniqueId, e.dataTransfer.files); };

    // --- SAVE ---
    const handleIntegrate = async () => {
        if (!duplicateFound) return;
        setIsSubmitting(true);
        try {
            const commId = duplicateFound.id;
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
                
                if (onLogEvent) {
                    await onLogEvent(commId, duplicateFound.name, 'updated', 'Positionen aus Duplikat-Erstellung integriert');
                }
            }
            onSave(commId, false);
            onClose();
        } catch (err: any) {
            alert("Fehler bei Integration: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFinalizeCreate = async () => {
        if (!primaryWarehouseId) { alert("Bitte Hauptlager wählen."); return; }
        if (!newComm.name) return;

        if (!isEditMode && newComm.order_number) {
            setIsSubmitting(true);
            try {
                const { data, error } = await supabase
                    .from('commissions')
                    .select('*')
                    .eq('order_number', newComm.order_number)
                    .in('status', ['Draft', 'Preparing', 'Ready'])
                    .is('deleted_at', null)
                    .limit(1);
                
                if (error) throw error;

                if (data && data.length > 0) {
                    setDuplicateFound(data[0]);
                    setShowDuplicateModal(true);
                    setIsSubmitting(false);
                    return; 
                }
            } catch (err: any) {
                console.error("Duplicate check error:", err);
            }
        }

        setIsSubmitting(true);
        try {
            let commId = initialCommission?.id;
            const payload: any = {
                order_number: newComm.order_number,
                name: newComm.name,
                notes: newComm.notes,
                warehouse_notes: newComm.warehouse_notes,
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

    const isMobile = useIsMobile();

    return (
        <div className="flex flex-col h-full overflow-hidden bg-transparent">
            {/* TOP HEADER */}
            <div className="px-5 py-3 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
                <div>
                    <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                        {isEditMode ? 'Kommission bearbeiten' : 'Neue Kommission anlegen'}
                    </h2>
                    <p className="text-xs text-muted-foreground">Stammdaten eingeben und benötigtes Material erfassen.</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-xl bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                    title="Schließen"
                >
                    <X size={18} />
                </button>
            </div>

            {/* MAIN 2-COLUMN SPLIT WORKSPACE */}
            <div className="flex-1 overflow-y-auto p-4 md:p-5 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full items-start">
                    
                    {/* LEFT COLUMN (Cols 12 / LG 5): Stammdaten & Schnell-Katalog */}
                    <div className="lg:col-span-5 flex flex-col gap-4">
                        
                        {/* CARD 1: STAMMDATEN & ORTE */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-4"
                        >
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-border/50">
                                <FileText size={14} className="text-primary" /> 1. Stammdaten & Bereitstellung
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase">Auftrags-Nr.</label>
                                    <input
                                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 text-xs font-mono shadow-xs"
                                        placeholder="Z.B. AB-2023-441"
                                        value={newComm.order_number}
                                        onChange={e => setNewComm({ ...newComm, order_number: e.target.value })}
                                        autoFocus={!isMobile}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase">Name / Projekt *</label>
                                    <input
                                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 text-xs font-bold shadow-xs"
                                        placeholder="Z.B. Baustelle Müller"
                                        value={newComm.name}
                                        onChange={e => setNewComm({ ...newComm, name: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Bereitstellungsort-Chips */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
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
                                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                                                    isActive
                                                        ? "bg-primary/20 border-primary/40 text-primary"
                                                        : "bg-muted/50 border-border hover:bg-muted text-muted-foreground"
                                                }`}
                                            >
                                                {isActive && <Check size={11} strokeWidth={3} />}
                                                {loc}
                                            </button>
                                        );
                                    })}

                                    {showCustomLocationInput ? (
                                        <div className="flex items-center gap-1 bg-background border border-border rounded-lg px-2 py-0.5">
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
                                            className="px-2 py-1 rounded-lg text-xs font-semibold border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex items-center gap-1 cursor-pointer"
                                        >
                                            <Plus size={11} strokeWidth={3} />
                                            Ort +
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Notizen */}
                            <div className="space-y-2">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase">Allgemeine Notizen</label>
                                    <textarea
                                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 text-xs min-h-[50px] resize-none shadow-xs"
                                        placeholder="Hinweise zur Baustelle / Lieferung..."
                                        value={newComm.notes}
                                        onChange={e => setNewComm({ ...newComm, notes: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-amber-500 uppercase flex items-center gap-1">
                                        ⚠️ Info ans Lager (wird groß auf Etikett gedruckt)
                                    </label>
                                    <textarea
                                        className="w-full bg-amber-500/5 border border-amber-500/30 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 text-xs min-h-[50px] resize-none shadow-xs"
                                        placeholder="Spezielle Hinweise für den Lager-Mitarbeiter..."
                                        value={newComm.warehouse_notes}
                                        onChange={e => setNewComm({ ...newComm, warehouse_notes: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Checkboxen */}
                            <div className="flex flex-wrap gap-4 pt-1 border-t border-border/40">
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

                        {/* CARD 2: KATALOG & LIEFERANTEN SCHNELL-SELEKTOR */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3 flex flex-col min-h-[260px]"
                        >
                            <div className="flex items-center justify-between pb-2 border-b border-border/50">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <Plus size={14} className="text-primary" /> 2. Material Hinzufügen
                                </h3>

                                <div className="flex p-0.5 bg-muted rounded-lg">
                                    <button 
                                        onClick={() => setActiveTab('supplier')}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${activeTab === 'supplier' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Großhändler / Freitext
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('stock')}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${activeTab === 'stock' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Lagerbestand
                                    </button>
                                </div>
                            </div>

                            {activeTab === 'supplier' && (
                                <div className="flex flex-col gap-2 flex-1">
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
                                            <input
                                                className="w-full bg-background border border-border rounded-lg py-1.5 pl-8 pr-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                                                placeholder="Lieferant suchen..."
                                                value={supplierSearchTerm}
                                                onChange={e => setSupplierSearchTerm(e.target.value)}
                                            />
                                        </div>
                                        <button
                                            onClick={addManualItem}
                                            className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                                        >
                                            <Plus size={13} /> Freitext
                                        </button>
                                    </div>

                                    <div className="max-h-[160px] overflow-y-auto custom-scrollbar space-y-1 pr-1">
                                        {suppliers.filter(s => s.name.toLowerCase().includes(supplierSearchTerm.toLowerCase())).map(sup => (
                                            <button
                                                key={sup.id}
                                                onClick={() => addTempExternalItem(sup)}
                                                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-muted/80 border border-border/40 flex justify-between items-center group transition-colors cursor-pointer text-xs"
                                            >
                                                <span className="font-semibold text-foreground truncate">{sup.name}</span>
                                                <span className="text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">+ Hinzufügen</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'stock' && (
                                <div className="flex-1 flex flex-col items-center justify-center p-4">
                                    <button
                                        onClick={() => setIsStockPickerOpen(true)}
                                        className="w-full bg-primary/10 border-2 border-dashed border-primary/30 hover:bg-primary/20 rounded-xl p-4 flex items-center justify-center gap-3 transition-all cursor-pointer text-primary"
                                    >
                                        <Package size={20} />
                                        <span className="text-xs font-bold">Hauptlager-Bestand durchsuchen & Picken</span>
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </div>

                    {/* RIGHT COLUMN (Cols 12 / LG 7): Erfasste Positionsliste & Abschluss */}
                    <div className="lg:col-span-7 flex flex-col gap-4 h-full">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col h-full min-h-[500px]"
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
                                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3 border-2 border-dashed border-border rounded-xl bg-muted/20">
                                        <BoxSelect size={32} className="opacity-30" />
                                        <p className="text-xs font-semibold">Noch keine Material-Positionen hinzugefügt.</p>
                                        <p className="text-[11px] text-muted-foreground">Wähle links Großhändler, Freitext oder Artikel aus dem Lagerbestand.</p>
                                    </div>
                                ) : (
                                    tempItems.map(item => (
                                        <div
                                            key={item.uniqueId}
                                            className={`p-3 rounded-xl border transition-all bg-background/60 shadow-xs flex flex-col gap-2 ${
                                                item.isBackorder ? 'border-amber-500/40 bg-amber-500/5' : 'border-border/60 hover:border-primary/30'
                                            }`}
                                        >
                                            {/* Row 1: Item Name / Input + Quantity Counter */}
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                                                        item.type === 'Stock' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                                    }`}>
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
                                                <div className="flex items-center bg-muted rounded-lg border border-border shrink-0">
                                                    <button
                                                        onClick={() => updateTempItem(item.uniqueId, 'amount', Math.max(1, item.amount - 1))}
                                                        className="w-6 h-6 flex items-center justify-center hover:bg-card text-muted-foreground font-bold rounded-l-lg transition-colors cursor-pointer text-xs"
                                                    >-</button>
                                                    <span className="font-black text-xs text-foreground px-2 font-mono">{item.amount}</span>
                                                    <button
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
                                                            className={`p-1.5 rounded-lg text-[11px] font-bold cursor-pointer border flex items-center gap-1 transition-colors ${
                                                                item.attachmentData ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'bg-muted/40 text-muted-foreground border-border/50 hover:text-foreground'
                                                            }`}
                                                            title="Anhang (Bild/PDF) hochladen"
                                                        >
                                                            <Paperclip size={12} />
                                                        </label>
                                                    </div>

                                                    {/* Rückstand Toggle */}
                                                    <button
                                                        onClick={() => updateTempItem(item.uniqueId, 'isBackorder', !item.isBackorder)}
                                                        className={`px-2 py-1 rounded-md text-[10px] font-extrabold uppercase transition-colors border cursor-pointer ${
                                                            item.isBackorder ? 'bg-amber-500 text-white border-amber-500 shadow-xs' : 'bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted'
                                                        }`}
                                                        title="Als Rückstand markieren"
                                                    >
                                                        Rückstand
                                                    </button>

                                                    {/* Delete Button */}
                                                    <button
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
                            <div className="pt-3 border-t border-border flex items-center justify-between gap-3 shrink-0">
                                <span className="text-xs text-muted-foreground font-medium">
                                    Gesamt: <strong className="text-foreground">{tempItems.length}</strong> Positionen
                                </span>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="secondary"
                                        onClick={onClose}
                                        className="h-10 px-4 text-xs font-bold rounded-xl border border-border"
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