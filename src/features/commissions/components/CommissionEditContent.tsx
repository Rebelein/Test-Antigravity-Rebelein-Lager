import React, { useState, useEffect, useMemo } from 'react';
import { Button, GlassInput } from '../../../components/UIComponents';
import { Plus, Search, Package, ExternalLink, Trash2, Save, X, BoxSelect, Clipboard, Paperclip, ChevronDown, Loader2, Layers, FileText, ShoppingCart, Copy, Check, Menu } from 'lucide-react';
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
        is_price_inquiry: false,
        delivery_date_unknown: false
    });
    const [tempItems, setTempItems] = useState<TempCommissionItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Duplikatprüfung
    const [duplicateFound, setDuplicateFound] = useState<Commission | null>(null);
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);

    // Categories & Search
    const [isStockPickerOpen, setIsStockPickerOpen] = useState(false);
    const [expandSupplierList, setExpandSupplierList] = useState(false);
    const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'stock' | 'supplier'>('stock');

    // --- INITIALIZATION ---
    useEffect(() => {
        if (isEditMode && initialCommission) {
            setNewComm({
                order_number: initialCommission.order_number || '',
                name: initialCommission.name,
                notes: initialCommission.notes || '',
                is_price_inquiry: !!initialCommission.is_price_inquiry,
                delivery_date_unknown: !!initialCommission.delivery_date_unknown
            });

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
                is_price_inquiry: false,
                delivery_date_unknown: false
            });
            setTempItems([]);
        }
        // Reset UI states
        setIsStockPickerOpen(false);
        setExpandSupplierList(false);
        setSupplierSearchTerm('');
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
                warehouse_id: primaryWarehouseId,
                is_price_inquiry: newComm.is_price_inquiry,
                delivery_date_unknown: newComm.delivery_date_unknown
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
            {/* SCROLL CONTAINER */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6 @container">
                
                {/* HEADER BENTO CARD (Basic Info) */}
                <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                    className="bg-card border border-border rounded-2xl p-5 shadow-sm relative overflow-hidden"
                >
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-blue-500" />
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 tracking-tight">
                                {isEditMode ? 'Kommission bearbeiten' : 'Neue Kommission'}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-0.5">Details und benötigtes Material erfassen.</p>
                        </div>
                        {isMobile && <button onClick={onClose} className="p-2 -mr-2 text-muted-foreground hover:text-white"><X size={24} /></button>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Auftrags-Nr.</label>
                            <input
                                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-sm shadow-sm"
                                placeholder="Z.B. AB-2023-441"
                                value={newComm.order_number}
                                onChange={e => setNewComm({ ...newComm, order_number: e.target.value })}
                                autoFocus={!isMobile}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Name / Projekt</label>
                            <input
                                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-sm shadow-sm"
                                placeholder="Z.B. Baustelle Müller"
                                value={newComm.name}
                                onChange={e => setNewComm({ ...newComm, name: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-2 space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Notizen</label>
                            <textarea
                                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-sm min-h-[80px] resize-none shadow-sm"
                                placeholder="Allgemeine Hinweise zur Kommission..."
                                value={newComm.notes}
                                onChange={e => setNewComm({ ...newComm, notes: e.target.value })}
                            />
                        </div>

                        {/* Checkboxes */}
                        <div className="md:col-span-2 flex flex-wrap gap-4 pt-1">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input type="checkbox" className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-muted-foreground/30 bg-background checked:bg-amber-500 checked:border-amber-500 transition-all" checked={newComm.is_price_inquiry} onChange={e => setNewComm({ ...newComm, is_price_inquiry: e.target.checked })} />
                                    <Check className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 left-[3px] pointer-events-none" strokeWidth={4} />
                                </div>
                                <span className="text-sm font-bold text-muted-foreground group-hover:text-foreground transition-colors">Preisanfrage</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input type="checkbox" className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-muted-foreground/30 bg-background checked:bg-blue-500 checked:border-blue-500 transition-all" checked={newComm.delivery_date_unknown} onChange={e => setNewComm({ ...newComm, delivery_date_unknown: e.target.checked })} />
                                    <Check className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 left-[3px] pointer-events-none" strokeWidth={4} />
                                </div>
                                <span className="text-sm font-bold text-muted-foreground group-hover:text-foreground transition-colors">Liefertermin unbekannt</span>
                            </label>
                        </div>
                    </div>
                </motion.div>

                {/* BENTO GRID: Tools & Material List */}
                <div className="flex flex-wrap gap-6 items-start">
                    
                    {/* LEFT COLUMN: Add Tools */}
                    <div className="w-full lg:w-[340px] shrink-0 flex flex-col gap-4">
                        <motion.div 
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
                            className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 flex flex-col min-h-[350px] max-h-[500px]"
                        >
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 shrink-0">
                                <Plus size={16} /> Material Hinzufügen
                            </h3>

                            {/* Tabs */}
                            <div className="flex p-1 bg-muted rounded-xl shrink-0">
                                <button 
                                    onClick={() => setActiveTab('supplier')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'supplier' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <ExternalLink size={14} /> Großhändler
                                </button>
                                <button 
                                    onClick={() => setActiveTab('stock')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'stock' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <Package size={14} /> Lager
                                </button>
                            </div>

                            <div className="h-px w-full bg-border/50 shrink-0"></div>

                            {/* Tab Content: Stock */}
                            {activeTab === 'stock' && (
                                <div className="flex-1 flex flex-col justify-center animate-in fade-in">
                                    <button
                                        onClick={() => setIsStockPickerOpen(true)}
                                        className="w-full bg-primary/10 border-2 border-primary/20 hover:bg-primary/20 hover:border-primary/40 rounded-xl p-4 flex flex-col items-center gap-3 group transition-all text-center"
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Package size={24} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-foreground">Aus Hauptlager picken</div>
                                            <div className="text-xs text-muted-foreground mt-1">Lagerbestand durchsuchen & Positionen mit Bestand buchen.</div>
                                        </div>
                                    </button>
                                </div>
                            )}

                            {/* Tab Content: Supplier */}
                            {activeTab === 'supplier' && (
                                <div className="flex flex-col flex-1 overflow-hidden animate-in fade-in">
                                    <div className="relative mb-3 shrink-0">
                                        <Search className="absolute left-3 top-2.5 text-muted-foreground" size={14} />
                                        <input
                                            className="w-full bg-background border border-border rounded-lg py-2 pl-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                                            placeholder="Lieferant suchen..."
                                            value={supplierSearchTerm}
                                            onChange={e => setSupplierSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                                        <button onClick={addManualItem} className="w-full text-left p-2.5 rounded-lg bg-muted hover:bg-muted/80 border-2 border-dashed border-border text-xs font-bold text-muted-foreground flex items-center gap-2 mb-2 transition-colors">
                                            <Plus size={14} /> Freitext (Manuell)
                                        </button>
                                        {suppliers.filter(s => s.name.toLowerCase().includes(supplierSearchTerm.toLowerCase())).map(sup => (
                                            <button key={sup.id} onClick={() => addTempExternalItem(sup)} className="w-full text-left p-2.5 rounded-lg hover:bg-blue-500/10 hover:border-blue-500/30 border border-transparent flex justify-between items-center group transition-all">
                                                <span className="text-sm font-semibold text-muted-foreground group-hover:text-blue-500 truncate">{sup.name}</span>
                                                <Plus size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>

                    {/* RIGHT COLUMN: The Material Board */}
                    <div className="flex-1 min-w-[300px] flex flex-col h-full max-h-[1000px]">
                        <motion.div 
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
                            className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col h-full"
                        >
                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-border/50 shrink-0">
                                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                    <ShoppingCart size={16} className="text-muted-foreground" />
                                    Positions-Liste
                                </h3>
                                <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">{tempItems.length} Elemente</span>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3 pb-6">
                                {tempItems.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-4 border-2 border-dashed border-border rounded-2xl bg-background/50">
                                        <div className="p-4 bg-muted rounded-full"><BoxSelect size={32} /></div>
                                        <p className="text-sm font-semibold">Kein Material hinzugefügt.</p>
                                    </div>
                                ) : (
                                    tempItems.map(item => (
                                        <div key={item.uniqueId}
                                            className={`group relative bg-background border-2 ${item.isDragging ? 'border-primary shadow-[0_0_15px_rgba(16,185,129,0.2)] scale-105' : 'border-border hover:border-primary/30'} rounded-2xl p-4 transition-all shadow-sm`}
                                            onDragEnter={(e) => handleDragEnter(e, item.uniqueId)} onDragOver={(e) => handleDragOver(e, item.uniqueId)} onDragLeave={(e) => handleDragLeave(e, item.uniqueId)} onDrop={(e) => handleDrop(e, item.uniqueId)}
                                        >
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${item.type === 'Stock' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-purple-500/10 text-purple-500 border-purple-500/20'}`}>
                                                            {item.type === 'Stock' ? 'Lager' : (item.supplierId ? 'Lieferant' : 'Manuell')}
                                                        </span>
                                                        {item.isBackorder && <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-amber-500/10 text-amber-500 border-amber-500/20 uppercase">Rückstand</span>}
                                                    </div>

                                                    {item.type === 'Stock' ? (
                                                        <div className="font-bold text-base text-foreground pr-2" title={item.article?.name}>{item.article?.name}</div>
                                                    ) : (
                                                        <input
                                                            className="w-full bg-transparent border-0 border-b-2 border-border text-foreground font-bold text-base focus:outline-none focus:border-blue-500/50 pb-0.5 placeholder-muted-foreground/50 p-0 transition-colors"
                                                            value={item.customName}
                                                            onChange={(e) => updateTempItem(item.uniqueId, 'customName', e.target.value)}
                                                            placeholder="Artikelbezeichnung..."
                                                        />
                                                    )}
                                                </div>

                                                <div className="flex items-center bg-muted rounded-xl border border-border shrink-0 shadow-inner">
                                                    <button onClick={() => updateTempItem(item.uniqueId, 'amount', Math.max(1, item.amount - 1))} className="w-8 h-8 flex items-center justify-center hover:bg-background text-muted-foreground hover:text-foreground transition-colors rounded-l-xl"><ChevronDown size={14} /></button>
                                                    <span className="font-black text-sm text-foreground w-8 text-center">{item.amount}</span>
                                                    <button onClick={() => updateTempItem(item.uniqueId, 'amount', item.amount + 1)} className="w-8 h-8 flex items-center justify-center hover:bg-background text-muted-foreground hover:text-foreground transition-colors rounded-r-xl"><Plus size={14} /></button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                                <div className="relative group/input">
                                                    <input
                                                        className="w-full bg-muted border border-transparent focus:border-primary/30 rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground transition-all focus:ring-2 focus:ring-primary/10"
                                                        placeholder="Notiz / Info"
                                                        value={item.notes || ''}
                                                        onChange={(e) => updateTempItem(item.uniqueId, 'notes', e.target.value)}
                                                    />
                                                </div>

                                                <div className="relative group/input">
                                                    <input
                                                        className="w-full bg-muted border border-transparent focus:border-blue-500/30 rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground transition-all focus:ring-2 focus:ring-blue-500/10 font-mono"
                                                        placeholder={item.type === 'Stock' ? 'Kein Vorgang (Lager)' : 'Vorgangsnummer'}
                                                        value={item.externalReference || ''}
                                                        onChange={(e) => updateTempItem(item.uniqueId, 'externalReference', e.target.value)}
                                                        disabled={item.type === 'Stock'}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-3 border-t border-border/50">
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        <input type="file" id={`file-${item.uniqueId}`} className="hidden" onChange={(e) => handleFileUpload(item.uniqueId, e.target.files)} />
                                                        <label htmlFor={`file-${item.uniqueId}`} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-2 ${item.attachmentData ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'text-muted-foreground border-border hover:bg-muted'}`}>
                                                            <Paperclip size={12} />
                                                            {item.attachmentData ? 'Anhang hochgeladen' : 'Anhang'}
                                                        </label>
                                                        {item.attachmentData && (
                                                            <button onClick={(e) => { e.preventDefault(); updateTempItem(item.uniqueId, 'attachmentData', undefined) }} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-0.5 hover:scale-110 shadow-md transition-transform"><X size={10} /></button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                                                    <button onClick={(e) => { e.stopPropagation(); updateTempItem(item.uniqueId, 'isBackorder', !item.isBackorder); }} className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors border ${item.isBackorder ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-transparent text-muted-foreground border-transparent hover:bg-background'}`} title="Als Rückstand markieren">
                                                        Rückstd.
                                                    </button>
                                                    <div className="w-px h-4 bg-border mx-1"></div>
                                                    <button onClick={() => removeTempItem(item.uniqueId)} className="p-1.5 rounded text-muted-foreground hover:bg-rose-500 hover:text-white transition-colors shadow-sm" title="Entfernen"><Trash2 size={14} /></button>
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

            {/* BOTTOM ACTION BAR (Sticky) */}
            <div className="p-4 md:p-6 border-t border-border flex justify-end gap-3 bg-background/80 shrink-0 z-20 backdrop-blur-xl">
                <Button variant="secondary" onClick={onClose} className="h-12 px-6 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-xl border-border border">
                    Abbrechen
                </Button>
                <Button onClick={handleFinalizeCreate} disabled={isSubmitting || tempItems.length === 0} icon={isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (isEditMode ? <Save size={20} /> : <Check size={20} strokeWidth={3} />)} className="h-12 px-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 font-bold rounded-xl text-sm transition-all active:scale-95">
                    {isEditMode ? 'Änderungen Speichern' : 'Kommission Anlegen'}
                </Button>
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