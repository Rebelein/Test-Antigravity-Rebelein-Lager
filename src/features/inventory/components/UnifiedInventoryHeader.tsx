import React from 'react';
import { Search, Plus, Filter, ArrowUpDown, Building2, Check, X, ListChecks, CheckSquare, Menu } from 'lucide-react';
import { Warehouse, Article } from '../../../../types';
import { clsx } from 'clsx';

interface UnifiedInventoryHeaderProps {
    title?: string;
    warehouses: Warehouse[];
    currentWarehouse?: Warehouse;
    onWarehouseChange: (id: string) => void;
    viewMode: 'primary' | 'secondary';
    setViewMode: (mode: 'primary' | 'secondary') => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    activeFilter: string;
    setActiveFilter: (filter: string) => void;
    sortConfig: { key: string; direction: 'asc' | 'desc' };
    setSortConfig: (config: { key: string; direction: 'asc' | 'desc' }) => void;
    lowStockCount: number;
    onOpenNewArticle: () => void;
    isSelectionMode: boolean;
    onToggleSelectionMode: () => void;
    isMobile: boolean;
    onOpenMobileCategories?: () => void;
    selectedCategory?: string | null;
}

export const UnifiedInventoryHeader: React.FC<UnifiedInventoryHeaderProps> = ({
    title = 'Lagerbestand',
    warehouses,
    currentWarehouse,
    onWarehouseChange,
    viewMode,
    setViewMode,
    searchTerm,
    setSearchTerm,
    activeFilter,
    setActiveFilter,
    sortConfig,
    setSortConfig,
    lowStockCount,
    onOpenNewArticle,
    isSelectionMode,
    onToggleSelectionMode,
    isMobile,
    onOpenMobileCategories,
    selectedCategory
}) => {
    const [isWarehouseMenuOpen, setIsWarehouseMenuOpen] = React.useState(false);

    const filterMapping = [
        { id: 'all', label: 'Alle' },
        { id: 'low_stock', label: 'Unter Soll', count: lowStockCount },
        { id: 'on_order', label: 'Bestellt' }
    ];

    return (
        <div className="w-full bg-card/90 backdrop-blur-md border-b border-border/50 px-3 py-2 flex flex-col gap-2 shrink-0 z-20">
            {/* Main Single Bar */}
            <div className="flex items-center justify-between gap-2.5 flex-wrap sm:flex-nowrap">
                
                {/* Left: Mobile Menu + Title + Warehouse Dropdown */}
                <div className="flex items-center gap-2 min-w-0">
                    {isMobile && onOpenMobileCategories && (
                        <button
                            onClick={onOpenMobileCategories}
                            className="p-1.5 rounded-lg bg-muted text-foreground hover:bg-muted/80 border border-border"
                            title="Kategorien"
                        >
                            <Menu size={18} />
                        </button>
                    )}

                    <div className="flex items-center gap-2 min-w-0">
                        <h1 className="font-bold text-base sm:text-lg text-foreground truncate shrink-0">
                            {title}
                        </h1>
                        {selectedCategory && (
                            <span className="text-xs bg-primary/10 dark:text-emerald-400 text-emerald-800 px-2 py-0.5 rounded-md font-medium truncate max-w-[120px]">
                                {selectedCategory}
                            </span>
                        )}
                    </div>

                    {/* Warehouse Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setIsWarehouseMenuOpen(!isWarehouseMenuOpen)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted border border-border/60 text-xs font-medium text-foreground transition-colors cursor-pointer"
                        >
                            <Building2 size={13} className="text-primary" />
                            <span className="truncate max-w-[110px]">{currentWarehouse?.name || 'Lager'}</span>
                        </button>

                        {isWarehouseMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsWarehouseMenuOpen(false)} />
                                <div className="absolute left-0 top-full mt-1.5 w-52 bg-card border border-border rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1">
                                    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg mb-1">
                                        <button
                                            onClick={() => setViewMode('primary')}
                                            className={clsx(
                                                "flex-1 py-1 rounded text-[10px] font-bold uppercase transition-colors",
                                                viewMode === 'primary' ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            Hauptlager
                                        </button>
                                        <button
                                            onClick={() => setViewMode('secondary')}
                                            className={clsx(
                                                "flex-1 py-1 rounded text-[10px] font-bold uppercase transition-colors",
                                                viewMode === 'secondary' ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            Favorit
                                        </button>
                                    </div>

                                    {warehouses.map(w => (
                                        <button
                                            key={w.id}
                                            onClick={() => {
                                                onWarehouseChange(w.id);
                                                setIsWarehouseMenuOpen(false);
                                            }}
                                            className={clsx(
                                                "w-full text-left px-2.5 py-1.5 text-xs rounded-lg flex items-center justify-between transition-colors",
                                                currentWarehouse?.id === w.id ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted text-foreground"
                                            )}
                                        >
                                            <span className="truncate">{w.name}</span>
                                            {currentWarehouse?.id === w.id && <Check size={14} />}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Center: Inline Search Bar */}
                <div className="flex-1 min-w-[140px] max-w-md relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Artikel, SKU, EAN..."
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

                {/* Right: Filters, Sort & Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Filter Pills */}
                    <div className="hidden sm:flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/40">
                        {filterMapping.map(f => {
                            const isActive = activeFilter === f.id;
                            return (
                                <button
                                    key={f.id}
                                    onClick={() => setActiveFilter(f.id)}
                                    className={clsx(
                                        "px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap",
                                        isActive
                                            ? "bg-card text-foreground font-bold shadow-xs border border-border/50"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {f.label}
                                    {!!f.count && f.count > 0 && (
                                        <span className="ml-1 px-1 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-bold">
                                            {f.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Sort Select */}
                    <div className="relative">
                        <select
                            value={`${sortConfig.key}-${sortConfig.direction}`}
                            onChange={(e) => {
                                const [key, direction] = e.target.value.split('-');
                                setSortConfig({ key: key as any, direction: direction as any });
                            }}
                            className="h-8 pl-2 pr-6 bg-muted/50 border border-border/60 rounded-lg text-xs text-foreground focus:outline-none appearance-none cursor-pointer"
                        >
                            <option value="location-asc">Fach (Auf)</option>
                            <option value="location-desc">Fach (Ab)</option>
                            <option value="name-asc">Name (A-Z)</option>
                            <option value="name-desc">Name (Z-A)</option>
                        </select>
                        <ArrowUpDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>

                    {/* Multi-Select Toggle */}
                    <button
                        onClick={onToggleSelectionMode}
                        className={clsx(
                            "h-8 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer",
                            isSelectionMode
                                ? "bg-primary/20 border-primary text-primary font-bold"
                                : "bg-muted/50 border-border/60 text-muted-foreground hover:text-foreground"
                        )}
                        title={isSelectionMode ? "Auswahl beenden" : "Mehrfachauswahl"}
                    >
                        {isSelectionMode ? <CheckSquare size={14} /> : <ListChecks size={14} />}
                    </button>

                    {/* New Article Button */}
                    <button
                        onClick={onOpenNewArticle}
                        className="h-8 px-3 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                    >
                        <Plus size={15} />
                        <span className="hidden sm:inline">Neu</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
