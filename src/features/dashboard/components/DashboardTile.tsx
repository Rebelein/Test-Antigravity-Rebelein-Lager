import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../../../components/UIComponents';

interface DashboardTileProps {
    /** Tile id – used as scroll anchor (`dashboard-tile-{tileId}`) */
    tileId: string;
    title: string;
    icon: React.ReactNode;
    /** Count badge shown next to the title (hidden when 0/undefined) */
    badgeCount?: number;
    badgeClassName?: string;
    /** Module route for the "open module" arrow (e.g. '/commissions') */
    navigateTo?: string;
    /** Tile-specific actions rendered in the header (e.g. "+ Neu") */
    headerActions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

/**
 * Unified dashboard tile shell: consistent 48px-ish header (icon, title, count
 * badge, actions, module link) + scrollable content area. Replaces the
 * duplicated header code that every old tile implemented on its own.
 */
export const DashboardTile: React.FC<DashboardTileProps> = React.memo(({
    tileId,
    title,
    icon,
    badgeCount,
    badgeClassName,
    navigateTo,
    headerActions,
    children,
    className = '',
}) => {
    const navigate = useNavigate();

    return (
        <GlassCard
            id={`dashboard-tile-${tileId}`}
            className={`flex flex-col h-full p-0 overflow-hidden scroll-mt-4 ${className}`}
            contentClassName="!p-0 flex flex-col h-full min-h-0"
        >
            <div className="px-5 py-3.5 border-b border-border/60 bg-white/[0.02] backdrop-blur-sm flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {icon}
                    <h2 className="text-base font-bold text-foreground truncate">{title}</h2>
                    {typeof badgeCount === 'number' && badgeCount > 0 && (
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badgeClassName || 'bg-muted text-muted-foreground border-border'}`}>
                            {badgeCount}
                        </span>
                    )}
                </div>
                {headerActions}
                {navigateTo && (
                    <button
                        onClick={() => navigate(navigateTo)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Modul öffnen"
                    >
                        <ArrowRight size={18} />
                    </button>
                )}
            </div>
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {children}
            </div>
        </GlassCard>
    );
});

DashboardTile.displayName = 'DashboardTile';
