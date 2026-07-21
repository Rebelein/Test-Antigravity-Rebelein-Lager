import React from 'react';
import { Search, Plus, ScanLine, Printer, Clock, RotateCcw, CheckCircle2, BoxSelect, Trash2, Menu, X } from 'lucide-react';
import { clsx } from 'clsx';

type CommissionTab = 'active' | 'returns' | 'withdrawn' | 'trash' | 'missing';

interface UnifiedCommissionHeaderProps {
    activeTab: CommissionTab;
    setActiveTab: (tab: CommissionTab) => void;
    activeSubFilter: string;
    setActiveSubFilter: (sub: any) => void;
    tabCounts: { returns: number; trash: number; withdrawn: number; ready: number };
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    onOpenCreate: () => void;
    onStartScan: () => void;
    onTogglePrintArea: () => void;
    showPrintArea: boolean;
    queueLength: number;
    isMobile: boolean;
    onOpenMobileCategory?: () => void;
}

export const UnifiedCommissionHeader: React.FC<UnifiedCommissionHeaderProps> = ({
    activeTab,
    setActiveTab,
    activeSubFilter,
    setActiveSubFilter,
    tabCounts,
    searchTerm,
    setSearchTerm,
    onOpenCreate,
    onStartScan,
    onTogglePrintArea,
    showPrintArea,
    queueLength,
    isMobile,
    onOpenMobileCategory
}) => {
    const tabs: { id: CommissionTab; label: string; count?: number }[] = [
        { id: 'active', label: 'Aktive' },
        { id: 'returns', label: 'Retouren', count: tabCounts.returns },
        { id: 'withdrawn', label: 'Ausgegeben', count: tabCounts.withdrawn },
        { id: 'trash', label: 'Papierkorb', count: tabCounts.trash },
    ];

    return (
        <div className="w-full bg-card/90 backdrop-blur-md border-b border-border/50 px-3 py-2 flex flex-col gap-2 shrink-0 z-20">
            <div className="flex items-center justify-between gap-2.5 flex-wrap sm:flex-nowrap">
                
                {/* Left: Title + Mobile Menu + Primary Tabs */}
                <div className="flex items-center gap-2 min-w-0">
                    {isMobile && onOpenMobileCategory && (
                        <button
                            onClick={onOpenMobileCategory}
                            className="p-1.5 rounded-lg bg-muted text-foreground border border-border"
                        >
                            <Menu size={18} />
                        </button>
                    )}

                    {/* Main Tabs */}
                    <div className="hidden md:flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border/50">
                        {tabs.map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id);
                                        setActiveSubFilter('all');
                                    }}
                                    className={clsx(
                                        "px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
                                        isActive
                                            ? "bg-card text-foreground font-bold shadow-xs border border-border/50"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <span>{tab.label}</span>
                                    {!!tab.count && tab.count > 0 && (
                                        <span className={clsx(
                                            "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                                            tab.id === 'returns' ? "bg-purple-500 text-white" : "bg-muted text-muted-foreground"
                                        )}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Center: Search Input */}
                <div className="flex-1 min-w-[140px] max-w-md relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Auftrag, Baustelle, Name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-8 pl-8 pr-7 bg-muted/50 border border-border/60 rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* Right: Minimalist Grouped Actions */}
                <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/50 shrink-0 shadow-xs">
                    {/* Print Queue Toggle */}
                    <button
                        onClick={onTogglePrintArea}
                        className={clsx(
                            "h-7 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer relative",
                            showPrintArea
                                ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30"
                                : "text-muted-foreground hover:text-foreground hover:bg-card"
                        )}
                        title="Druckbereich"
                    >
                        <Printer size={14} />
                        <span className="hidden sm:inline">Druck</span>
                        {queueLength > 0 && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        )}
                    </button>

                    <div className="w-px h-4 bg-border/60" />

                    {/* New Commission Button */}
                    <button
                        onClick={onOpenCreate}
                        className="h-7 px-3 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                    >
                        <Plus size={14} />
                        <span className="hidden sm:inline">Neu</span>
                    </button>
                </div>

            </div>
        </div>
    );
};
