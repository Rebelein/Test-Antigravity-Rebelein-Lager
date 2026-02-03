import React, { useState, useEffect, useMemo } from 'react';
import { Button, GlassInput } from '../../../components/UIComponents';
import { Plus, Search, Package, ExternalLink, Trash2, Save, X, BoxSelect, Clipboard, Paperclip, ChevronDown, Loader2, Layers, FileText, ShoppingCart, Copy } from 'lucide-react';
import { Article, Supplier, Commission, CommissionItem, ExtendedCommission } from '../../../../types';
import { supabase } from '../../../../supabaseClient';
import { useIsMobile } from '../../../../hooks/useIsMobile';

// ExtendedCommission moved to types.ts

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
}

export const CommissionEditContent: React.FC<CommissionEditContentProps> = ({
    isEditMode,
    initialCommission,
    initialItems = [],
    primaryWarehouseId,
    availableArticles,
    suppliers,
    onSave,
    onClose
}) => {
    // --- STATE ---
    const [newComm, setNewComm] = useState({ order_number: '', name: '', notes: '' });
    const [tempItems, setTempItems] = useState<TempCommissionItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Categories & Search
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [expandStockSearch, setExpandStockSearch] = useState(false);
    const [expandSupplierList, setExpandSupplierList] = useState(false);
    const [stockSearchTerm, setStockSearchTerm] = useState('');
    const [supplierSearchTerm, setSupplierSearchTerm] = useState('');

    const distinctCategories = useMemo(() => {
        const cats = new Set(availableArticles.map(a => a.category || 'Sonstiges'));
        return Array.from(cats).sort();
    }, [availableArticles]);

    // --- INITIALIZATION ---
    useEffect(() => {
        if (isEditMode && initialCommission) {
            setNewComm({
                order_number: initialCommission.order_number || '',
                name: initialCommission.name,
                notes: initialCommission.notes || ''
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
            setNewComm({ order_number: '', name: '', notes: '' });
            setTempItems([]);
        }
        // Reset UI states
        setSelectedCategory(null);
        setExpandStockSearch(false);
        setExpandSupplierList(false);
        setStockSearchTerm('');
        setSupplierSearchTerm('');
    }, [isEditMode, initialCommission?.id]); // FIX: Depend ONLY on ID, not the full object/array references

    // --- LOGIC ---

    const addTempStockItem = (article: Article) => {
        setTempItems(prev => {
            const existing = prev.find(i => i.type === 'Stock' && i.article?.id === article.id);
            if (existing) {
                return prev.map(i => i.uniqueId === existing.uniqueId ? { ...i, amount: i.amount + 1 } : i);
            }
            return [...prev, {
                uniqueId: Math.random().toString(36).substr(2, 9),
                type: 'Stock',
                amount: 1,
                article: article,
                isPicked: false
            }];
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

    // Drag events
    const handleDragEnter = (e: React.DragEvent, uniqueId: string) => { e.preventDefault(); e.stopPropagation(); updateTempItem(uniqueId, 'isDragging', true); };
    const handleDragOver = (e: React.DragEvent, uniqueId: string) => { e.preventDefault(); e.stopPropagation(); };
    const handleDragLeave = (e: React.DragEvent, uniqueId: string) => { e.preventDefault(); e.stopPropagation(); if (e.currentTarget.contains(e.relatedTarget as Node)) return; updateTempItem(uniqueId, 'isDragging', false); };
    const handleDrop = async (e: React.DragEvent, uniqueId: string) => { e.preventDefault(); e.stopPropagation(); updateTempItem(uniqueId, 'isDragging', false); if (e.dataTransfer.files?.length > 0) await handleFileUpload(uniqueId, e.dataTransfer.files); };


    // --- SAVE ---
    const handleFinalizeCreate = async () => {
        if (!primaryWarehouseId) { alert("Bitte Hauptlager wählen."); return; }
        if (!newComm.name) return;

        setIsSubmitting(true);
        try {
            let commId = initialCommission?.id;
            const payload: any = {
                order_number: newComm.order_number,
                name: newComm.name,
                notes: newComm.notes,
                warehouse_id: primaryWarehouseId,
            };

            if (!isEditMode) {
                payload.status = 'Draft';
                payload.needs_label = false;
            }

            // Clean undefined
            Object.keys(payload).forEach(key => (payload as any)[key] === undefined && delete (payload as any)[key]);

            if (isEditMode && commId) {
                await supabase.from('commissions').update(payload).eq('id', commId);
            } else {
                const { data, error } = await supabase.from('commissions').insert(payload).select().single();
                if (error) throw error;
                commId = data.id;
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

            onSave(commId, !isEditMode); // Pass ID and isNew flag
            onClose();
        } catch (err: any) {
            alert("Fehler: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isMobile = useIsMobile();

    return (
        <div className={`flex w-full h-full bg-transparent ${isMobile ? 'flex-col overflow-y-auto' : 'flex-row'}`}>
            {/* LEFT COLUMN - FORM & SEARCH */}
            <div className={`${isMobile ? 'w-full shrink-0 h-auto' : 'w-1/2 shrink-0 border-r border-white/5 overflow-y-auto custom-scrollbar'} flex flex-col p-6 space-y-6 bg-white/[0.02]`}>
                <div className="space-y-1 pb-2">
                    {/* Header with Close button for Mobile (since Right Col is below) */}
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">{isEditMode ? 'Kommission bearbeiten' : 'Neue Kommission'}</h2>
                            <p className="text-sm text-white/50">Details und Material erfassen.</p>
                        </div>
                        {isMobile && <button onClick={onClose} className="p-2 -mr-2 text-white/50 hover:text-white"><X size={24} /></button>}
                    </div>
                </div>

                <div className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/60">Auftrags-Nr.</label>
                        <input
                            className="w-full bg-[#1A1D24] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all text-sm"
                            placeholder=""
                            value={newComm.order_number}
                            onChange={e => setNewComm({ ...newComm, order_number: e.target.value })}
                            autoFocus={!isMobile} // Don't autofocus on mobile to prevent keyboard pop-up
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/60">Name</label>
                        <input
                            className="w-full bg-[#1A1D24] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all text-sm"
                            placeholder=""
                            value={newComm.name}
                            onChange={e => setNewComm({ ...newComm, name: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/60">Notizen</label>
                        <textarea
                            className="w-full bg-[#1A1D24] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all text-sm h-32 resize-none"
                            placeholder=""
                            value={newComm.notes}
                            onChange={e => setNewComm({ ...newComm, notes: e.target.value })}
                        />
                    </div>
                </div>

                <div className="h-px bg-white/5 w-full my-4"></div>

                {/* SEARCH TOOLS */}
                <div className="space-y-3">
                    {/* Stock Item Search */}
                    <div className="space-y-2">
                        <div
                            onClick={() => setExpandStockSearch(!expandStockSearch)}
                            className={`w-full bg-[#1A1D24] border ${expandStockSearch ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-white/10'} hover:border-white/20 rounded-lg p-3.5 flex items-center justify-between cursor-pointer transition-all group`}
                        >
                            <div className="flex items-center gap-3">
                                <Package className={expandStockSearch ? 'text-emerald-400' : 'text-white/40'} size={18} />
                                <span className={`text-sm font-semibold ${expandStockSearch ? 'text-white' : 'text-white/70'}`}>Material aus Hauptlager</span>
                            </div>
                            {expandStockSearch ? <ChevronDown size={16} className="text-white/50 rotate-180" /> : <div className="text-xs text-white/40"><Search size={14} className="inline mr-1" /> Suchen...</div>}
                        </div>

                        {expandStockSearch && (
                            <div className="space-y-2 pl-1 pt-2 animate-in slide-in-from-top-2 fade-in">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 text-white/30" size={14} />
                                    <input
                                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-9 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                                        placeholder="Artikel suchen..."
                                        value={stockSearchTerm}
                                        onChange={e => setStockSearchTerm(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="max-h-[300px] overflow-y-auto space-y-1 custom-scrollbar pr-1">
                                    {selectedCategory && (
                                        <button onClick={() => setSelectedCategory(null)} className="text-xs text-emerald-400 hover:underline mb-2 flex items-center gap-1 w-full p-1"><ChevronDown size={10} className="rotate-90" /> Zurück zu Kategorien</button>
                                    )}
                                    {selectedCategory ? (
                                        availableArticles
                                            .filter(a => a.category === selectedCategory && a.name.toLowerCase().includes(stockSearchTerm.toLowerCase()))
                                            .map(article => (
                                                <button key={article.id} onClick={() => addTempStockItem(article)} className="w-full text-left p-2.5 rounded-lg hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-transparent flex justify-between items-center group transition-all mb-1">
                                                    <div><div className="text-sm font-medium text-white/80 group-hover:text-emerald-300 truncate">{article.name}</div><div className="text-[10px] text-white/40">Bestand: {article.stock} Stk • {article.location}</div></div>
                                                    <Plus size={16} className="text-white/20 group-hover:text-emerald-400" />
                                                </button>
                                            ))
                                    ) : (
                                        distinctCategories
                                            .filter(cat => cat.toLowerCase().includes(stockSearchTerm.toLowerCase()))
                                            .map(cat => (
                                                <button key={cat} onClick={() => setSelectedCategory(cat)} className="w-full text-left p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-medium text-white flex justify-between group transition-colors mb-1"><span className="flex items-center gap-2"><Layers size={14} className="text-white/40 group-hover:text-white/60" /> {cat}</span> <ChevronDown size={12} className="-rotate-90 text-white/30" /></button>
                                            ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Supplier Search */}
                    <div className="space-y-2">
                        <div
                            onClick={() => setExpandSupplierList(!expandSupplierList)}
                            className={`w-full bg-[#1A1D24] border ${expandSupplierList ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-white/10'} hover:border-white/20 rounded-lg p-3.5 flex items-center justify-between cursor-pointer transition-all`}
                        >
                            <div className="flex items-center gap-3">
                                <ExternalLink className={expandSupplierList ? 'text-blue-400' : 'text-white/40'} size={18} />
                                <span className={`text-sm font-semibold ${expandSupplierList ? 'text-white' : 'text-white/70'}`}>Lieferant wählen</span>
                            </div>
                            {expandSupplierList ? <ChevronDown size={16} className="text-white/50 rotate-180" /> : <div className="text-xs text-white/40"><Search size={14} className="inline mr-1" /> Suchen...</div>}
                        </div>

                        {expandSupplierList && (
                            <div className="space-y-2 pl-1 pt-2 animate-in slide-in-from-top-2 fade-in">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 text-white/30" size={14} />
                                    <input
                                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-9 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                        placeholder="Lieferant suchen..."
                                        value={supplierSearchTerm}
                                        onChange={e => setSupplierSearchTerm(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="max-h-[200px] overflow-y-auto space-y-1 custom-scrollbar pr-1">
                                    <button onClick={addManualItem} className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-white/80 flex items-center gap-2 mb-2"><Plus size={14} /> Freitext / Manuell anlegen</button>
                                    {suppliers.filter(s => s.name.toLowerCase().includes(supplierSearchTerm.toLowerCase())).map(sup => (
                                        <button key={sup.id} onClick={() => addTempExternalItem(sup)} className="w-full text-left p-2.5 rounded-lg hover:bg-blue-500/10 hover:border-blue-500/30 border border-transparent flex justify-between items-center group transition-all mb-1">
                                            <span className="text-sm font-medium text-white/80 group-hover:text-blue-300 truncate">{sup.name}</span> <Plus size={16} className="text-white/20 group-hover:text-blue-400" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN - MATERIALS LIST */}
            <div className={`${isMobile ? 'w-full flex-1 shrink-0' : 'w-1/2 flex flex-col'} bg-transparent`}>
                <div className={`p-6 border-b border-white/5 flex justify-between items-center shrink-0 ${isMobile ? 'border-t' : ''}`}>
                    <h3 className="text-base font-bold text-white">Material ({tempItems.length})</h3>
                    {!isMobile && <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors "><X size={20} /></button>}
                </div>

                <div className={`${isMobile ? '' : 'flex-1 overflow-y-auto custom-scrollbar'} p-6 space-y-4`}>
                    {tempItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-white/20 gap-4">
                            <BoxSelect size={64} strokeWidth={0.5} />
                            <p className="text-sm font-medium">Leer.</p>
                        </div>
                    ) : (
                        tempItems.map(item => (
                            <div key={item.uniqueId}
                                className={`group relative bg-[#1c1f26] border ${item.isDragging ? 'border-emerald-500 bg-emerald-500/5' : 'border-white/5 hover:border-white/10'} rounded-2xl p-4 transition-all shadow-sm`}
                                onDragEnter={(e) => handleDragEnter(e, item.uniqueId)} onDragOver={(e) => handleDragOver(e, item.uniqueId)} onDragLeave={(e) => handleDragLeave(e, item.uniqueId)} onDrop={(e) => handleDrop(e, item.uniqueId)}
                            >
                                {/* HEADER ROW: Type, Name, Quantity */}
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${item.type === 'Stock' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                                                {item.type === 'Stock' ? 'Lager' : (item.supplierId ? 'Lieferant' : 'Manuell')}
                                            </span>
                                            {item.isBackorder && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20 uppercase">Rückstand</span>}
                                        </div>

                                        {item.type === 'Stock' ? (
                                            <div className="font-bold text-base text-white truncate pr-2" title={item.article?.name}>{item.article?.name}</div>
                                        ) : (
                                            <input
                                                className="w-full bg-transparent border-0 border-b border-white/10 text-white font-bold text-base focus:outline-none focus:border-blue-500/50 pb-0.5 placeholder-white/20 p-0"
                                                value={item.customName}
                                                onChange={(e) => updateTempItem(item.uniqueId, 'customName', e.target.value)}
                                                placeholder="Artikelbezeichnung..."
                                            />
                                        )}
                                    </div>

                                    <div className="flex items-center bg-[#111111] rounded-lg border border-white/5 shrink-0">
                                        <button onClick={() => updateTempItem(item.uniqueId, 'amount', Math.max(1, item.amount - 1))} className="w-8 h-8 flex items-center justify-center hover:bg-white/5 text-white/40 hover:text-white transition-colors rounded-l-lg"><ChevronDown size={14} /></button>
                                        <span className="font-mono text-sm font-bold text-white w-8 text-center">{item.amount}</span>
                                        <button onClick={() => updateTempItem(item.uniqueId, 'amount', item.amount + 1)} className="w-8 h-8 flex items-center justify-center hover:bg-white/5 text-white/40 hover:text-white transition-colors rounded-r-lg"><Plus size={14} /></button>
                                    </div>
                                </div>

                                {/* DETAILS ROW: Inputs */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                    <div className="relative group/input">
                                        <input
                                            className="w-full bg-[#111111]/50 border border-white/5 data-[filled=true]:border-white/10 focus:border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-white placeholder-transparent transition-all peer"
                                            placeholder="Notiz"
                                            value={item.notes || ''}
                                            onChange={(e) => updateTempItem(item.uniqueId, 'notes', e.target.value)}
                                            data-filled={!!item.notes}
                                            id={`note-${item.uniqueId}`}
                                        />
                                        <label htmlFor={`note-${item.uniqueId}`} className="absolute left-3 top-2 text-xs text-white/30 transition-all peer-focus:-top-2 peer-focus:left-1 peer-focus:text-[9px] peer-focus:text-emerald-400 peer-focus:bg-[#1c1f26] peer-focus:px-1 peer-not-placeholder-shown:-top-2 peer-not-placeholder-shown:left-1 peer-not-placeholder-shown:text-[9px] pointer-events-none peer-not-placeholder-shown:text-white/50 peer-not-placeholder-shown:bg-[#1c1f26] peer-not-placeholder-shown:px-1">
                                            Notiz / Info
                                        </label>
                                    </div>

                                    <div className="relative group/input">
                                        <input
                                            className="w-full bg-[#111111]/50 border border-white/5 data-[filled=true]:border-white/10 focus:border-blue-500/30 rounded-lg px-3 py-2 text-xs text-white placeholder-transparent transition-all peer font-mono"
                                            placeholder="Vorgang"
                                            value={item.externalReference || ''}
                                            onChange={(e) => updateTempItem(item.uniqueId, 'externalReference', e.target.value)}
                                            disabled={item.type === 'Stock'}
                                            data-filled={!!item.externalReference}
                                            id={`ref-${item.uniqueId}`}
                                        />
                                        <label htmlFor={`ref-${item.uniqueId}`} className="absolute left-3 top-2 text-xs text-white/30 transition-all peer-focus:-top-2 peer-focus:left-1 peer-focus:text-[9px] peer-focus:text-blue-400 peer-focus:bg-[#1c1f26] peer-focus:px-1 peer-not-placeholder-shown:-top-2 peer-not-placeholder-shown:left-1 peer-not-placeholder-shown:text-[9px] pointer-events-none peer-not-placeholder-shown:text-white/50 peer-not-placeholder-shown:bg-[#1c1f26] peer-not-placeholder-shown:px-1">
                                            {item.type === 'Stock' ? 'Kein Vorgang' : 'Vorgangsnummer'}
                                        </label>
                                    </div>
                                </div>

                                {/* FOOTER ROW: Attachments & Actions */}
                                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <input type="file" id={`file-${item.uniqueId}`} className="hidden" onChange={(e) => handleFileUpload(item.uniqueId, e.target.files)} />
                                            <label htmlFor={`file-${item.uniqueId}`} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${item.attachmentData ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-white/30 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                                                <Paperclip size={12} />
                                                {item.attachmentData ? 'Anhang' : 'Anhang'}
                                            </label>
                                            {item.attachmentData && (
                                                <button onClick={(e) => { e.preventDefault(); updateTempItem(item.uniqueId, 'attachmentData', undefined) }} className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5 hover:scale-110 transition-transform"><X size={8} /></button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button className="p-1.5 rounded text-white/20 hover:text-white hover:bg-white/5 transition-colors" title="Duplizieren"><Copy size={14} /></button>
                                        <div className="w-px h-3 bg-white/10 mx-1"></div>
                                        <button onClick={() => removeTempItem(item.uniqueId)} className="p-1.5 rounded text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition-colors" title="Entfernen"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-6 border-t border-white/5 flex justify-end gap-3 bg-[#111111]/30 shrink-0 sticky bottom-0 z-10 backdrop-blur-md">
                    <Button variant="secondary" onClick={onClose} className="h-10 px-6 bg-white/5 hover:bg-white/10 border-white/5 text-white/70 hover:text-white font-medium">Abbrechen</Button>
                    <Button onClick={handleFinalizeCreate} disabled={isSubmitting || tempItems.length === 0} icon={isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (isEditMode ? <Save size={18} /> : <Plus size={18} />)} className="h-10 px-6 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 font-medium">
                        {isEditMode ? 'Speichern' : 'Anlegen'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
