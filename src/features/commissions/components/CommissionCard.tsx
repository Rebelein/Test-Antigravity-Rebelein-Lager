import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Printer, Trash2, CheckCircle2, Clock, Undo2, FileText, Calendar, Package, AlertTriangle } from 'lucide-react';
import { Commission } from '../../../../types';

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
    className?: string;
}

// Color mapping based on statusKey
const getStatusColors = (statusKey: string) => {
    switch (statusKey) {
        case 'ready':
            return {
                border: 'border-emerald-500/50',
                leftBar: 'bg-primary',
                badge: 'bg-primary/20 dark:text-emerald-300 text-emerald-800 border-emerald-500/40',
                badgeText: 'Bereitgestellt'
            };
        case 'preparing':
            return {
                border: 'border-blue-500/50',
                leftBar: 'bg-blue-500',
                badge: 'bg-blue-500/20 dark:text-blue-300 text-blue-800 border-blue-500/40',
                badgeText: 'In Vorbereitung'
            };
        case 'draft':
            return {
                border: 'border-gray-500/50',
                leftBar: 'bg-gray-500',
                badge: 'bg-gray-500/20 dark:text-gray-300 text-gray-800 border-gray-500/40',
                badgeText: 'Entwurf'
            };
        case 'returnReady':
        case 'returnPending':
            return {
                border: 'border-purple-500/50',
                leftBar: 'bg-purple-500',
                badge: 'bg-purple-500/20 dark:text-purple-300 text-purple-800 border-purple-500/40',
                badgeText: statusKey === 'returnReady' ? 'Rückgabe bereit' : 'Rückgabe ausstehend'
            };
        case 'trash':
            return {
                border: 'border-rose-500/50',
                leftBar: 'bg-rose-500',
                badge: 'bg-rose-500/20 dark:text-rose-300 text-rose-800 border-rose-500/40',
                badgeText: 'Gelöscht'
            };
        case 'withdrawn':
            return {
                border: 'border-blue-400/50',
                leftBar: 'bg-blue-400',
                badge: 'bg-blue-400/20 dark:text-blue-200 text-blue-900 border-blue-400/40',
                badgeText: 'Ausgegeben'
            };
        case 'missing':
            return {
                border: 'border-amber-500/50',
                leftBar: 'bg-amber-500',
                badge: 'bg-amber-500/20 dark:text-amber-300 text-amber-800 border-amber-500/40',
                badgeText: 'Überfällig'
            };
        default:
            return {
                border: 'border-border',
                leftBar: 'bg-muted',
                badge: 'bg-muted text-muted-foreground border-border',
                badgeText: 'Unbekannt'
            };
    }
};

export const CommissionCard: React.FC<CommissionCardProps> = memo(({
    commission,
    colorClass,
    onClick,
    onEdit,
    onDelete,
    onRestore,
    onWithdraw,
    onRevertWithdraw,
    onPrintLabel,
    statusKey,
    className
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
    const itemCount = commission.commission_items?.length || 0;
    const statusColors = getStatusColors(statusKey);
    const hasBackorders = commission.commission_items?.some(i => i.is_backorder);

    return (
        <motion.div
            layoutId={`comm-${commission.id}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ scale: 1.01, y: -2 }}
            className={`
                group relative p-4 pl-5 rounded-xl cursor-pointer transition-all duration-300 overflow-hidden
                backdrop-blur-sm border shadow-lg shadow-black/40 hover:shadow-xl
                ${hasBackorders 
                    ? 'bg-gradient-to-br from-red-500/15 to-red-950/5 border-red-500/50 hover:from-red-500/20 hover:border-red-500/70 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]' 
                    : `bg-card ${statusColors.border} hover:bg-card hover:border-primary/40`}
                ${isTrash || isWithdrawn ? 'opacity-70 hover:opacity-100' : ''}
                ${className || ''}
            `}
            onClick={() => onClick(commission)}
        >
            {/* Left Color Indicator Bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl opacity-80 group-hover:opacity-100 transition-opacity ${hasBackorders ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : statusColors.leftBar}`} />

            {/* Header: Name + Meta + StatusBadge */}
            <div className="flex justify-between items-start gap-3 mb-3">
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-foreground leading-tight mb-1 truncate">
                        {commission.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        {commission.created_at && (
                            <span className="flex items-center">
                                <Calendar size={10} className="mr-1" />
                                {new Date(commission.created_at).toLocaleDateString()}
                            </span>
                        )}
                        {commission.order_number && (
                            <span className="font-mono bg-muted px-1.5 py-0.5 rounded flex items-center">
                                <FileText size={10} className="mr-1" />
                                {commission.order_number}
                            </span>
                        )}
                    </div>
                </div>

                {/* Colored StatusBadge */}
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border shadow-sm ${hasBackorders ? 'bg-red-500/20 dark:text-red-300 text-red-800 border-red-500/40 animate-pulse' : statusColors.badge}`}>
                    {hasBackorders ? `${statusColors.badgeText} (Rückstand)` : statusColors.badgeText}
                </span>
            </div>

            {/* Notes */}
            {commission.warehouse_notes && (
                <div className="text-sm font-medium dark:text-amber-200 text-amber-900 bg-amber-500/20 p-3 rounded-lg border border-amber-500/40 mb-3 shadow-inner flex items-start gap-2">
                    <AlertTriangle size={16} className="dark:text-amber-400 text-amber-800 mt-0.5 shrink-0" />
                    <div className="flex-1 whitespace-pre-wrap leading-tight">{commission.warehouse_notes}</div>
                </div>
            )}
            
            {commission.notes && (
                <div className="text-sm dark:text-yellow-100 text-amber-950/90 italic bg-yellow-500/10 p-2.5 rounded-lg border border-yellow-500/20 line-clamp-2 mb-3 shadow-inner">
                    "{commission.notes}"
                </div>
            )}

            {/* Item Preview Badges - With Supplier + Order Number */}
            {commission.commission_items && commission.commission_items.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {commission.commission_items.slice(0, 6).map((item: any) => {
                        const isBo = item.is_backorder;
                        const articleName = item.article?.name || item.custom_name || 'Extern';
                        const supplierName = item.article?.supplier || commission.suppliers?.name || '';
                        const externalRef = item.external_reference || '';

                        // Format: "Lieferant: Bestellnummer" or just article name
                        const displayText = supplierName && externalRef
                            ? `${supplierName}: ${externalRef}`
                            : supplierName
                                ? `${supplierName}: ${articleName}`
                                : articleName;

                        return (
                            <span
                                key={item.id}
                                className={`px-2.5 py-0.5 rounded-full text-xs font-medium truncate max-w-[180px] border ${isBo
                                    ? 'bg-red-500/20 dark:text-red-200 text-red-800 border-red-500/40'
                                    : 'bg-purple-500/15 dark:text-purple-200 text-purple-800 border-purple-500/30'
                                    }`}
                            >
                                {item.amount > 1 && <span className="opacity-70 mr-1">{item.amount}x</span>}
                                {displayText}
                            </span>
                        );
                    })}
                    {commission.commission_items.length > 6 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted border border-border text-muted-foreground">
                            +{commission.commission_items.length - 6} weitere
                        </span>
                    )}
                </div>
            )}

            {/* Progress Bar (Only for Preparing) */}
            {statusKey === 'preparing' && (
                <div className="w-full bg-card rounded-full h-1.5 mb-3 overflow-hidden">
                    <motion.div
                        className="h-full bg-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                    />
                </div>
            )}

            {/* Status Indicator (Ready = Abholbereit) */}
            {statusKey === 'ready' && (
                <div className="flex items-center dark:text-emerald-400 text-emerald-800 text-xs bg-primary/10 p-1.5 rounded w-fit mb-3">
                    <CheckCircle2 size={12} className="mr-1.5" />
                    <span>Abholbereit</span>
                </div>
            )}

            {/* Missing/Overdue Warning */}
            {statusKey === 'missing' && (
                <div className="flex items-center dark:text-amber-400 text-amber-800 text-xs bg-amber-500/10 p-1.5 rounded w-fit mb-3">
                    <AlertTriangle size={12} className="mr-1.5" />
                    <span>Überfällig</span>
                </div>
            )}

            {/* Footer with separator */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Package size={12} />
                    {itemCount} {itemCount === 1 ? 'Position' : 'Positionen'}
                </span>

                {/* Quick Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isTrash && !isWithdrawn && onEdit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(commission); }}
                            className="p-1.5 hover:bg-muted rounded-lg dark:text-blue-400 text-blue-800 transition-colors"
                            title="Bearbeiten"
                        >
                            <Edit2 size={14} />
                        </button>
                    )}

                    {onPrintLabel && !isTrash && !isWithdrawn && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onPrintLabel(commission.id, commission.name); }}
                            className={`p-1.5 hover:bg-muted rounded-lg transition-colors ${commission.needs_label ? 'dark:text-amber-400 text-amber-800 animate-pulse' : 'text-muted-foreground'}`}
                            title="Etikett drucken"
                        >
                            <Printer size={14} />
                        </button>
                    )}

                    {onDelete && (
                        <button
                            onClick={(e) => onDelete(commission.id, commission.name, isTrash ? 'permanent' : 'trash', e)}
                            className="p-1.5 hover:bg-rose-500/20 rounded-lg dark:text-rose-400 text-rose-800 transition-colors"
                            title={isTrash ? "Endgültig löschen" : "Löschen"}
                        >
                            <Trash2 size={14} />
                        </button>
                    )}

                    {isTrash && onRestore && (
                        <button
                            onClick={(e) => onRestore(commission.id, commission.name, e)}
                            className="p-1.5 hover:bg-primary/20 rounded-lg dark:text-emerald-400 text-emerald-800 transition-colors"
                            title="Wiederherstellen"
                        >
                            <Undo2 size={14} />
                        </button>
                    )}

                    {isWithdrawn && onRevertWithdraw && (
                        <button
                            onClick={(e) => onRevertWithdraw(commission, e)}
                            className="p-1.5 hover:bg-blue-500/20 rounded-lg dark:text-blue-400 text-blue-800 transition-colors"
                            title="Widerrufen"
                        >
                            <Undo2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Withdrawn/Trash Info Footer */}
            {(isTrash || isWithdrawn) && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t dark:border-white/5 border-border">
                    <div className={`text-xs flex items-center font-medium ${isTrash ? 'dark:text-rose-300 text-rose-800' : 'dark:text-blue-300 text-blue-800'}`}>
                        {isTrash ? <Trash2 size={12} className="mr-1.5" /> : <Clock size={12} className="mr-1.5" />}
                        {isTrash ? 'Gelöscht: ' : ''}
                        {new Date(isTrash && commission.deleted_at ? commission.deleted_at : commission.updated_at).toLocaleDateString()}
                    </div>
                </div>
            )}
        </motion.div>
    );
});
