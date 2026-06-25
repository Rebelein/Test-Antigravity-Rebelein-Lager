
import React, { useState, useEffect } from 'react';
import { GlassCard, Button, GlassInput } from '../../components/UIComponents';
import { supabase } from '../../../supabaseClient';
import { useWarehouses } from '../../../hooks/queries';
import { Warehouse } from '../../../types';
import { Library, ArrowRight, Edit2, Save, X, Loader2, Warehouse as WarehouseIcon, Truck, HardHat } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ShelfEditor: React.FC = () => {
    const navigate = useNavigate();

    // Data States
    const { data: warehouses = [], isLoading: warehousesLoading } = useWarehouses();
    const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
    const [shelves, setShelves] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // Edit State
    const [editingShelf, setEditingShelf] = useState<string | null>(null);
    const [newShelfName, setNewShelfName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
    }, []);

    useEffect(() => {
        if (selectedWarehouse) {
            fetchShelves(selectedWarehouse.id);
        }
    }, [selectedWarehouse]);



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
            case 'Main': return <WarehouseIcon size={24} className="dark:text-emerald-400 text-emerald-800" />;
            case 'Vehicle': return <Truck size={24} className="dark:text-blue-400 text-blue-800" />;
            case 'Site': return <HardHat size={24} className="dark:text-amber-400 text-amber-800" />;
            default: return <WarehouseIcon size={24} />;
        }
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-24 px-1">
            <header className="flex items-center gap-3">
                <button onClick={() => navigate('/dashboard')} className="p-2 bg-muted rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowRight className="rotate-180" size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-orange-100">
                        Regal-Editor
                    </h1>
                    <p className="text-muted-foreground text-xs">Kategorien verwalten & umbenennen</p>
                </div>
            </header>

            {!selectedWarehouse ? (
                // STEP 1: SELECT WAREHOUSE
                <div className="grid grid-cols-1 gap-4">
                    <h2 className="text-muted-foreground text-sm font-bold uppercase tracking-wider ml-1">Lager wählen</h2>
                    {warehousesLoading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div> :
                        warehouses.map(w => (
                            <GlassCard key={w.id} onClick={() => setSelectedWarehouse(w)} className="cursor-pointer hover:bg-muted transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center border dark:border-white/5 border-border">
                                        {getWarehouseIcon(w.type)}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-foreground group-hover:dark:text-amber-200 text-amber-900 transition-colors">{w.name}</h3>
                                        <p className="text-xs text-muted-foreground">{w.location || 'Kein Standort'}</p>
                                    </div>
                                    <ArrowRight size={18} className="text-muted-foreground group-hover:text-foreground" />
                                </div>
                            </GlassCard>
                        ))}
                </div>
            ) : (
                // STEP 2: EDIT SHELVES
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-muted p-3 rounded-xl border border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center dark:text-amber-400 text-amber-800">
                                {getWarehouseIcon(selectedWarehouse.type)}
                            </div>
                            <div>
                                <div className="font-bold text-foreground">{selectedWarehouse.name}</div>
                                <div className="text-xs text-muted-foreground">{shelves.length} Kategorien gefunden</div>
                            </div>
                        </div>
                        <button onClick={() => { setSelectedWarehouse(null); setShelves([]); }} className="text-xs dark:text-amber-400 text-amber-800 hover:underline">Ändern</button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin dark:text-amber-400 text-amber-800" /></div>
                    ) : shelves.length === 0 ? (
                        <div className="text-center text-muted-foreground py-10">Keine Artikel/Kategorien in diesem Lager.</div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {shelves.map(shelf => (
                                <div key={shelf} className="bg-muted border border-border rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Library size={18} className="text-muted-foreground" />
                                        <span className="font-medium text-foreground">{shelf}</span>
                                    </div>
                                    <button onClick={() => handleOpenEdit(shelf)} className="p-2 bg-muted hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
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
                <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 dark:bg-black/30 bg-muted/70 backdrop-blur-sm animate-in fade-in">
                    <GlassCard className="w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-foreground">Regal umbenennen</h3>
                            <button onClick={() => setEditingShelf(null)}><X className="text-muted-foreground hover:text-foreground" /></button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl text-xs dark:text-blue-200 text-blue-900">
                                Alle Artikel im Lager <b>"{selectedWarehouse?.name}"</b> mit der Kategorie <b>"{editingShelf}"</b> werden verschoben.
                            </div>

                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Neuer Name</label>
                                <GlassInput
                                    value={newShelfName}
                                    onChange={e => setNewShelfName(e.target.value)}
                                    autoFocus={false}
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
