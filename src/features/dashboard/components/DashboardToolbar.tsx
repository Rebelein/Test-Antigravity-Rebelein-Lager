import React from 'react';
import { History, RefreshCw, Grid, SlidersHorizontal } from 'lucide-react';
import { ShinyText } from '../../../components/ui/ShinyText';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface DashboardToolbarProps {
    profileName?: string;
    isLoading: boolean;
    isCustomized: boolean;
    onRefresh: () => void;
    onShowHistory: () => void;
    onShowDrawer: () => void;
    onToggleCustomize: () => void;
}

export const DashboardToolbar: React.FC<DashboardToolbarProps> = ({
    profileName,
    isLoading,
    isCustomized,
    onRefresh,
    onShowHistory,
    onShowDrawer,
    onToggleCustomize,
}) => {
    const appVersion = process.env.APP_VERSION || '';

    return (
        <header className="flex items-center justify-between gap-3 shrink-0">
            <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold truncate">
                    <ShinyText text={profileName ? `Moin, ${profileName.split(' ')[0]}` : 'Dashboard'} />
                </h1>
                <p className="text-muted-foreground text-xs md:text-sm mt-0.5">
                    {format(new Date(), 'EEEE, d. MMMM', { locale: de })}
                </p>
            </div>
            <div className="flex gap-2 shrink-0">
                <button
                    onClick={onRefresh}
                    className="p-2.5 md:p-3 rounded-xl bg-card/80 backdrop-blur-md border border-border/80 text-muted-foreground hover:text-foreground hover:bg-card transition-all duration-300 shadow-lg"
                    title="Aktualisieren"
                >
                    <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
                </button>
                <button
                    onClick={onToggleCustomize}
                    className={`relative p-2.5 md:p-3 rounded-xl border transition-all duration-300 shadow-lg ${
                        isCustomized
                            ? 'bg-primary/10 border-emerald-500/40 dark:text-emerald-400 text-emerald-800'
                            : 'bg-card/80 backdrop-blur-md border-border/80 text-muted-foreground hover:text-foreground hover:bg-card'
                    }`}
                    title="Dashboard anpassen (Reihenfolge & Sichtbarkeit)"
                >
                    <SlidersHorizontal size={20} />
                </button>
                <button
                    onClick={onShowHistory}
                    className="relative p-2.5 md:p-3 rounded-xl bg-card/80 backdrop-blur-md border border-border/80 text-muted-foreground hover:text-foreground hover:bg-card transition-all duration-300 shadow-lg"
                    title="Versionsverlauf anzeigen"
                >
                    <History size={20} />
                    {appVersion && (
                        <span className="absolute -top-2 -right-2 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border dark:border-black/50 border-border">
                            v{appVersion}
                        </span>
                    )}
                </button>
                <button
                    onClick={onShowDrawer}
                    className="p-2.5 md:p-3 rounded-xl bg-card/80 backdrop-blur-md border border-border/80 text-muted-foreground hover:text-foreground hover:bg-card transition-all duration-300 shadow-lg"
                    title="Apps & Funktionen"
                >
                    <Grid size={20} />
                </button>
            </div>
        </header>
    );
};
