import React, { useState, useRef, useEffect } from 'react';
import { GlassModal, Button, GlassSelect, GlassInput } from '../../../components/UIComponents';
import { Warehouse, Article, Supplier, UserProfile } from '../../../../types';
import { supabase } from '../../../../supabaseClient';
import { createAIClient } from '../../../../utils/ai';
import { Truck, Box, Copy, FileText, Upload, Loader2, Plus, Minus, Trash2, RefreshCw, Wand2, Warehouse as WarehouseIcon, Check } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';

interface ManualOrderWizardModalProps {
    isOpen: boolean;
    onClose: () => void;
    warehouses: Warehouse[];
    suppliers: Supplier[];
    onOrderCreated: () => void;
}

export const ManualOrderWizardModal: React.FC<ManualOrderWizardModalProps> = ({
    isOpen,
    onClose,
    warehouses,
    suppliers,
    onOrderCreated
}) => {
    const { profile, user } = useAuth();
    
    // --- MANUAL ORDER WIZARD STATE ---
    const [manualWarehouseId, setManualWarehouseId] = useState('');
    const [manualSourceType, setManualSourceType] = useState<'primary' | 'secondary' | 'other' | null>(null);
    const [manualCommissionNumber, setManualCommissionNumber] = useState('');
    const [manualSupplierName, setManualSupplierName] = useState('');
    const [manualAiFile, setManualAiFile] = useState<File | null>(null);
    const [manualAiPreview, setManualAiPreview] = useState<string | null>(null);
    const [isManualAnalyzing, setIsManualAnalyzing] = useState(false);
    const [manualScannedItems, setManualScannedItems] = useState<{ sku: string, name: string, quantity: number, foundArticle?: Article, isFound: boolean }[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const manualFileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // --- MANUAL ADD ITEM STATE ---
    const [showAddItemForm, setShowAddItemForm] = useState(false);
    const [manualItemName, setManualItemName] = useState('');
    const [manualItemSku, setManualItemSku] = useState('');
    const [manualItemQuantity, setManualItemQuantity] = useState(1);

    // --- SUCCESS MODAL STATE ---
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
    const [createdOrderCommission, setCreatedOrderCommission] = useState<string | null>(null);
    const [createdOrderSupplierNumber, setCreatedOrderSupplierNumber] = useState('');
    const [supplierNumberSaved, setSupplierNumberSaved] = useState(false);

    // Initialize default warehouse
    useEffect(() => {
        if (isOpen && profile?.primary_warehouse_id && !manualWarehouseId) {
            handleManualWarehouseSelect(profile.primary_warehouse_id, 'primary');
        }
    }, [isOpen, profile]);

    // Cleanup on close
    useEffect(() => {
        if (!isOpen) {
            setManualWarehouseId('');
            setManualSourceType(null);
            setManualCommissionNumber('');
            setManualAiFile(null);
            setManualAiPreview(null);
            setManualScannedItems([]);
            setManualSupplierName('');
            setShowAddItemForm(false);
            setShowSuccessModal(false);
        }
    }, [isOpen]);

    const logOrderEvent = async (orderId: string, action: string, details: string) => {
        if (!user) return;
        try {
            await supabase.from('order_events').insert({
                order_id: orderId,
                user_id: user.id,
                action: action,
                details: details
            });
        } catch (err) {
            console.error("Failed to log order event", err);
        }
    };

    const handleManualWarehouseSelect = async (whId: string, type: 'primary' | 'secondary' | 'other') => {
        setManualWarehouseId(whId);
        setManualSourceType(type);

        try {
            const { count } = await supabase.from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('warehouse_id', whId);

            const wh = warehouses.find(w => w.id === whId);
            const safeName = wh?.name.replace(/[^a-zA-Z0-9]/g, '') || 'Lager';
            const nextNum = (count || 0) + 1;
            setManualCommissionNumber(`${safeName}-${nextNum.toString().padStart(4, '0')}`);
        } catch (e) {
            console.error(e);
        }
    };

    const handleManualFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setManualAiFile(file);
            const reader = new FileReader();
            reader.onload = (ev) => setManualAiPreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            const event = {
                target: { files: [file] }
            } as unknown as React.ChangeEvent<HTMLInputElement>;

            handleManualFileSelect(event);
        }
    };

    const analyzeDocument = async () => {
        if (!manualAiFile) return;
        setIsManualAnalyzing(true);

        try {
            const ai = createAIClient();
            const reader = new FileReader();
            await new Promise((resolve) => { reader.onload = resolve; reader.readAsDataURL(manualAiFile); });
            const base64Data = (reader.result as string).split(',')[1];

            const prompt = `
            Extract order items from this document.
            Return a JSON object with:
            - supplier_name: string (if detected)
            - items: array of objects with { sku: string (manufacturer or supplier part number), name: string, quantity: number }
            
            Ignore prices.
          `;

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [
                    { inlineData: { mimeType: manualAiFile.type, data: base64Data } },
                    { text: prompt }
                ],
                config: { responseMimeType: "application/json" }
            });

            if (response.text) {
                let text = response.text.trim();
                // Strip markdown formatting if present
                if (text.startsWith('```')) {
                    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
                }
                const result = JSON.parse(text);
                if (result.supplier_name) setManualSupplierName(result.supplier_name);

                const scanned = result.items || [];

                const matchedItems = await Promise.all(scanned.map(async (item: any) => {
                    let query = supabase.from('articles')
                        .select('*')
                        .or(`sku.eq.${item.sku},supplier_sku.eq.${item.sku},ean.eq.${item.sku}`)
                        .limit(1);

                    if (manualWarehouseId) {
                        query = query.eq('warehouse_id', manualWarehouseId);
                    }

                    const { data } = await query;

                    return {
                        sku: item.sku,
                        name: item.name,
                        quantity: item.quantity,
                        foundArticle: data && data.length > 0 ? data[0] : undefined,
                        isFound: !!(data && data.length > 0)
                    };
                }));

                setManualScannedItems(matchedItems);
            }
        } catch (e: any) {
            alert("KI Fehler: " + e.message);
        } finally {
            setIsManualAnalyzing(false);
        }
    };

    const handleResetManualScan = () => {
        setManualAiFile(null);
        setManualAiPreview(null);
        setManualScannedItems([]);
        setManualSupplierName('');
    };

    const handleManualAddItem = () => {
        if (!manualItemName) return;
        setManualScannedItems(prev => [
            {
                name: manualItemName,
                sku: manualItemSku,
                quantity: manualItemQuantity,
                isFound: false,
                foundArticle: undefined
            },
            ...prev
        ]);
        setManualItemName('');
        setManualItemSku('');
        setManualItemQuantity(1);
        setShowAddItemForm(false);
    };

    const handleRemoveManualItem = (index: number) => {
        setManualScannedItems(prev => prev.filter((_, i) => i !== index));
    };

    const saveManualOrder = async () => {
        if (!manualWarehouseId || manualScannedItems.length === 0) return;
        setIsSubmitting(true);
        try {
            const { data: orderData, error } = await supabase.from('orders').insert({
                supplier: manualSupplierName || 'Manuell',
                date: new Date().toISOString(),
                status: 'Ordered',
                item_count: manualScannedItems.length,
                total: 0,
                warehouse_id: manualWarehouseId,
                commission_number: manualCommissionNumber
            }).select().single();

            if (error) throw error;

            for (const item of manualScannedItems) {
                const payload: any = {
                    order_id: orderData.id,
                    quantity_ordered: item.quantity
                };

                if (item.isFound && item.foundArticle) {
                    payload.article_id = item.foundArticle.id;
                    await supabase.from('articles').update({ on_order_date: new Date().toISOString() }).eq('id', item.foundArticle.id);
                } else {
                    payload.custom_name = item.name;
                    payload.custom_sku = item.sku;
                }

                await supabase.from('order_items').insert(payload);
            }

            await logOrderEvent(orderData.id, 'Neue Bestellung', `Manuelle Bestellung bei ${manualSupplierName || 'Manuell'}`);

            setCreatedOrderId(orderData.id);
            setCreatedOrderCommission(manualCommissionNumber);
            setCreatedOrderSupplierNumber('');
            setShowSuccessModal(true);
            onOrderCreated();

        } catch (e: any) {
            alert("Fehler: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateOrderSupplierNumber = async () => {
        if (!createdOrderId) return;
        try {
            const { error } = await supabase.from('orders').update({ supplier_order_number: createdOrderSupplierNumber }).eq('id', createdOrderId);
            if (error) throw error;

            setSupplierNumberSaved(true);
            setTimeout(() => setSupplierNumberSaved(false), 2000);
            onOrderCreated(); // Refresh potential parent lists again
        } catch (e: any) {
            alert("Fehler beim Speichern: " + e.message);
        }
    };

    return (
        <>
            <GlassModal isOpen={isOpen && !showSuccessModal} onClose={onClose} title="Manuelle Bestellung erfassen / Digitalisieren">
                <div className="flex flex-col h-[70vh]">
                    <div className="p-6 flex-1 overflow-y-auto space-y-6">

                        {/* SECTION 1: WAREHOUSE SELECTOR */}
                        <div className="space-y-3">
                            <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Ziel-Lager wählen</label>
                            <div className="flex gap-2">
                                {/* Primary / Secondary Switch */}
                                {profile?.primary_warehouse_id && (
                                    <div className="flex bg-black/30 p-1 rounded-lg border border-border shrink-0">
                                        <button
                                            onClick={() => handleManualWarehouseSelect(profile.primary_warehouse_id!, 'primary')}
                                            className={`p-2 rounded-md transition-all ${manualSourceType === 'primary' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-white'}`}
                                            title={warehouses.find(w => w.id === profile.primary_warehouse_id)?.name}
                                        >
                                            <WarehouseIcon size={20} />
                                        </button>
                                        {profile.secondary_warehouse_id && (
                                            <button
                                                onClick={() => handleManualWarehouseSelect(profile.secondary_warehouse_id!, 'secondary')}
                                                className={`p-2 rounded-md transition-all ${manualSourceType === 'secondary' ? 'bg-blue-600 text-white shadow-lg' : 'text-muted-foreground hover:text-white'}`}
                                                title={warehouses.find(w => w.id === profile.secondary_warehouse_id)?.name}
                                            >
                                                <Truck size={20} />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Dropdown for others */}
                                <div className="flex-1">
                                    <GlassSelect
                                        value={manualSourceType === 'other' ? manualWarehouseId : ''}
                                        onChange={(e) => {
                                            if (e.target.value) handleManualWarehouseSelect(e.target.value, 'other');
                                        }}
                                        className="py-2.5 text-sm"
                                    >
                                        <option value="" disabled className="bg-background">Anderes Lager...</option>
                                        {warehouses.map(w => (
                                            <option key={w.id} value={w.id} className="bg-background">{w.name}</option>
                                        ))}
                                    </GlassSelect>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 2: COMMISSION NUMBER */}
                        {manualCommissionNumber && (
                            <div
                                className="p-3 bg-primary/10 border border-emerald-500/20 rounded-xl cursor-pointer hover:bg-primary/20 transition-colors flex items-center justify-between group"
                                onClick={() => { navigator.clipboard.writeText(manualCommissionNumber); alert("Kopiert!"); }}
                            >
                                <div>
                                    <div className="text-[10px] text-emerald-300 uppercase font-bold mb-0.5">Kommission</div>
                                    <div className="text-lg font-mono text-white font-bold">{manualCommissionNumber}</div>
                                </div>
                                <Copy size={18} className="text-emerald-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                            </div>
                        )}

                        <div className="h-px bg-muted w-full"></div>

                        {/* SECTION 3: CONTENT AREA (Upload OR List) */}
                        {manualScannedItems.length === 0 && !showAddItemForm ? (
                            // STATE A: UPLOAD
                            <div className="space-y-4 animate-in fade-in">
                                <div className="text-sm text-muted-foreground text-center">Dokument scannen (Lieferschein / Bestellung)</div>
                                <div
                                    onClick={() => manualFileInputRef.current?.click()}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    className={`border-2 border-dashed rounded-2xl h-40 flex flex-col items-center justify-center cursor-pointer transition-all ${isDragging
                                        ? 'border-emerald-500 bg-primary/10 scale-[1.02]'
                                        : 'border-border hover:border-emerald-500/50 hover:bg-muted bg-black/20'
                                        }`}
                                >
                                    {manualAiFile ? (
                                        manualAiFile.type.startsWith('image/') && manualAiPreview ? (
                                            <img src={manualAiPreview} className="h-full w-full object-contain rounded-xl p-2" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-muted-foreground h-full p-4">
                                                <FileText size={48} className="text-red-400 mb-2" />
                                                <span className="text-xs text-center break-all">{manualAiFile.name}</span>
                                            </div>
                                        )
                                    ) : (
                                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                                            <Upload size={32} />
                                            <span className="text-xs">Bild oder PDF wählen</span>
                                        </div>
                                    )}
                                    <input type="file" ref={manualFileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleManualFileSelect} />
                                </div>
                                <Button
                                    onClick={analyzeDocument}
                                    disabled={!manualAiFile || isManualAnalyzing}
                                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 border-none h-12"
                                >
                                    {isManualAnalyzing ? <Loader2 className="animate-spin" /> : <span className="flex items-center gap-2"><Wand2 size={18} /> Analysieren</span>}
                                </Button>

                                <div className="flex items-center gap-3 pt-2">
                                    <div className="h-px bg-muted flex-1"></div>
                                    <span className="text-xs text-muted-foreground uppercase">Oder</span>
                                    <div className="h-px bg-muted flex-1"></div>
                                </div>

                                <Button
                                    onClick={() => setShowAddItemForm(true)}
                                    variant="secondary"
                                    className="w-full h-12"
                                    icon={<Plus size={18} />}
                                >
                                    Manuell Position erfassen
                                </Button>
                            </div>
                        ) : showAddItemForm ? (
                            // STATE C: ADD ITEM FORM
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                                <div className="text-center mb-4">
                                    <h3 className="text-lg font-bold text-white">Position hinzufügen</h3>
                                    <p className="text-xs text-muted-foreground">Artikel wird als Freiposition (ohne Lagerbestand) erfasst.</p>
                                </div>

                                <div className="space-y-3">
                                    {/* OPTIONAL SUPPLIER SELECTION (Global for this order) */}
                                    <div className="bg-muted p-3 rounded-xl border border-border mb-4">
                                        <h4 className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Lieferant der Bestellung</h4>
                                        <div className="space-y-2">
                                            <GlassSelect
                                                value=""
                                                onChange={(e) => {
                                                    if (e.target.value) setManualSupplierName(e.target.value);
                                                }}
                                                className="text-xs py-2"
                                            >
                                                <option value="">Aus Großhändler-Liste wählen...</option>
                                                {suppliers.map(s => (
                                                    <option key={s.id} value={s.name}>{s.name}</option>
                                                ))}
                                            </GlassSelect>

                                            <input
                                                className="w-full bg-black/20 border-b border-border p-2 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-white/30"
                                                value={manualSupplierName}
                                                onChange={e => setManualSupplierName(e.target.value)}
                                                placeholder="Oder externer Lieferant Name"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-muted-foreground block mb-1">Artikelbezeichnung <span className="text-red-400">*</span></label>
                                        <GlassInput
                                            autoFocus={false}
                                            value={manualItemName}
                                            onChange={e => setManualItemName(e.target.value)}
                                            placeholder="z.B. Schrauben M8x40"
                                            className="w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground block mb-1">Artikelnummer / SKU (Optional)</label>
                                        <GlassInput
                                            value={manualItemSku}
                                            onChange={e => setManualItemSku(e.target.value)}
                                            placeholder="Optional"
                                            className="w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground block mb-1">Menge</label>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setManualItemQuantity(Math.max(1, manualItemQuantity - 1))} className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover:bg-muted"><Minus size={18} /></button>
                                            <GlassInput
                                                type="number"
                                                min={1}
                                                value={manualItemQuantity}
                                                onChange={e => setManualItemQuantity(parseInt(e.target.value) || 1)}
                                                className="w-20 text-center"
                                            />
                                            <button onClick={() => setManualItemQuantity(manualItemQuantity + 1)} className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover:bg-muted"><Plus size={18} /></button>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <Button onClick={() => setShowAddItemForm(false)} variant="secondary" className="flex-1">Abbrechen</Button>
                                    <Button
                                        onClick={handleManualAddItem}
                                        disabled={!manualItemName}
                                        className="flex-1 bg-primary hover:bg-primary"
                                        icon={<Plus size={18} />}
                                    >
                                        Hinzufügen
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            // STATE B: ITEM LIST
                            <div className="space-y-4 animate-in slide-in-from-right-4">
                                <div className="flex justify-between items-center">
                                    <div className="text-sm text-muted-foreground">Gefunden: {manualScannedItems.length} Pos.</div>
                                    <div className="flex gap-3">
                                        <button onClick={() => setShowAddItemForm(true)} className="text-xs text-emerald-400 hover:text-white flex items-center gap-1 transition-colors">
                                            <Plus size={12} /> Position hinzufügen
                                        </button>
                                        <button onClick={handleResetManualScan} className="text-xs text-blue-400 hover:text-white flex items-center gap-1 transition-colors">
                                            <RefreshCw size={12} /> Neu scannen
                                        </button>
                                    </div>
                                </div>

                                {manualSupplierName && (
                                    <div className="bg-muted px-3 py-2 rounded-lg border border-border flex justify-between items-center">
                                        <span className="text-xs text-muted-foreground">Lieferant:</span>
                                        <span className="font-bold text-white text-sm">{manualSupplierName}</span>
                                    </div>
                                )}

                                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                                    {manualScannedItems.map((item, idx) => (
                                        <div key={idx} className={`p-3 rounded-xl border flex justify-between items-center ${item.isFound ? 'bg-primary/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                                            <div className="flex-1 min-w-0 pr-2">
                                                <div className="text-sm font-bold text-white truncate">{item.isFound ? item.foundArticle?.name : item.name}</div>
                                                <div className="text-xs text-muted-foreground flex gap-2">
                                                    <span className="font-mono">{item.sku}</span>
                                                    {!item.isFound && <span className="text-amber-400 font-bold text-[9px] uppercase border border-amber-500/30 px-1 rounded">Manuell</span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="font-bold text-white text-lg">x{item.quantity}</div>
                                                <button
                                                    onClick={() => handleRemoveManualItem(idx)}
                                                    className="p-2 text-muted-foreground hover:text-red-400 hover:bg-muted rounded-lg transition-colors"
                                                    title="Entfernen"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <Button onClick={saveManualOrder} disabled={isSubmitting} className="w-full bg-primary hover:bg-primary h-12 mt-4">
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : 'Bestellung anlegen'}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </GlassModal>

            {/* SUCCESS MODAL */}
            {showSuccessModal && (
                <GlassModal
                    isOpen={showSuccessModal}
                    onClose={() => { setShowSuccessModal(false); onClose(); }}
                    title="Bestellung erfolgreich angelegt"
                    className="max-w-md"
                >
                    <div className="p-6 space-y-6 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-2">
                            <Check size={32} className="text-emerald-400" />
                        </div>

                        <div className="text-center w-full">
                            <div className="text-sm text-muted-foreground mb-1">Kommissionsnummer</div>
                            <div
                                className="bg-muted border border-border rounded-xl p-4 flex items-center justify-center gap-3 cursor-pointer hover:bg-muted transition-colors group"
                                onClick={() => { if (createdOrderCommission) { navigator.clipboard.writeText(createdOrderCommission); alert("Kopiert!"); } }}
                            >
                                <span className="text-2xl font-mono font-bold text-white tracking-wider">{createdOrderCommission}</span>
                                <Copy size={18} className="text-emerald-400 opacity-50 group-hover:opacity-100" />
                            </div>
                        </div>

                        <div className="w-full bg-muted rounded-xl p-4 border border-border">
                            <label className="text-xs text-muted-foreground block mb-2">Bestellnummer vom Lieferanten (falls zur Hand)</label>
                            <div className="flex gap-2">
                                <input
                                    className={`flex-1 bg-black/20 border-b border-border p-2 text-white font-mono focus:outline-none focus:border-emerald-500 ${supplierNumberSaved ? 'border-emerald-500 text-emerald-400' : ''}`}
                                    onChange={e => setCreatedOrderSupplierNumber(e.target.value)}
                                    value={createdOrderSupplierNumber}
                                    placeholder="Nr. eintragen..."
                                />
                                <Button
                                    onClick={updateOrderSupplierNumber}
                                    size="sm"
                                    className={`shrink-0 ${supplierNumberSaved ? 'bg-primary hover:bg-primary' : ''}`}
                                >
                                    {supplierNumberSaved ? <Check size={16} /> : 'Speichern'}
                                </Button>
                            </div>
                        </div>

                        <Button onClick={() => { setShowSuccessModal(false); onClose(); }} className="w-full" variant="secondary">
                            Schließen
                        </Button>
                    </div>
                </GlassModal>
            )}
        </>
    );
};
