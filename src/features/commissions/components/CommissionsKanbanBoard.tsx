import React from 'react';
import { ExtendedCommission, CommissionStatus } from '../../../../types';
import { CommissionCard } from './CommissionCard';
import { FileText, Clock, CheckCircle2, ArrowRight, Package, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface CommissionsKanbanBoardProps {
    commissions: ExtendedCommission[];
    onOpenDetail: (comm: ExtendedCommission) => void;
    onEdit: (comm: ExtendedCommission, e?: React.MouseEvent) => void;
    onDelete: (id: string, name: string, mode: 'trash' | 'permanent', e: React.MouseEvent) => void;
    onMoveStatus?: (comm: ExtendedCommission, nextStatus: CommissionStatus, e: React.MouseEvent) => void;
    searchTerm: string;
}

export const CommissionsKanbanBoard: React.FC<CommissionsKanbanBoardProps> = ({
    commissions,
    onOpenDetail,
    onEdit,
    onDelete,
    onMoveStatus,
    searchTerm
}) => {
    // Filter commissions by search term
    const filteredCommissions = commissions.filter(c => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
            c.name.toLowerCase().includes(q) ||
            (c.order_number || '').toLowerCase().includes(q) ||
            (c.customer_name || '').toLowerCase().includes(q)
        );
    });

    // Group into 3 columns
    const draftCommissions = filteredCommissions.filter(c => c.status === 'Draft');
    const preparingCommissions = filteredCommissions.filter(c => c.status === 'Preparing');
    const readyCommissions = filteredCommissions.filter(c => c.status === 'Ready');

    const columns = [
        {
            id: 'draft' as const,
            title: 'Entwürfe',
            count: draftCommissions.length,
            items: draftCommissions,
            icon: FileText,
            colorClass: 'text-slate-400',
            bgHeader: 'bg-slate-500/10 border-slate-500/20',
            badgeBg: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
            statusKey: 'draft' as const,
            nextStatus: 'Preparing' as CommissionStatus,
            nextLabel: 'In Vorbereitung'
        },
        {
            id: 'preparing' as const,
            title: 'In Vorbereitung',
            count: preparingCommissions.length,
            items: preparingCommissions,
            icon: Clock,
            colorClass: 'dark:text-blue-400 text-blue-700',
            bgHeader: 'bg-blue-500/10 border-blue-500/20',
            badgeBg: 'bg-blue-500/20 dark:text-blue-300 text-blue-800 border-blue-500/30',
            statusKey: 'preparing' as const,
            nextStatus: 'Ready' as CommissionStatus,
            nextLabel: 'Bereitstellen'
        },
        {
            id: 'ready' as const,
            title: 'Bereitgestellt',
            count: readyCommissions.length,
            items: readyCommissions,
            icon: CheckCircle2,
            colorClass: 'dark:text-emerald-400 text-emerald-700',
            bgHeader: 'bg-emerald-500/10 border-emerald-500/20',
            badgeBg: 'bg-emerald-500/20 dark:text-emerald-300 text-emerald-800 border-emerald-500/30',
            statusKey: 'ready' as const,
            nextStatus: 'Withdrawn' as CommissionStatus,
            nextLabel: 'Entnehmen'
        }
    ];

    return (
        <div className="w-full h-full grid grid-cols-1 md:grid-cols-3 gap-4 pb-20 overflow-hidden">
            {columns.map(col => {
                const IconComponent = col.icon;
                return (
                    <div
                        key={col.id}
                        className="flex flex-col h-full rounded-2xl bg-card/60 border border-border/60 backdrop-blur-md overflow-hidden shadow-xs"
                    >
                        {/* Column Header */}
                        <div className={clsx(
                            "px-4 py-3 border-b flex items-center justify-between shrink-0 font-bold",
                            col.bgHeader
                        )}>
                            <div className="flex items-center gap-2">
                                <IconComponent size={18} className={col.colorClass} />
                                <span className="text-sm text-foreground font-semibold">{col.title}</span>
                            </div>
                            <span className={clsx(
                                "px-2 py-0.5 rounded-full text-xs font-bold border",
                                col.badgeBg
                            )}>
                                {col.count}
                            </span>
                        </div>

                        {/* Column Scrollable Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                            {col.items.length === 0 ? (
                                <div className="h-32 flex flex-col items-center justify-center text-muted-foreground/60 text-xs italic border border-dashed border-border/40 rounded-xl">
                                    <Package size={24} className="mb-1 opacity-30" />
                                    <span>Keine Kommissionen</span>
                                </div>
                            ) : (
                                col.items.map(comm => (
                                    <div key={comm.id} className="relative group">
                                        <CommissionCard
                                            commission={comm}
                                            colorClass={col.bgHeader}
                                            statusKey={col.statusKey}
                                            onClick={onOpenDetail}
                                            onEdit={onEdit}
                                            onDelete={onDelete}
                                        />
                                        {/* Direct Quick Action Button on Kanban Card footer if onMoveStatus is provided */}
                                        {onMoveStatus && (
                                            <div className="mt-1.5 flex justify-end">
                                                <button
                                                    onClick={(e) => onMoveStatus(comm, col.nextStatus, e)}
                                                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-muted hover:bg-primary hover:text-white text-muted-foreground transition-all cursor-pointer flex items-center gap-1 border border-border/50 shadow-xs"
                                                >
                                                    <span>{col.nextLabel}</span>
                                                    <ArrowRight size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
