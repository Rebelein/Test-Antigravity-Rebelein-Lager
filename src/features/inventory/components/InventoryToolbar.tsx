'use client';
import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Check, ArrowUpDown, SlidersHorizontal, ChevronUp, Building2, AlertTriangle } from 'lucide-react';
import { GlassSelect } from '../../../components/UIComponents';
import { Warehouse } from '../../../../types';
import { clsx } from 'clsx';

interface InventoryToolbarProps {
    viewMode: 'primary' | 'secondary';
    setViewMode: (mode: 'primary' | 'secondary') => void;
    currentWarehouse: Warehouse | undefined;
    warehouses: Warehouse[];
    onWarehouseChange: (id: string) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    activeFilter: string;
    setActiveFilter: (filter: string) => void;
    sortConfig: { key: string; direction: 'asc' | 'desc' };
    setSortConfig: (config: { key: string; direction: 'asc' | 'desc' }) => void;
    isExpanded: boolean;
    onToggle: () => void;
    lowStockCount?: number;
}

export const InventoryToolbar: React.FC<InventoryToolbarProps> = ({
    viewMode, setViewMode, currentWarehouse, warehouses, onWarehouseChange,
    searchTerm, setSearchTerm, activeFilter, setActiveFilter, sortConfig, setSortConfig,
    isExpanded, onToggle, lowStockCount = 0
}) => {
    const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Click outside listener for dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsWarehouseDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleWhChange = (id: string) => {
        onWarehouseChange(id);
        setIsWarehouseDropdownOpen(false);
    };

    // Filter Mapping
    const filterMapping = [
        { id: 'all', label: 'Alle', color: 'emerald' },
        { id: 'low_stock', label: 'Unter Soll', color: 'rose' },
        { id: 'on_order', label: 'Bestellt', color: 'blue' }
    ];

    if (!isExpanded) {
        return (
            <motion.div
                key="inventory-pill"
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.9 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="fixed bottom-24 lg:bottom-6 right-6 z-[160] pointer-events-auto"
            >
                <button
                    onClick={onToggle}
                    className="flex items-center gap-2.5 px-4.5 py-3 rounded-full text-xs font-bold shadow-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-white/10 text-foreground dark:text-white hover:scale-105 active:scale-95 transition-all duration-200 select-none group cursor-pointer"
                >
                    <SlidersHorizontal size={14} className="text-emerald-500 dark:text-emerald-400 group-hover:rotate-180 transition-transform duration-300" />
                    <span>{currentWarehouse ? currentWarehouse.name : 'Kein Lager'}</span>
                    
                    {lowStockCount > 0 ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 dark:border-rose-500/30 text-[10px] font-extrabold animate-pulse">
                            <AlertTriangle size={10} className="shrink-0" />
                            {lowStockCount} Mängel
                        </span>
                    ) : (
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    )}
                    
                    <ChevronUp size={13} className="text-foreground/40 dark:text-white/40 group-hover:text-foreground dark:group-hover:text-foreground transition-colors" />
                </button>
            </motion.div>
        );
    }

    return (
        <motion.div
            key="inventory-dock"
            initial={{ opacity: 0, y: 40, scale: 0.95, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: 40, scale: 0.95, x: '-50%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-24 lg:bottom-6 left-1/2 z-[160] w-[min(94vw,500px)] rounded-2xl bg-white/100 dark:bg-zinc-950/95 backdrop-blur-2xl backdrop-saturate-150 border border-zinc-200 dark:border-white/10 shadow-2xl p-4 flex flex-col gap-4 pointer-events-auto animate-in fade-in"
        >
            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-white/5 pb-2.5">
                <div className="flex items-center gap-2">
                    <SlidersHorizontal size={14} className="text-emerald-500 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-foreground dark:text-white uppercase tracking-wider">Filter & Lager</span>
                    {lowStockCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[11px] font-bold">
                            {lowStockCount} Artikel unter Soll
                        </span>
                    ) : (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
                            Bestände gesund
                        </span>
                    )}
                </div>
                <button
                    onClick={onToggle}
                    className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-foreground/40 dark:text-white/40 hover:text-foreground dark:hover:text-foreground transition-all cursor-pointer min-w-[44px] min-h-[44px]"
                    title="Minimieren"
                    aria-label="Minimieren"
                >
                    <ChevronDown size={16} />
                </button>
            </div>

            {/* Warehouse Switcher & Selector */}
            <div className="flex items-center gap-2.5 w-full">
                {/* Lager / Favorit Segment switch */}
                <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-black/35 border border-zinc-200 dark:border-white/5 rounded-xl">
                    <button
                        onClick={() => setViewMode('primary')}
                        className={clsx(
                            "px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all select-none cursor-pointer",
                            viewMode === 'primary'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30 shadow-sm'
                                : 'text-foreground/40 dark:text-white/40 hover:text-foreground/70 dark:hover:text-foreground/70'
                        )}
                    >
                        Lager
                    </button>
                    <button
                        onClick={() => setViewMode('secondary')}
                        className={clsx(
                            "px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all select-none cursor-pointer",
                            viewMode === 'secondary'
                                ? 'bg-blue-500/10 dark:text-blue-400 text-blue-800 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30 shadow-sm'
                                : 'text-foreground/40 dark:text-white/40 hover:text-foreground/70 dark:hover:text-foreground/70'
                        )}
                    >
                        Favorit
                    </button>
                </div>

                {/* Dropdown Selector */}
                <div className="relative flex-1" ref={dropdownRef}>
                    <button
                        onClick={() => setIsWarehouseDropdownOpen(!isWarehouseDropdownOpen)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-black/20 border border-zinc-200 dark:border-white/5 text-xs text-foreground dark:text-white hover:bg-zinc-200/50 dark:hover:bg-black/35 hover:border-zinc-300 dark:hover:dark:border-white/10 border-border transition-colors select-none cursor-pointer"
                    >
                        <span className="truncate font-bold flex items-center gap-2">
                            <Building2 size={12} className="text-foreground/40 dark:text-white/40" />
                            {currentWarehouse ? currentWarehouse.name : 'Lager wählen...'}
                        </span>
                        <ChevronDown size={12} className={`text-foreground/40 dark:text-white/40 transition-transform duration-200 ${isWarehouseDropdownOpen ? 'rotate-180 text-foreground dark:text-white' : ''}`} />
                    </button>
                    
                    {isWarehouseDropdownOpen && (
                        <div className="absolute bottom-full left-0 mb-2 w-full min-w-[200px] bg-card dark:bg-[#18181b] border border-border dark:border-white/10 rounded-xl z-[170] shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
                            <div className="max-h-60 overflow-y-auto p-1.5 space-y-1">
                                {warehouses.map(w => (
                                    <button
                                        key={w.id}
                                        onClick={() => handleWhChange(w.id)}
                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                                            currentWarehouse?.id === w.id
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                                                : 'text-foreground/70 dark:text-white/70 hover:bg-muted dark:hover:bg-white/5'
                                        }`}
                                    >
                                        <span>{w.name}</span>
                                        {currentWarehouse?.id === w.id && <Check size={12} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Filters & Sorting */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-zinc-150 dark:border-white/5 pt-3">
                {/* Filter Pills */}
                <div className="flex items-center gap-1.5">
                    {filterMapping.map((filter) => {
                        const isActive = activeFilter === filter.id;
                        return (
                            <button
                                key={filter.id}
                                onClick={() => setActiveFilter(filter.id)}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border select-none cursor-pointer transition-all ${
                                    isActive
                                        ? filter.color === 'rose'
                                            ? 'bg-rose-500/10 border-rose-500/20 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 shadow-md shadow-rose-500/5'
                                            : filter.color === 'blue'
                                            ? 'bg-blue-500/10 border-blue-500/20 dark:border-blue-500/30 dark:text-blue-400 text-blue-800 dark:text-blue-400 shadow-md shadow-blue-500/5'
                                            : 'bg-emerald-500/10 border-emerald-500/20 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-md shadow-emerald-500/5'
                                        : 'bg-transparent border-transparent text-foreground/40 dark:text-white/40 hover:text-foreground/70 dark:hover:text-foreground/70 hover:bg-muted dark:hover:bg-white/5'
                                }`}
                            >
                                {filter.label}
                            </button>
                        );
                    })}
                </div>

                {/* Sort Dropdown */}
                <GlassSelect
                    icon={<ArrowUpDown size={12} className="text-foreground/40 dark:text-white/40" />}
                    value={`${sortConfig.key}-${sortConfig.direction}`}
                    onChange={(e) => {
                        const [key, direction] = e.target.value.split('-');
                        setSortConfig({ key: key as any, direction: direction as any });
                    }}
                    className="text-[10px] py-1.5 pl-8 pr-7 bg-zinc-100 dark:bg-black/20 border border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:dark:border-white/10 border-border hover:bg-zinc-200/50 dark:hover:bg-black/35 text-foreground dark:text-white transition-colors min-w-[130px]"
                >
                    <option value="location-asc" className="bg-card dark:bg-[#18181b] text-foreground dark:text-white">Fach (Auf)</option>
                    <option value="location-desc" className="bg-card dark:bg-[#18181b] text-foreground dark:text-white">Fach (Ab)</option>
                    <option value="name-asc" className="bg-card dark:bg-[#18181b] text-foreground dark:text-white">Name (A-Z)</option>
                    <option value="name-desc" className="bg-card dark:bg-[#18181b] text-foreground dark:text-white">Name (Z-A)</option>
                </GlassSelect>
            </div>
        </motion.div>
    );
};
