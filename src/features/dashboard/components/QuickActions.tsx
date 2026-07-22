import React from 'react';
import {
    ScanLine, Plus, ClipboardList, PackagePlus,
    Factory, AlertTriangle, Wrench, Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuickActionsProps {
    officeCount: number;
    backlogCount: number;
    repairCount: number;
    /** smartphone = 2x2 big touch targets, otherwise slim single row */
    isCompact: boolean;
    onNewCommission: () => void;
}

const scrollToTile = (tileId: string) => {
    document.getElementById(`dashboard-tile-${tileId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

interface ChipConfig {
    show: boolean;
    label: string;
    count: number;
    tileId: string;
    icon: React.ReactNode;
    className: string;
}

export const QuickActions: React.FC<QuickActionsProps> = React.memo(({
    officeCount,
    backlogCount,
    repairCount,
    isCompact,
    onNewCommission,
}) => {
    const navigate = useNavigate();

    const actions = [
        {
            id: 'scanner',
            label: 'Scanner',
            icon: <ScanLine size={isCompact ? 26 : 20} />,
            onClick: () => navigate('/stocktaking'),
            className: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40',
        },
        {
            id: 'new-commission',
            label: 'Neue Komm.',
            icon: <Plus size={isCompact ? 26 : 20} />,
            onClick: onNewCommission,
            className: 'bg-card/80 backdrop-blur-md border border-border/80 shadow-lg text-foreground hover:bg-card hover:border-emerald-500/40',
        },
        {
            id: 'stocktaking',
            label: 'Inventur',
            icon: <ClipboardList size={isCompact ? 26 : 20} />,
            onClick: () => navigate('/audit'),
            className: 'bg-card/80 backdrop-blur-md border border-border/80 shadow-lg text-foreground hover:bg-card hover:border-purple-500/40',
        },
        {
            id: 'new-article',
            label: 'Neuer Artikel',
            icon: <PackagePlus size={isCompact ? 26 : 20} />,
            onClick: () => navigate('/inventory'),
            className: 'bg-card/80 backdrop-blur-md border border-border/80 shadow-lg text-foreground hover:bg-card hover:border-blue-500/40',
        },
    ];

    const chips: ChipConfig[] = [
        {
            show: officeCount > 0,
            label: 'Büro offen',
            count: officeCount,
            tileId: 'commissions',
            icon: <Factory size={13} />,
            className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20',
        },
        {
            show: backlogCount > 0,
            label: 'Rückstand',
            count: backlogCount,
            tileId: 'commissions',
            icon: <AlertTriangle size={13} />,
            className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20',
        },
        {
            show: repairCount > 0,
            label: 'Defekt',
            count: repairCount,
            tileId: 'machines',
            icon: <Wrench size={13} />,
            className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20',
        },
    ];

    const visibleChips = chips.filter(c => c.show);

    return (
        <div className="flex flex-col gap-3">
            {/* Action buttons */}
            <div className={isCompact ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-4 gap-3'}>
                {actions.map(action => (
                    <button
                        key={action.id}
                        onClick={action.onClick}
                        className={`
                            flex items-center justify-center gap-2 rounded-2xl font-bold transition-all active:scale-[0.97] cursor-pointer
                            ${isCompact ? 'flex-col min-h-[76px] py-3 text-sm' : 'flex-row h-12 text-sm px-3'}
                            ${action.className}
                        `}
                    >
                        {action.icon}
                        <span className="whitespace-nowrap">{action.label}</span>
                    </button>
                ))}
            </div>

            {/* Status chips – "Handlungsbedarf auf einen Blick" */}
            {visibleChips.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 -mb-1">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 pl-1">
                        <Zap size={12} />
                        <span className={isCompact ? 'sr-only' : ''}>Handlungsbedarf</span>
                    </span>
                    {visibleChips.map(chip => (
                        <button
                            key={chip.label}
                            onClick={() => scrollToTile(chip.tileId)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer ${chip.className}`}
                        >
                            {chip.icon}
                            {chip.count} {chip.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
});

QuickActions.displayName = 'QuickActions';
