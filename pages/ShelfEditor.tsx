
import React, { useState, useEffect } from 'react';
import { GlassCard, Button, GlassInput } from '../components/UIComponents';
import { supabase } from '../supabaseClient';
import { Warehouse } from '../types';
import { Library, ArrowRight, Edit2, Save, X, Loader2, Warehouse as WarehouseIcon, Truck, HardHat } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ShelfEditor: React.FC = () => {
    const navigate = useNavigate();

    // Data States
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
    const [shelves, setShelves] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit State
    const [editingShelf, setEditingShelf] = useState<string | null>(null);
    const [newShelfName, setNewShelfName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchWarehouses();
    }, []);

    useEffect(() => {
        if (selectedWarehouse) {
            fetchShelves(selectedWarehouse.id);
        }
    }, [selectedWarehouse]);

    const fetchWarehouses = async () => {
        setLoading(true);
        const { data } = await supabase.from('warehouses').select('*').order('name');
        if (data) {
            setWarehouses(data.map((w: any) => ({
                id: w.id,
                name: w.name,
                type: w.type,
                location: w.location
            })));
        }
        setLoading(false);
    };

    const fetchShelves = async (warehouseId: string) => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('articles')
                .select('category')
                .eq('warehouse_id', warehouseId);

            if (data) {
                const uniqueShelves = Array.from(new Set(data.map((a: any) => a.category || 'Sonstiges'))).sort();
                setShelves(uniqueShelves as string[]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenEdit = (shelf: string) => {
        setEditingShelf(shelf);
        setNewShelfName(shelf);
    };

    const handleSaveRename = async () => {
        if (!selectedWarehouse || !editingShelf || !newShelfName.trim()) return;
        if (editingShelf === newShelfName) {
            setEditingShelf(null);
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('articles')
                .update({ category: newShelfName.trim() })
                .eq('warehouse_id', selectedWarehouse.id)
                .eq('category', editingShelf);

            if (error) throw error;

            // Update local list
            setShelves(prev => {
                const newList = prev.filter(s => s !== editingShelf);
                if (!newList.includes(newShelfName.trim())) {
                    newList.push(newShelfName.trim());
                }
                return newList.sort();
            });

            setEditingShelf(null);
        } catch (err: any) {
            alert("Fehler beim Umbenennen: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getWarehouseIcon = (type: any) => {
        switch (type) {
            case 'Main': return <WarehouseIcon size={24} className="text-emerald-400" />;
            case 'Vehicle': return <Truck size={24} className="text-blue-400" />;
            case 'Site': return <HardHat size={24} className="text-amber-400" />;
            default: return <WarehouseIcon size={24} />;
        }
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-24 px-1">
            <header className="flex items-center gap-3">
                <button onClick={() => navigate('/dashboard')} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                    <ArrowRight className="rotate-180" size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-orange-100">
                        Regal-Editor
                    </h1>
                    <p className="text-white/50 text-xs">Kategorien verwalten & umbenennen</p>
                </div>
            </header>

            {!selectedWarehouse ? (
                // STEP 1: SELECT WAREHOUSE
                <div className="grid grid-cols-1 gap-4">
                    <h2 className="text-white/60 text-sm font-bold uppercase tracking-wider ml-1">Lager wählen</h2>
                    {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-white/30" /></div> :
                        warehouses.map(w => (
                            <GlassCard key={w.id} onClick={() => setSelectedWarehouse(w)} className="cursor-pointer hover:bg-white/10 transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                                        {getWarehouseIcon(w.type)}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-white group-hover:text-amber-200 transition-colors">{w.name}</h3>
                                        <p className="text-xs text-white/40">{w.location || 'Kein Standort'}</p>
                                    </div>
                                    <ArrowRight size={18} className="text-white/20 group-hover:text-white" />
                                </div>
                            </GlassCard>
                        ))}
                </div>
            ) : (
                // STEP 2: EDIT SHELVES
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                                {getWarehouseIcon(selectedWarehouse.type)}
                            </div>
                            <div>
                                <div className="font-bold text-white">{selectedWarehouse.name}</div>
                                <div className="text-xs text-white/50">{shelves.length} Kategorien gefunden</div>
                            </div>
                        </div>
                        <button onClick={() => { setSelectedWarehouse(null); setShelves([]); }} className="text-xs text-amber-400 hover:underline">Ändern</button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-amber-400" /></div>
                    ) : shelves.length === 0 ? (
                        <div className="text-center text-white/30 py-10">Keine Artikel/Kategorien in diesem Lager.</div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {shelves.map(shelf => (
                                <div key={shelf} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Library size={18} className="text-white/30" />
                                        <span className="font-medium text-white">{shelf}</span>
                                    </div>
                                    <button onClick={() => handleOpenEdit(shelf)} className="p-2 bg-white/5 hover:bg-white/20 rounded-lg text-white/60 hover:text-white transition-colors">
                                        <Edit2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* EDIT MODAL */}
            {editingShelf && (
                <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <GlassCard className="w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">Regal umbenennen</h3>
                            <button onClick={() => setEditingShelf(null)}><X className="text-white/50 hover:text-white" /></button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl text-xs text-blue-200">
                                Alle Artikel im Lager <b>"{selectedWarehouse?.name}"</b> mit der Kategorie <b>"{editingShelf}"</b> werden verschoben.
                            </div>

                            <div>
                                <label className="text-xs text-white/50 mb-1 block">Neuer Name</label>
                                <GlassInput
                                    value={newShelfName}
                                    onChange={e => setNewShelfName(e.target.value)}
                                    autoFocus
                                    placeholder="Neuer Name..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6 justify-end">
                            <Button variant="secondary" onClick={() => setEditingShelf(null)}>Abbrechen</Button>
                            <Button onClick={handleSaveRename} disabled={isSubmitting || !newShelfName.trim()} className="bg-amber-600 hover:bg-amber-500">
                                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Speichern'}
                            </Button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};

export default ShelfEditor;
