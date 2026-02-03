import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient';
import { GlassCard, Button, GlassModal } from '../../../components/UIComponents';
import { Loader2, Package, Clock, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Shirt, User, Trash2 } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { clsx } from 'clsx';
import { WorkwearOrder, WorkwearOrderItem, WorkwearRole } from '../../../../types';

interface OrderWithItems extends WorkwearOrder {
    items: (WorkwearOrderItem & { template_name: string, template_image?: string })[];
    profile?: { full_name: string };
}

interface OrderHistoryProps {
    role?: WorkwearRole | null;
}

export const OrderHistory: React.FC<OrderHistoryProps> = ({ role }) => {
    const { user } = useAuth();
    const [orders, setOrders] = useState<OrderWithItems[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

    // Grouping state for admins
    const [expandedUser, setExpandedUser] = useState<string | null>(null);

    const isAdmin = role === 'chef' || role === 'besteller';

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        orderId: string | null;
        isLoading: boolean;
    }>({ isOpen: false, title: '', message: '', orderId: null, isLoading: false });

    useEffect(() => {
        if (user) fetchOrders();
    }, [user, role]);

    const handleConfirmAction = async () => {
        if (!confirmModal.orderId) return;

        try {
            setConfirmModal(prev => ({ ...prev, isLoading: true }));
            const { error } = await supabase.from('workwear_orders').delete().eq('id', confirmModal.orderId);
            if (error) throw error;
            toast.success("Bestellung gelöscht");
            fetchOrders();
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (e) {
            console.error(e);
            toast.error("Fehler beim Löschen");
        } finally {
            setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
    };

    const deleteOrder = (orderId: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Bestellung löschen",
            message: "Möchtest du diese Bestellung wirklich unwiderruflich löschen?",
            orderId,
            isLoading: false
        });
    };

    const fetchOrders = async () => {
        try {
            let query = supabase
                .from('workwear_orders')
                .select('*, profile:profiles(full_name)')
                .order('created_at', { ascending: false });

            // If NOT admin, filter by own ID. If admin, show all.
            if (!isAdmin) {
                query = query.eq('user_id', user?.id);
            }

            const { data: ordersData, error: ordersError } = await query;

            if (ordersError) throw ordersError;

            if (!ordersData || ordersData.length === 0) {
                setOrders([]);
                setLoading(false);
                return;
            }

            // Fetch Items
            const { data: itemsData, error: itemsError } = await supabase
                .from('workwear_order_items')
                .select(`
                    *,
                    workwear_templates (name, image_url)
                `)
                .in('order_id', ordersData.map(o => o.id));

            if (itemsError) throw itemsError;

            const combined: OrderWithItems[] = ordersData.map(order => ({
                ...order,
                items: itemsData
                    ?.filter(item => item.order_id === order.id)
                    .map(item => ({
                        ...item,
                        template_name: item.workwear_templates?.name || 'Unbekannter Artikel',
                        template_image: item.workwear_templates?.image_url
                    })) || []
            }));

            setOrders(combined);
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'REQUESTED': return { label: 'Angefragt', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: <Clock size={16} /> };
            case 'ORDERED': return { label: 'Bestellt', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: <Package size={16} /> };
            case 'COMPLETED': return { label: 'Abgeschlossen', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: <CheckCircle size={16} /> };
            case 'RETURNED': return { label: 'Retourniert', color: 'text-rose-400', bg: 'bg-rose-500/10', icon: <AlertCircle size={16} /> };
            default: return { label: status, color: 'text-white', bg: 'bg-white/10', icon: <Clock size={16} /> };
        }
    };

    const renderOrderCard = (order: OrderWithItems) => {
        const status = getStatusInfo(order.status);
        const isExpanded = expandedOrder === order.id;

        return (
            <GlassCard key={order.id} className="overflow-hidden transition-all duration-300 mb-4">
                <div
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5"
                >
                    <div className="flex items-center gap-4">
                        <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center", status.bg, status.color)}>
                            {status.icon}
                        </div>
                        <div>
                            <div className="font-bold text-white">Bestellung vom {format(new Date(order.created_at), 'dd.MM.yyyy', { locale: de })}</div>
                            <div className={clsx("text-xs font-medium", status.color)}>{status.label} • {order.items.length} Artikel</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <div className="font-mono font-bold text-emerald-400">{order.total_amount.toFixed(2)} €</div>
                            {isAdmin && <div className="text-xs text-white/40">{order.profile?.full_name}</div>}
                        </div>

                        {(isAdmin || order.status === 'REQUESTED') && (
                            <button
                                onClick={(e) => { e.stopPropagation(); deleteOrder(order.id); }}
                                className="w-8 h-8 flex items-center justify-center text-white/30 hover:text-rose-400 hover:bg-rose-500/10 rounded-full transition-colors"
                                title="Bestellung löschen"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}

                        {isExpanded ? <ChevronUp className="text-white/50" /> : <ChevronDown className="text-white/50" />}
                    </div>
                </div>

                {/* Details */}
                {isExpanded && (
                    <div className="bg-black/20 border-t border-white/5 p-4 space-y-3">
                        {order.items.map(item => (
                            <div key={item.id} className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/5 rounded overflow-hidden flex items-center justify-center shrink-0">
                                    {item.template_image ? <img src={item.template_image} className="w-full h-full object-cover" /> : <Shirt size={20} className="text-white/20" />}
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-white">{item.template_name}</div>
                                    <div className="text-xs text-white/50">Größe: {item.size} • Menge: {item.quantity} {item.use_logo && '• Mit Logo'}</div>
                                </div>
                                <div className="text-emerald-400 font-mono text-sm">
                                    {(item.price_at_order || 0).toFixed(2)} €
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </GlassCard>
        );
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-emerald-500" /></div>;

    if (orders.length === 0) {
        return (
            <div className="text-center py-12 text-white/50">
                <Package size={48} className="mx-auto mb-4 opacity-50" />
                <p>Noch keine Bestellungen vorhanden.</p>
            </div>
        );
    }

    // --- ADMIN VIEW: GROUP BY USER ---
    if (isAdmin) {
        // Group orders by user_id
        const groupedOrders: Record<string, { name: string, orders: OrderWithItems[] }> = {};

        orders.forEach(order => {
            const uid = order.user_id;
            const name = order.profile?.full_name || 'Unbekannt';
            if (!groupedOrders[uid]) {
                groupedOrders[uid] = { name, orders: [] };
            }
            groupedOrders[uid].orders.push(order);
        });

        const users = Object.entries(groupedOrders);

        return (
            <div className="space-y-4 max-w-3xl mx-auto">
                <div className="bg-amber-500/10 text-amber-300 p-4 rounded-lg mb-6 flex items-start gap-3 border border-amber-500/20">
                    <Clock className="shrink-0 mt-1" size={18} />
                    <div className="text-sm">
                        <span className="font-bold">Admin-Ansicht:</span> Hier siehst du alle Bestellungen deiner Mitarbeiter.
                        Wechsle zur "Verwaltung", um Bestellscheine zu exportieren.
                    </div>
                </div>

                {users.map(([userId, { name, orders }]) => (
                    <div key={userId} className="space-y-2">
                        <button
                            onClick={() => setExpandedUser(expandedUser === userId ? null : userId)}
                            className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                    <User size={16} />
                                </div>
                                <div>
                                    <div className="font-bold text-white">{name}</div>
                                    <div className="text-xs text-white/50">{orders.length} Bestellungen</div>
                                </div>
                            </div>
                            {expandedUser === userId ? <ChevronUp className="text-white/40" /> : <ChevronDown className="text-white/40" />}
                        </button>

                        {expandedUser === userId && (
                            <div className="pl-4 space-y-4 border-l-2 border-white/10 ml-4 py-2">
                                {orders.map(order => renderOrderCard(order))}
                            </div>
                        )}
                    </div>
                ))}

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
    }

    // --- NORMAL USER VIEW ---
    return (
        <div className="space-y-4 max-w-3xl mx-auto">
            {orders.map(order => renderOrderCard(order))}

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
