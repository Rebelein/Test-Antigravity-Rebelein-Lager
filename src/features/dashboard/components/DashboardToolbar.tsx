import React from 'react';
import { History, RefreshCw, Grid } from 'lucide-react';
import { ShinyText } from '../../../components/ui/ShinyText';

interface DashboardToolbarProps {
    profileName?: string;
    isLoading: boolean;
    onRefresh: () => void;
    onShowHistory: () => void;
    onShowDrawer: () => void;
}

export const DashboardToolbar: React.FC<DashboardToolbarProps> = ({
    profileName,
    isLoading,
    onRefresh,
    onShowHistory,
    onShowDrawer
}) => {
    return (
        <header className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-3xl font-bold">
                    <ShinyText text={profileName ? `Moin, ${profileName.split(' ')[0]}` : 'Dashboard'} />
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Aktueller Statusbericht</p>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={onShowHistory}
                    className="relative p-3 rounded-xl bg-muted border border-border text-muted-foreground hover:text-white hover:bg-muted transition-all duration-300 shadow-lg group"
                    title="Versionsverlauf anzeigen"
                >
                    <History size={20} />
                    <span className="absolute -top-2 -right-2 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-black/50">
                        v0.0.70
                    </span>
                </button>
                <button
                    onClick={onRefresh}
                    className="p-3 rounded-xl bg-muted border border-border text-muted-foreground hover:text-white hover:bg-muted transition-all duration-300 shadow-lg"
                    title="Aktualisieren"
                >
                    <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
                </button>
                <button
                    onClick={onShowDrawer}
                    className="p-3 rounded-xl bg-muted border border-border text-muted-foreground hover:text-white hover:bg-muted transition-all duration-300 shadow-lg"
                >
                    <Grid size={24} />
                </button>
            </div>
        </header>
    );
};
