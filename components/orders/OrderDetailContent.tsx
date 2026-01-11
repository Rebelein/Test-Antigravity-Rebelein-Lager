import React, { useState, useEffect } from 'react';
import { Button, GlassInput } from '../UIComponents';
import { Loader2, X, Truck, PackageCheck, Archive, FileDown, AlertTriangle, Plus, Minus } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Order, OrderItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface OrderDetailContentProps {
    order: Order;
    onClose: () => void;
    onUpdate: () => void; // Trigger refresh of parent list
}

interface ReceivingItem {
    id: string;
    articleId?: string;
    quantityOrdered: number;
    quantityReceived: number;
    articleName: string;
    articleSku: string;
    customName?: string;
    customSku?: string;
    newTotalReceived: number; // The target total quantity
}

export const OrderDetailContent: React.FC<OrderDetailContentProps> = ({ order, onClose, onUpdate }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<ReceivingItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showVehicleDecision, setShowVehicleDecision] = useState(false);

    useEffect(() => {
        fetchItems();
    }, [order.id]);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('order_items')
                .select('*, articles(name, sku, supplier_sku, stock)')
                .eq('order_id', order.id);

            if (data) {
                const mappedItems = data.map((item: any) => {
                    return {
                        id: item.id,
                        articleId: item.article_id,
                        quantityOrdered: item.quantity_ordered,
                        quantityReceived: item.quantity_received,
                        articleName: item.articles?.name || item.custom_name,
                        articleSku: item.articles?.supplier_sku || item.articles?.sku || item.custom_sku,
                        customName: item.custom_name,
                        customSku: item.custom_sku,
                        // Default to current RECEIVED quantity (no change initially)
                        newTotalReceived: item.quantity_received
                    };
                });
                setItems(mappedItems);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleAmountChange = (index: number, val: number) => {
        if (isNaN(val)) val = 0;
        const newItems = [...items];
        // Allow going above ordered? Maybe, but let's clamp to 0 minimum.
        newItems[index].newTotalReceived = Math.max(0, val);
        setItems(newItems);
    };

    const handlePreReceive = () => {
        // Calculate total delta
        const totalDelta = items.reduce((sum, item) => sum + Math.abs(item.newTotalReceived - item.quantityReceived), 0);
        if (totalDelta === 0) {
            alert("Keine Änderungen vorgenommen.");
            return;
        }

        if (order.warehouseType === 'Vehicle') {
            const isFullReceive = items.every(i => i.newTotalReceived === i.quantityOrdered);
            if (isFullReceive) {
                setShowVehicleDecision(true);
                return;
            }
        }
        executeReceipt('Direct');
    };

    const executeReceipt = async (mode: 'Direct' | 'Commission') => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            let allCompleted = true;
            const isPickup = order.status === 'ReadyForPickup';

            for (const item of items) {
                const delta = item.newTotalReceived - item.quantityReceived;

                if (delta !== 0) {
                    if (!isPickup) {
                        await supabase.from('order_items').update({
                            quantity_received: item.newTotalReceived
                        }).eq('id', item.id);
                    }

                    // Only book stock if it's a real article (not custom) AND mode is Direct
                    if (mode === 'Direct' && item.articleId) {
                        const { data: art } = await supabase.from('articles').select('stock').eq('id', item.articleId).single();
                        if (art) {
                            const newStock = art.stock + delta;
                            const updates: any = { stock: newStock };

                            if (!isPickup && item.newTotalReceived >= item.quantityOrdered) {
                                updates.on_order_date = null;
                            }

                            await supabase.from('articles').update(updates).eq('id', item.articleId);

                            await supabase.from('stock_movements').insert({
                                article_id: item.articleId,
                                user_id: user.id,
                                amount: delta,
                                type: delta > 0 ? 'receive_goods' : 'correction',
                                reference: `Bestellung: ${order.supplier} (${delta > 0 ? '+' : ''}${delta})`
                            });
                        }
                    }
                }

                if (!isPickup) {
                    if (item.newTotalReceived < item.quantityOrdered) {
                        allCompleted = false;
                    }
                }
            }

            let newStatus = allCompleted ? 'Received' : 'PartiallyReceived';
            if (mode === 'Commission' && allCompleted) {
                newStatus = 'ReadyForPickup';
            }
            if (isPickup) {
                newStatus = 'Received';
            }

            await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);
            await supabase.from('order_events').insert({
                order_id: order.id,
                user_id: user.id,
                action: 'Wareneingang/Korrektur',
                details: `Status: ${newStatus}`
            });

            setShowVehicleDecision(false);
            onUpdate(); // Trigger refresh
        } catch (e: any) {
            alert("Fehler: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- CSV Download ---
    const handleDownloadCsv = () => {
        const csvContent = "data:text/csv;charset=utf-8,"
            + "Artikelnummer;Bezeichnung;Menge\n"
            + items.map((i) => `${i.articleSku || i.customSku || ''};${i.articleName || i.customName};${i.quantityOrdered}`).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Bestellung_${order.supplier}_${order.date}.csv`);
        document.body.appendChild(link);
        link.click();
    };

    return (
        <div className="flex flex-col h-full bg-[#1a1d24]">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        {order.supplier}
                        {order.status === 'Received' && <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded border border-emerald-500/30">Abgeschlossen</span>}
                    </h2>
                    <p className="text-sm text-white/50">{new Date(order.date).toLocaleDateString()} • {order.warehouseName}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleDownloadCsv} className="p-2 rounded-full hover:bg-white/10 text-emerald-400" title="CSV Download"><FileDown size={20} /></button>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white"><X size={20} /></button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-emerald-400" /></div> :
                    items.map((item, idx) => {
                        const delta = item.newTotalReceived - item.quantityReceived;
                        const isChange = delta !== 0;
                        const isFullyReceived = item.newTotalReceived >= item.quantityOrdered && item.quantityOrdered > 0;

                        return (
                            <div key={item.id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-4">

                                {/* Checkbox (Left) */}
                                {order.status !== 'Received' && (
                                    <div className="shrink-0">
                                        <button
                                            onClick={() => {
                                                const newVal = isFullyReceived ? item.quantityReceived : item.quantityOrdered;
                                                handleAmountChange(idx, newVal);
                                            }}
                                            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${isFullyReceived
                                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                                                : 'bg-white/5 border-white/10 text-white/20 hover:border-white/30'
                                                }`}
                                        >
                                            <PackageCheck size={20} />
                                        </button>
                                    </div>
                                )}

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-white truncate">{item.articleName || item.customName || 'Unbekannt'}</div>
                                            <div className="text-xs text-white/50 flex gap-2">
                                                <span>Art-Nr: {item.articleSku || item.customSku || '-'}</span>
                                                {!item.articleId && <span className="text-amber-400 font-bold bg-amber-900/30 px-1 rounded">Manuell</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {order.status !== 'Received' ? (
                                        <div className="flex items-center justify-between mt-2">
                                            <div className="text-xs flex flex-col">
                                                <span className="text-white/40">Ziel / Bestellt</span>
                                                <span className="font-bold text-white"><span className="text-emerald-400">{item.quantityReceived}</span> / {item.quantityOrdered}</span>
                                            </div>

                                            {/* Controls (Right) */}
                                            <div className="flex items-center gap-1 bg-black/30 rounded-lg p-1 border border-white/10">
                                                <button
                                                    onClick={() => handleAmountChange(idx, item.newTotalReceived - 1)}
                                                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                                                >
                                                    <Minus size={16} />
                                                </button>

                                                <GlassInput
                                                    type="number"
                                                    min={0}
                                                    value={item.newTotalReceived}
                                                    onChange={(e) => handleAmountChange(idx, parseInt(e.target.value))}
                                                    className="w-16 py-1 px-1 text-center font-mono text-sm border-none bg-transparent focus:ring-0"
                                                />

                                                <button
                                                    onClick={() => handleAmountChange(idx, item.newTotalReceived + 1)}
                                                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-2 py-1 rounded text-center mt-2">
                                            Vollständig Erhalten
                                        </div>
                                    )}

                                    {isChange && (
                                        <div className={`mt-2 text-xs px-2 py-1 rounded flex items-center gap-2 ${delta > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-300'}`}>
                                            {delta > 0 ? <Plus size={10} /> : <AlertTriangle size={10} />}
                                            <span className="font-bold">{delta > 0 ? '+' : ''}{delta}</span>
                                            <span>{delta > 0 ? 'werden gebucht' : 'Korrektur (Abzug)'}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })
                }
            </div>

            {/* Footer Actions */}
            <div className="p-4 sm:p-6 border-t border-white/10 bg-white/5 shrink-0 flex flex-col gap-3">
                {order.status !== 'Received' && !showVehicleDecision && (
                    <div className="flex gap-3">
                        {order.status === 'ReadyForPickup' ? (
                            <Button onClick={() => executeReceipt('Direct')} icon={isSubmitting ? <Loader2 className="animate-spin" /> : <Truck size={16} />} disabled={isSubmitting} className="flex-1 bg-emerald-600 hover:bg-emerald-500">
                                Abholen / Verladen
                            </Button>
                        ) : (
                            <Button onClick={handlePreReceive} icon={isSubmitting ? <Loader2 className="animate-spin" /> : <PackageCheck size={16} />} disabled={isSubmitting} className="flex-1 bg-emerald-600 hover:bg-emerald-500">
                                Änderungen Speichern / Buchen
                            </Button>
                        )}
                    </div>
                )}

                {showVehicleDecision && (
                    <div className="bg-black/50 p-4 rounded-xl border border-white/10 animate-in fade-in slide-in-from-bottom-2">
                        <div className="text-center mb-3">
                            <h3 className="font-bold text-white">Fahrzeugbestellung</h3>
                            <p className="text-xs text-white/60">Direkt buchen oder zur Abholung?</p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Button onClick={() => executeReceipt('Direct')} className="bg-emerald-600 hover:bg-emerald-500" icon={<PackageCheck size={16} />}>Direkt Verladen (Bestand +)</Button>
                            <Button onClick={() => executeReceipt('Commission')} variant="secondary" icon={<Archive size={16} />}>Als Kommission bereitstellen</Button>
                            <button onClick={() => setShowVehicleDecision(false)} className="text-xs text-white/40 mt-2 hover:text-white">Abbrechen</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
