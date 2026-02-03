import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient';
import { GlassCard, Button, GlassModal } from '../../../components/UIComponents';
import { ArrowLeft, CheckCircle, Package, FileDown, ChevronDown, ChevronUp, User, Shirt, Filter, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { WorkwearOrder, WorkwearOrderItem } from '../../../../types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { clsx } from 'clsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AdminOrderManagementProps {
    onBack: () => void;
}

interface OrderDetail extends WorkwearOrder {
    profile: { full_name: string, email: string };
    items: (WorkwearOrderItem & { template_name: string, article_number: string })[];
}

export const AdminOrderManagement: React.FC<AdminOrderManagementProps> = ({ onBack }) => {
    const [orders, setOrders] = useState<OrderDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'REQUESTED' | 'ORDERED' | 'ALL'>('REQUESTED');
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

    const [logoUrl, setLogoUrl] = useState<string | null>(null);

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        action: 'DELETE_ORDER' | 'DELETE_ITEM' | null;
        orderId: string | null;
        itemId: string | null;
        isLoading: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        action: null,
        orderId: null,
        itemId: null,
        isLoading: false
    });

    useEffect(() => {
        fetchSettings();
        fetchOrders();
    }, [filterStatus]);

    const fetchSettings = async () => {
        const { data: settings } = await supabase.from('workwear_settings').select('logo_url').single();
        if (settings) setLogoUrl(settings.logo_url);
    };

    const fetchOrders = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('workwear_orders')
                .select(`
                    *,
                    profile:profiles(full_name, email)
                `)
                .order('created_at', { ascending: false });

            if (filterStatus !== 'ALL') {
                query = query.eq('status', filterStatus);
            }

            const { data: ordersData, error } = await query;
            if (error) throw error;

            if (!ordersData || ordersData.length === 0) {
                setOrders([]);
                setLoading(false);
                return;
            }

            // Fetch Items
            const orderIds = ordersData.map(o => o.id);
            const { data: itemsData, error: itemsError } = await supabase
                .from('workwear_order_items')
                .select(`
                    *,
                    workwear_templates (name, article_number)
                `)
                .in('order_id', orderIds);

            if (itemsError) throw itemsError;

            const combined = ordersData.map(order => ({
                ...order,
                items: itemsData
                    ?.filter(i => i.order_id === order.id)
                    .map(i => ({
                        ...i,
                        template_name: i.workwear_templates?.name,
                        article_number: i.workwear_templates?.article_number
                    })) || []
            }));

            setOrders(combined);

        } catch (error) {
            console.error(error);
            toast.error("Fehler beim Laden der Bestellungen");
        } finally {
            setLoading(false);
        }
    };

    const downloadLogo = async (e: React.MouseEvent, url: string) => {
        e.stopPropagation();
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = "Firmenlogo.png";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error("Download failed", error);
            window.open(url, '_blank');
        }
    };

    const handleConfirmAction = async () => {
        if (!confirmModal.action || !confirmModal.orderId) return;

        try {
            setConfirmModal(prev => ({ ...prev, isLoading: true }));

            if (confirmModal.action === 'DELETE_ORDER') {
                const { error } = await supabase.from('workwear_orders').delete().eq('id', confirmModal.orderId);
                if (error) throw error;
                toast.success("Bestellung gelöscht");
            }
            else if (confirmModal.action === 'DELETE_ITEM' && confirmModal.itemId) {
                const { error: delErr } = await supabase.from('workwear_order_items').delete().eq('id', confirmModal.itemId);
                if (delErr) throw delErr;

                // Recalculate
                const { data: remaining } = await supabase.from('workwear_order_items').select('price_at_order, quantity').eq('order_id', confirmModal.orderId);

                if (!remaining || remaining.length === 0) {
                    await supabase.from('workwear_orders').delete().eq('id', confirmModal.orderId);
                    toast.success("Bestellung gelöscht (da leer)");
                } else {
                    const newTotal = remaining.reduce((a, b) => a + (b.price_at_order * b.quantity), 0);
                    await supabase.from('workwear_orders').update({ total_amount: newTotal }).eq('id', confirmModal.orderId);
                    toast.success("Artikel entfernt");
                }
            }

            fetchOrders();
            setConfirmModal(prev => ({ ...prev, isOpen: false }));

        } catch (e) {
            console.error(e);
            toast.error("Fehler beim Ausführen");
        } finally {
            setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
    };

    const deleteOrder = (orderId: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Bestellung löschen",
            message: "Möchtest du diese Bestellung wirklich unwiderruflich löschen?",
            action: 'DELETE_ORDER',
            orderId,
            itemId: null,
            isLoading: false
        });
    };

    const deleteOrderItem = (order: OrderDetail, itemId: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Artikel entfernen",
            message: "Möchtest du diesen Artikel wirklich aus der Bestellung entfernen?",
            action: 'DELETE_ITEM',
            orderId: order.id,
            itemId,
            isLoading: false
        });
    };

    const markAsOrdered = async (orderId: string) => {
        try {
            const { error } = await supabase
                .from('workwear_orders')
                .update({ status: 'ORDERED', updated_at: new Date().toISOString() })
                .eq('id', orderId);

            if (error) throw error;
            toast.success("Als 'Bestellt' markiert");
            fetchOrders();
        } catch (e) {
            toast.error("Fehler beim Aktualisieren");
        }
    };

    const markAsCompleted = async (orderId: string) => {
        try {
            const { error } = await supabase
                .from('workwear_orders')
                .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
                .eq('id', orderId);

            if (error) throw error;
            toast.success("Bestellung abgeschlossen (Ausgabe an Mitarbeiter)");
            fetchOrders();
        } catch (e) {
            toast.error("Fehler beim Aktualisieren");
        }
    };

    const exportToPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.text("Bestellliste Arbeitskleidung", 14, 22);
        doc.setFontSize(10);
        doc.text(`Erstellt am: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 30);

        // Flatten items for table
        const tableRows: any[] = [];
        orders.forEach(order => {
            order.items.forEach(item => {
                tableRows.push([
                    order.profile?.full_name || 'Unbekannt',
                    item.article_number,
                    item.template_name,
                    item.size,
                    item.quantity,
                    item.use_logo ? 'Ja' : 'Nein',
                    order.id.slice(0, 8)
                ]);
            });
        });

        autoTable(doc, {
            head: [['Mitarbeiter', 'Art.Nr.', 'Artikel', 'Größe', 'Menge', 'Logo', 'Ref.']],
            body: tableRows,
            startY: 35,
        });

        doc.save(`Bestellung_Workwear_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const markAsReturned = async (orderId: string) => {
        try {
            const { error } = await supabase
                .from('workwear_orders')
                .update({ status: 'RETURNED' })
                .eq('id', orderId);

            if (error) throw error;
            toast.success("Bestellung retourniert (Budget erstattet)");
            fetchOrders();
        } catch (e) {
            console.error(e);
            toast.error("Fehler beim Aktualisieren");
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Button onClick={onBack} variant="ghost" className="rounded-full w-10 h-10 p-0 flex items-center justify-center">
                        <ArrowLeft size={20} />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Bestellübersicht</h2>
                        <p className="text-white/50">{orders.length} Bestellungen angezeigt</p>
                    </div>
                </div>

                <div className="flex gap-2 bg-black/20 p-1 rounded-lg">
                    <button
                        onClick={() => setFilterStatus('REQUESTED')}
                        className={clsx("px-4 py-2 rounded-md text-sm font-medium transition-colors", filterStatus === 'REQUESTED' ? "bg-amber-500/20 text-amber-400" : "text-white/50 hover:bg-white/5")}
                    >
                        Offen
                    </button>
                    <button
                        onClick={() => setFilterStatus('ORDERED')}
                        className={clsx("px-4 py-2 rounded-md text-sm font-medium transition-colors", filterStatus === 'ORDERED' ? "bg-blue-500/20 text-blue-400" : "text-white/50 hover:bg-white/5")}
                    >
                        Bestellt
                    </button>
                    <button
                        onClick={() => setFilterStatus('ALL')}
                        className={clsx("px-4 py-2 rounded-md text-sm font-medium transition-colors", filterStatus === 'ALL' ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5")}
                    >
                        Alle
                    </button>
                </div>
            </div>

            {/* Actions */}
            {filterStatus === 'REQUESTED' && orders.length > 0 && (
                <GlassCard className="p-4 flex justify-between items-center bg-emerald-500/5 border-emerald-500/10">
                    <div className="flex gap-4 items-center">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <FileDown size={20} />
                        </div>
                        <div>
                            <div className="font-bold text-white">Bestellliste exportieren</div>
                            <div className="text-xs text-white/50">PDF für Lieferanten generieren</div>
                        </div>
                    </div>
                    <Button onClick={exportToPDF} variant="secondary">Exportieren</Button>
                </GlassCard>
            )}

            {/* List */}
            <div className="space-y-4">
                {orders.map(order => (
                    <GlassCard key={order.id} className="overflow-hidden">
                        <div
                            onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                    <User size={18} className="text-white/70" />
                                </div>
                                <div>
                                    <div className="font-bold text-white">{order.profile?.full_name || 'Unbekannt'}</div>
                                    <div className="text-xs text-white/50 pb-1">{order.items.length} Artikel • Summe: {order.total_amount.toFixed(2)} €</div>
                                    <div className="text-[10px] text-white/30">{format(new Date(order.created_at), 'dd.MM.yyyy HH:mm')}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 md:gap-4">
                                {/* Status Actions */}
                                {order.status === 'REQUESTED' && (
                                    <Button
                                        onClick={(e) => { e.stopPropagation(); markAsOrdered(order.id); }}
                                        variant="ghost"
                                        className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs h-8 whitespace-nowrap"
                                    >
                                        Markieren als Bestellt
                                    </Button>
                                )}
                                {order.status === 'ORDERED' && (
                                    <Button
                                        onClick={(e) => { e.stopPropagation(); markAsCompleted(order.id); }}
                                        variant="ghost"
                                        className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs h-8 whitespace-nowrap"
                                    >
                                        Rückläufer / Ausgabe
                                    </Button>
                                )}
                                {order.status === 'COMPLETED' && (
                                    <Button
                                        onClick={(e) => { e.stopPropagation(); markAsReturned(order.id); }}
                                        variant="ghost"
                                        className="bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs h-8 whitespace-nowrap"
                                    >
                                        Als Retoure markieren
                                    </Button>
                                )}

                                <Button
                                    onClick={(e) => { e.stopPropagation(); deleteOrder(order.id); }}
                                    variant="ghost"
                                    className="w-8 h-8 p-0 flex items-center justify-center text-white/30 hover:text-rose-400 hover:bg-rose-500/10 rounded-full transition-colors shrink-0"
                                >
                                    <Trash2 size={16} />
                                </Button>

                                {expandedOrder === order.id ? <ChevronUp className="text-white/30" /> : <ChevronDown className="text-white/30" />}
                            </div>
                        </div>

                        {expandedOrder === order.id && (
                            <div className="bg-black/20 border-t border-white/5 p-4">
                                <table className="w-full text-sm text-left text-white/70">
                                    <thead className="text-xs text-white/30 uppercase bg-white/5">
                                        <tr>
                                            <th className="px-3 py-2 rounded-l">Artikel</th>
                                            <th className="px-3 py-2">Art.Nr.</th>
                                            <th className="px-3 py-2">Größe</th>
                                            <th className="px-3 py-2 text-center">Menge</th>
                                            <th className="px-3 py-2 text-right">Preis</th>
                                            <th className="px-2 py-2 rounded-r"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {order.items.map(item => (
                                            <tr key={item.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                                                <td className="px-3 py-2 flex items-center gap-2">
                                                    <div className="flex flex-col">
                                                        <span>{item.template_name}</span>
                                                        {item.use_logo && (
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-medium">MIT LOGO</span>
                                                                {logoUrl && (
                                                                    <button onClick={(e) => downloadLogo(e, logoUrl)} className="text-[10px] text-blue-400 hover:text-blue-300 underline flex items-center gap-0.5 bg-transparent border-0 cursor-pointer p-0">
                                                                        <FileDown size={10} /> Logo laden
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 font-mono text-xs opacity-50">{item.article_number}</td>
                                                <td className="px-3 py-2 text-white font-bold">{item.size}</td>
                                                <td className="px-3 py-2 text-center font-bold">{item.quantity}</td>
                                                <td className="px-3 py-2 text-right">{(item.price_at_order * item.quantity).toFixed(2)} €</td>
                                                <td className="px-2 py-2 text-right">
                                                    {order.status === 'REQUESTED' && (
                                                        <button
                                                            onClick={() => deleteOrderItem(order, item.id)}
                                                            className="text-white/30 hover:text-rose-400 p-1 bg-transparent border-0 cursor-pointer"
                                                            title="Artikel entfernen"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </GlassCard>
                ))}

                {orders.length === 0 && (
                    <div className="text-center py-12 text-white/30">
                        Keine Bestellungen mit Status "{filterStatus}" gefunden.
                    </div>
                )}
            </div>

            <GlassModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                title={confirmModal.title}
                className="max-w-[400px]"
            >
                <div className="p-6">
                    <p className="text-white/70 mb-8">{confirmModal.message}</p>
                    <div className="flex justify-end gap-4">
                        <Button
                            variant="ghost"
                            onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                            disabled={confirmModal.isLoading}
                        >
                            Abbrechen
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleConfirmAction}
                            isLoading={confirmModal.isLoading}
                        >
                            Löschen
                        </Button>
                    </div>
                </div>
            </GlassModal>
        </div>
    );
};
