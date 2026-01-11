import React from 'react';
import { motion } from 'framer-motion';
import { Edit2, Printer, Trash2, Box, Package, Truck, CheckCircle2, AlertTriangle, Clock, Undo2, LogOut, FileText, Calendar } from 'lucide-react';
import { Commission } from '../types';

interface ExtendedCommission extends Commission {
    commission_items?: any[];
    suppliers?: { name: string };
}

interface CommissionCardProps {
    commission: ExtendedCommission;
    colorClass: string;
    onClick: (comm: ExtendedCommission) => void;
    onEdit?: (comm: ExtendedCommission) => void;
    onDelete?: (id: string, name: string, mode: 'trash' | 'permanent', e: React.MouseEvent) => void;
    onRestore?: (id: string, name: string, e: React.MouseEvent) => void;
    onWithdraw?: (comm: ExtendedCommission, e: React.MouseEvent) => void;
    onRevertWithdraw?: (comm: ExtendedCommission, e: React.MouseEvent) => void;
    onPrintLabel?: (id: string, name: string) => void;
    statusKey: 'ready' | 'preparing' | 'draft' | 'returnReady' | 'returnPending' | 'trash' | 'withdrawn' | 'missing';
}

export const CommissionCard: React.FC<CommissionCardProps> = ({
    commission,
    colorClass,
    onClick,
    onEdit,
    onDelete,
    onRestore,
    onWithdraw,
    onRevertWithdraw,
    onPrintLabel,
    statusKey
}) => {
    // Helper to calculate progress (if items are available)
    const calculateProgress = () => {
        if (!commission.commission_items || commission.commission_items.length === 0) return 0;
        const picked = commission.commission_items.filter(i => i.is_picked).length;
        return Math.round((picked / commission.commission_items.length) * 100);
    };

    const progress = calculateProgress();
    const isTrash = statusKey === 'trash';
    const isWithdrawn = statusKey === 'withdrawn';

    return (
        <motion.div
            layoutId={`comm-${commission.id}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ scale: 1.02, y: -2 }}
            className={`
                group relative p-4 rounded-3xl border border-current cursor-pointer transition-all duration-300 overflow-hidden
                bg-[#1A1C23] hover:bg-[#22252E]
                ${colorClass}
                border-opacity-20 hover:border-opacity-40 shadow-xl shadow-black/80
            `}
            onClick={() => onClick(commission)}
        >
            {/* Left Border Indicator */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-3xl transition-all duration-300 ${isTrash || isWithdrawn ? 'bg-gray-500' : 'bg-current opacity-50 group-hover:opacity-100'}`} />

            <div className="flex justify-between items-start mb-3 pl-3">
                <div>
                    <h3 className="font-bold text-lg text-white leading-tight mb-1">{commission.name}</h3>
                    <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                        {commission.created_at && (
                            <span className="flex items-center text-gray-500" title="Erstellt am">
                                <Calendar size={10} className="mr-1" />
                                {new Date(commission.created_at).toLocaleDateString()}
                            </span>
                        )}
                        {commission.order_number && (
                            <span className="bg-white/5 px-1.5 py-0.5 rounded flex items-center">
                                <FileText size={10} className="mr-1" />
                                {commission.order_number}
                            </span>
                        )}
                        {commission.suppliers?.name && (
                            <span className="text-gray-500 truncate max-w-[100px]" title={commission.suppliers.name}>
                                {commission.suppliers.name}
                            </span>
                        )}
                    </div>
                </div>

                {/* Quick Actions (Hover) */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isTrash && !isWithdrawn && onEdit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(commission); }}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-blue-400 transition-colors"
                            title="Bearbeiten"
                        >
                            <Edit2 size={14} />
                        </button>
                    )}

                    {/* Print Button if needed */}
                    {onPrintLabel && !isTrash && !isWithdrawn && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onPrintLabel(commission.id, commission.name); }}
                            className={`p-1.5 hover:bg-white/10 rounded-lg transition-colors ${commission.needs_label ? 'text-amber-400 animate-pulse' : 'text-gray-400'}`}
                            title="Etikett drucken"
                        >
                            <Printer size={14} />
                        </button>
                    )}

                    {onDelete && (
                        <button
                            onClick={(e) => onDelete(commission.id, commission.name, isTrash ? 'permanent' : 'trash', e)}
                            className="p-1.5 hover:bg-rose-500/20 rounded-lg text-rose-400 transition-colors"
                            title={isTrash ? "Endgültig löschen" : "Löschen"}
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content Body */}
            <div className="pl-3 space-y-3">
                {/* Notes */}
                {commission.notes && (
                    <div className="text-sm text-yellow-200/70 italic bg-yellow-500/5 p-2 rounded border border-yellow-500/10 line-clamp-2">
                        "{commission.notes}"
                    </div>
                )}

                {/* Item Preview Badges */}
                {commission.commission_items && commission.commission_items.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {commission.commission_items.slice(0, 4).map((item: any) => {
                            const isBo = item.is_backorder;
                            if (item.article) {
                                return (
                                    <span key={item.id} className={`px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1 max-w-[150px] truncate ${isBo ? 'bg-red-500/20 text-red-200 border-red-500/40' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'}`}>
                                        {item.amount > 1 && <span className="opacity-70 text-[10px]">{item.amount}x</span>}
                                        {item.article.name}
                                    </span>
                                );
                            }
                            if (item.custom_name || item.type === 'External') {
                                return (
                                    <span key={item.id} className={`px-2.5 py-0.5 rounded-full text-xs font-medium border max-w-[150px] truncate ${isBo ? 'bg-red-500/20 text-red-200 border-red-500/40' : 'bg-purple-500/10 text-purple-300 border-purple-500/20'}`}>
                                        {item.custom_name || 'Extern'}{item.external_reference ? `: ${item.external_reference}` : ''}
                                    </span>
                                );
                            }
                            return null;
                        })}
                        {commission.commission_items.length > 4 && (
                            <span className="px-1.5 py-0.5 text-[10px] text-gray-500 flex items-center">
                                +{commission.commission_items.length - 4} weitere
                            </span>
                        )}
                    </div>
                )}

                {/* Progress Bar (Only for Preparing) */}
                {statusKey === 'preparing' && (
                    <div className="w-full bg-gray-700/50 rounded-full h-1.5 mt-2 overflow-hidden">
                        <motion.div
                            className="h-full bg-blue-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                        />
                    </div>
                )}

                {/* Status Specific Info */}
                {statusKey === 'ready' && (
                    <div className="flex items-center text-emerald-400 text-xs mt-2 bg-emerald-500/10 p-1.5 rounded w-fit">
                        <CheckCircle2 size={12} className="mr-1.5" />
                        <span>Abholbereit</span>
                    </div>
                )}

                {/* Withdrawn/Trash Info */}
                {(isTrash || isWithdrawn) && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                        <div className={`text-xs flex items-center font-medium ${isTrash ? 'text-rose-300' : 'text-blue-300'}`}>
                            {isTrash ? <Trash2 size={12} className="mr-1.5" /> : <Clock size={12} className="mr-1.5" />}
                            {isTrash ? 'Gelöscht: ' : ''}
                            {new Date(isTrash && commission.deleted_at ? commission.deleted_at : commission.updated_at).toLocaleDateString()}
                        </div>
                        {isTrash && onRestore && (
                            <button
                                onClick={(e) => onRestore(commission.id, commission.name, e)}
                                className="text-xs text-emerald-400 hover:underline flex items-center"
                            >
                                <Undo2 size={12} className="mr-1" /> Wiederherstellen
                            </button>
                        )}
                        {isWithdrawn && onRevertWithdraw && (
                            <button
                                onClick={(e) => onRevertWithdraw(commission, e)}
                                className="text-xs text-blue-400 hover:underline flex items-center"
                            >
                                <Undo2 size={12} className="mr-1" /> Widerrufen
                            </button>
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    );
};
