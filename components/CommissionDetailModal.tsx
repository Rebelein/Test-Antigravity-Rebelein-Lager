import React, { useEffect, useState } from 'react';
import { GlassCard, Button, StatusBadge, GlassModal } from './UIComponents';
import { X, User, Calendar, FileText, Package, AlertTriangle, CheckCircle2, Edit2, Printer, ArrowRight } from 'lucide-react';
import { Commission, CommissionItem } from '../types';
import { supabase } from '../supabaseClient';

interface CommissionDetailModalProps {
    commission: Commission;
    onClose: () => void;
    onEdit?: () => void; // If provided, shows Edit button
}

export const CommissionDetailModal: React.FC<CommissionDetailModalProps> = ({ commission, onClose, onEdit }) => {
    const [items, setItems] = useState<CommissionItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(true);

    useEffect(() => {
        const fetchItems = async () => {
            setLoadingItems(true);
            const { data } = await supabase
                .from('commission_items')
                .select('*, article:articles(name, image_url)')
                .eq('commission_id', commission.id);

            if (data) {
                setItems(data);
            }
            setLoadingItems(false);
        };

        fetchItems();
    }, [commission.id]);

    return (
        <GlassModal isOpen={true} onClose={onClose}>
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-start shrink-0">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{commission.name}</h2>
                        {(() => {
                            const getStatusDetails = (status: string) => {
                                switch (status) {
                                    case 'Draft': return { label: 'Entwurf', type: 'neutral' as const };
                                    case 'Preparing': return { label: 'In Vorbereitung', type: 'warning' as const };
                                    case 'Ready': return { label: 'Bereitgestellt', type: 'success' as const };
                                    case 'Withdrawn': return { label: 'Abgeholt', type: 'info' as const };
                                    case 'ReturnPending': return { label: 'Retoure Angemeldet', type: 'warning' as const };
                                    case 'ReturnReady': return { label: 'Retoure Abholbereit', type: 'success' as const };
                                    case 'ReturnComplete': return { label: 'Retoure Abgeschlossen', type: 'neutral' as const };
                                    default: return { label: status, type: 'neutral' as const };
                                }
                            };
                            const details = getStatusDetails(commission.status);
                            return <StatusBadge status={details.label} type={details.type} />;
                        })()}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-white/50 flex items-center gap-4">
                        <span className="flex items-center gap-1.5"><FileText size={14} /> {commission.order_number || 'Keine Vorgangsnr.'}</span>
                        <span className="flex items-center gap-1.5"><Calendar size={14} /> {new Date(commission.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-white/50 transition-colors">
                        <X size={24} />
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6">
                {/* Notes */}
                {commission.notes && (
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-100 text-sm">
                        <div className="font-bold mb-1 flex items-center gap-2"><AlertTriangle size={14} /> Anmerkungen</div>
                        {commission.notes}
                    </div>
                )}

                {/* Items List */}
                <div>
                    <h3 className="text-sm font-bold text-gray-400 dark:text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Package size={16} /> Positionen ({items.length})
                    </h3>

                    {loadingItems ? (
                        <div className="py-8 text-center text-gray-400 dark:text-white/30 animate-pulse">Lade Positionen...</div>
                    ) : (
                        <div className="space-y-2">
                            {items.length === 0 && <div className="text-gray-400 dark:text-white/30 italic">Keine Positionen.</div>}
                            {items.map(item => (
                                <div key={item.id} className={`p-3 rounded-lg border flex items-center justify-between ${item.is_backorder ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/5'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-gray-200 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-white/50">
                                            {item.amount}x
                                        </div>
                                        <div>
                                            <div className="font-medium text-gray-900 dark:text-white text-sm">
                                                {item.type === 'Stock' ? item.article?.name : item.custom_name}
                                            </div>
                                            {item.notes && <div className="text-xs text-gray-500 dark:text-white/40 italic">{item.notes}</div>}
                                        </div>
                                    </div>
                                    {item.is_backorder && (
                                        <div className="px-2 py-1 rounded bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 text-[10px] font-bold uppercase">
                                            Rückstand
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Actions */}
            {onEdit && (
                <div className="p-6 pt-0 flex justify-end shrink-0">
                    <Button variant="secondary" onClick={onEdit} className="gap-2 w-full sm:w-auto justify-center bg-white/10 hover:bg-white/20 border-white/10 text-gray-700 dark:text-white">
                        <Edit2 size={16} /> Bearbeiten
                    </Button>
                </div>
            )}
        </GlassModal>
    );
};
