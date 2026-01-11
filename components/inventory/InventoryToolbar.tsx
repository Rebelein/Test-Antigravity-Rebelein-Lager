
import React, { useRef, useState, useEffect } from 'react';
import { Search, ChevronDown, Check, ArrowUpDown } from 'lucide-react';
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
}

export const InventoryToolbar: React.FC<InventoryToolbarProps> = ({
    viewMode, setViewMode, currentWarehouse, warehouses, onWarehouseChange,
    searchTerm, setSearchTerm, activeFilter, setActiveFilter, sortConfig, setSortConfig
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
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex flex-col gap-4 shadow-lg sticky top-0 z-30">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                <div className="flex items-center gap-2 w-full sm:w-auto bg-black/20 p-1 rounded-xl border border-white/5">
                    <button onClick={() => setViewMode('primary')} className={`px-4 py-2 rounded-lg text-sm font-medium ${viewMode === 'primary' ? 'bg-emerald-600 text-white' : 'text-white/50'}`}>Lager</button>
                    <button onClick={() => setViewMode('secondary')} className={`px-4 py-2 rounded-lg text-sm font-medium ${viewMode === 'secondary' ? 'bg-blue-600 text-white' : 'text-white/50'}`}>Favorit</button>
                </div>
                <div className="relative flex-1 sm:flex-none min-w-[140px]" ref={dropdownRef}>
                    <button onClick={() => setIsWarehouseDropdownOpen(!isWarehouseDropdownOpen)} className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#1a1d24] border border-white/10 text-sm text-white shadow-lg backdrop-blur-xl hover:bg-white/5 transition-colors"><span className="truncate font-medium">{currentWarehouse ? currentWarehouse.name : 'Wählen...'}</span><ChevronDown size={14} className={`transition-transform duration-200 ${isWarehouseDropdownOpen ? 'rotate-180' : ''}`} /></button>
                    {isWarehouseDropdownOpen && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-[#1a1d24] border border-white/10 rounded-xl z-50 shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in zoom-in-95 origin-top-left">
                            <div className="max-h-60 overflow-y-auto p-1 space-y-1">
                                {warehouses.map(w => (
                                    <button key={w.id} onClick={() => handleWhChange(w.id)} className={`w-full text-left px-3 py-2.5 text-sm rounded-lg flex items-center justify-between group ${currentWarehouse?.id === w.id ? 'bg-emerald-500/10 text-emerald-400 font-medium' : 'text-white hover:bg-white/5'}`}><span>{w.name}</span>{currentWarehouse?.id === w.id && <Check size={14} />}</button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex items-center bg-black/20 border border-white/5 rounded-xl px-3 py-2 flex-1 w-full">
                    <Search size={16} className="text-white/40 mr-2" />
                    <input type="text" placeholder="Suchen... (oder 'LOC:...' scannen)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-sm text-white w-full" />
                </div>
            </div>

            {/* Filters & Sorting Row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 overflow-x-auto no-scrollbar pb-1">
                <div className="flex items-center gap-2">
                    {['Alle', 'Unter Soll', 'Bestellt'].map((filter) => (
                        <button key={filter} onClick={() => setActiveFilter(filter)} className={`px-3 py-1.5 rounded-lg text-sm border whitespace-nowrap ${activeFilter === filter ? 'bg-white/10 text-white border-white/10' : 'text-white/50 border-transparent hover:text-white'}`}>{filter}</button>
                    ))}
                </div>

                <div className="w-full sm:w-auto">
                    <GlassSelect
                        icon={<ArrowUpDown size={14} />}
                        value={`${sortConfig.key}-${sortConfig.direction}`}
                        onChange={(e) => {
                            const [key, direction] = e.target.value.split('-');
                            setSortConfig({ key: key as any, direction: direction as any });
                        }}
                        className="w-full sm:w-auto text-xs py-1.5 pl-9 pr-8 bg-black/20 border-white/5"
                    >
                        <option value="location-asc" className="bg-gray-900">Fach Nr. (Aufsteigend)</option>
                        <option value="location-desc" className="bg-gray-900">Fach Nr. (Absteigend)</option>
                        <option value="name-asc" className="bg-gray-900">Name (A-Z)</option>
                        <option value="name-desc" className="bg-gray-900">Name (Z-A)</option>
                    </GlassSelect>
                </div>
            </div>
        </div>
    );
};
