import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, Check, ArrowUpDown, Filter, Settings2 } from 'lucide-react';
import { GlassSelect } from '../UIComponents';
import { Warehouse } from '../../types';

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
}

export const InventoryToolbar: React.FC<InventoryToolbarProps> = ({
    viewMode, setViewMode, currentWarehouse, warehouses, onWarehouseChange,
    searchTerm, setSearchTerm, activeFilter, setActiveFilter, sortConfig, setSortConfig,
    isExpanded, onToggle
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

    return (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 flex flex-col gap-2 shadow-lg sticky top-0 z-30 transition-all duration-300">
            {/* Top Row: Warehouse Name & Search & Toggle */}
            <div className="flex items-center gap-2">
                {/* Compact Warehouse Indicator (Always visible) */}
                <div
                    className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/20 border border-white/5 cursor-pointer hover:bg-white/5 transition-colors overflow-hidden"
                    onClick={onToggle}
                >
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider leading-none mb-0.5">
                            {viewMode === 'primary' ? 'Lager' : 'Favorit'}
                        </span>
                        <span className="text-sm font-bold text-white truncate leading-none">
                            {currentWarehouse ? currentWarehouse.name : 'Kein Lager'}
                        </span>
                    </div>
                </div>

                {/* Search Bar (Always visible) */}
                <div className="flex-[2] flex items-center bg-black/20 border border-white/5 rounded-xl px-3 py-1.5">
                    <Search size={14} className="text-white/40 mr-2 shrink-0" />
                    <input
                        type="text"
                        placeholder="Suchen..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-transparent border-none outline-none text-sm text-white w-full"
                    />
                </div>

                {/* Toggle Button */}
                <button
                    onClick={onToggle}
                    className={`p-2 rounded-xl border transition-all ${isExpanded
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                        }`}
                >
                    <Settings2 size={18} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Expandable Section */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                        animate={{ height: 'auto', opacity: 1, marginTop: 4 }}
                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                        className="overflow-hidden flex flex-col gap-3"
                    >
                        {/* Warehouse Switching Buttons */}
                        <div className="flex items-center gap-2 w-full pt-1">
                            <div className="flex items-center gap-2 p-1 bg-black/20 rounded-xl border border-white/5 overflow-hidden">
                                <button onClick={() => setViewMode('primary')} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === 'primary' ? 'bg-emerald-600 text-white shadow-lg' : 'text-white/50 hover:text-white'}`}>Lager</button>
                                <button onClick={() => setViewMode('secondary')} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === 'secondary' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/50 hover:text-white'}`}>Favorit</button>
                            </div>

                            {/* Warehouse Dropdown (Detailed) */}
                            <div className="relative flex-1" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsWarehouseDropdownOpen(!isWarehouseDropdownOpen)}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white hover:bg-white/10 transition-colors"
                                >
                                    <span className="truncate">{currentWarehouse ? currentWarehouse.name : 'Lager wählen...'}</span>
                                    <ChevronDown size={12} className={`transition-transform duration-200 ${isWarehouseDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isWarehouseDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-2 w-full min-w-[200px] bg-slate-900 border border-white/10 rounded-xl z-50 shadow-2xl backdrop-blur-xl overflow-hidden">
                                        <div className="max-h-60 overflow-y-auto p-1 space-y-1">
                                            {warehouses.map(w => (
                                                <button key={w.id} onClick={() => handleWhChange(w.id)} className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between ${currentWarehouse?.id === w.id ? 'bg-emerald-500/10 text-emerald-400 font-medium' : 'text-white hover:bg-white/5'}`}>
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
                        <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2">
                            <div className="flex items-center gap-1.5">
                                {['Alle', 'Unter Soll', 'Bestellt'].map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => setActiveFilter(filter)}
                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${activeFilter === filter
                                            ? 'bg-white/10 text-white border-white/20'
                                            : 'text-white/40 border-transparent hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        {filter}
                                    </button>
                                ))}
                            </div>

                            <GlassSelect
                                icon={<ArrowUpDown size={12} />}
                                value={`${sortConfig.key}-${sortConfig.direction}`}
                                onChange={(e) => {
                                    const [key, direction] = e.target.value.split('-');
                                    setSortConfig({ key: key as any, direction: direction as any });
                                }}
                                className="text-[11px] py-1 pl-8 pr-7 bg-black/20 border-white/5 min-w-[130px]"
                            >
                                <option value="location-asc" className="bg-slate-900">Fach (Auf)</option>
                                <option value="location-desc" className="bg-slate-900">Fach (Ab)</option>
                                <option value="name-asc" className="bg-slate-900">Name (A-Z)</option>
                                <option value="name-desc" className="bg-slate-900">Name (Z-A)</option>
                            </GlassSelect>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
