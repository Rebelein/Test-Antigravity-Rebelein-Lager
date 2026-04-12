import React from 'react';
import { History, RefreshCw, Grid } from 'lucide-react';

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
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                    {profileName ? `Moin, ${profileName.split(' ')[0]}` : 'Dashboard'}
                </h1>
                <p className="text-white/50 text-sm mt-1">Aktueller Statusbericht</p>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={onShowHistory}
                    className="relative p-3 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 shadow-lg group"
                    title="Versionsverlauf anzeigen"
                >
                    <History size={20} />
                    <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-black/50">
                        v0.0.70
                    </span>
                </button>
                <button
                    onClick={onRefresh}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 shadow-lg"
                    title="Aktualisieren"
                >
                    <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
                </button>
                <button
                    onClick={onShowDrawer}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 shadow-lg"
                >
                    <Grid size={24} />
                </button>
            </div>
        </header>
    );
};
