import React, { useState, useEffect } from 'react';
import { GlassModal, Button, GlassInput } from '../../../components/UIComponents';
import { supabase } from '../../../../supabaseClient';
import { Trash2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface Category {
    id: string;
    name: string;
    color: string;
}

interface CategoryManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void; // Trigger refresh in parent
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({ isOpen, onClose, onUpdate }) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryColor, setNewCategoryColor] = useState('#10b981'); // Default Emerald
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) fetchCategories();
    }, [isOpen]);

    const fetchCategories = async () => {
        const { data } = await supabase.from('key_categories').select('*').order('name');
        if (data) setCategories(data);
    };

    const handleCreate = async () => {
        if (!newCategoryName.trim()) return;
        setLoading(true);
        try {
            const { error } = await supabase.from('key_categories').insert({
                name: newCategoryName,
                color: newCategoryColor
            });
            if (error) throw error;
            fetchCategories();
            setNewCategoryName('');
            onUpdate(); // Refresh keys page categories
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Kategorie löschen? Zugeordnete Schlüssel verlieren diese Kategorie.')) return;
        try {
            const { error } = await supabase.from('key_categories').delete().eq('id', id);
            if (error) throw error;
            fetchCategories();
            onUpdate();
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    // Predefined colors for easier selection
    const colors = [
        '#ef4444', // Red
        '#f97316', // Orange
        '#f59e0b', // Amber
        '#10b981', // Emerald
        '#06b6d4', // Cyan
        '#3b82f6', // Blue
        '#6366f1', // Indigo
        '#8b5cf6', // Violet
        '#d946ef', // Fuchsia
        '#ec4899', // Pink
    ];

    return (
        <GlassModal isOpen={isOpen} onClose={onClose} title="Schlüssel-Kategorien verwalten">
            <div className="p-6 space-y-6">

                {/* Create New */}
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Neue Kategorie</h3>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <GlassInput
                                placeholder="Name (z.B. Heizung, Verwaltung)"
                                value={newCategoryName}
                                onChange={e => setNewCategoryName(e.target.value)}
                            />
                        </div>
                        <input
                            type="color"
                            value={newCategoryColor}
                            onChange={e => setNewCategoryColor(e.target.value)}
                            className="h-10 w-10 rounded cursor-pointer bg-transparent border-none"
                        />
                    </div>

                    {/* Color Presets */}
                    <div className="flex gap-2 flex-wrap">
                        {colors.map(c => (
                            <button
                                key={c}
                                onClick={() => setNewCategoryColor(c)}
                                className={`w-6 h-6 rounded-full border-2 transition-all ${newCategoryColor === c ? 'border-white scale-125' : 'border-transparent hover:scale-110'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>

                    <Button onClick={handleCreate} disabled={loading || !newCategoryName} className="w-full bg-emerald-600 hover:bg-emerald-500">
                        <Plus size={16} className="mr-2" /> Erstellen
                    </Button>
                </div>

                {/* List */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-2">Vorhandene Kategorien</h3>
                    {categories.length === 0 && <p className="text-center text-gray-500 py-4">Keine Kategorien vorhanden.</p>}
                    {categories.map(cat => (
                        <div key={cat.id} className="flex justify-between items-center p-3 bg-black/20 rounded-lg border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }}></div>
                                <span className="font-bold text-white">{cat.name}</span>
                            </div>
                            <button onClick={() => handleDelete(cat.id)} className="text-white/30 hover:text-red-400 p-2">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end pt-4">
                    <Button onClick={onClose} variant="secondary">Schließen</Button>
                </div>
            </div>
        </GlassModal>
    );
};
