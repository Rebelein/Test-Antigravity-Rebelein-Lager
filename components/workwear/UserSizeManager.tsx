import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { GlassCard, Button, GlassInput } from '../UIComponents';
import { Ruler, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';

const CATEGORIES = ['T-Shirt', 'Pullover', 'Jacke', 'Hose', 'Schuhe', 'Handschuhe', 'Helm'];

export const UserSizeManager = () => {
    const { user } = useAuth();
    const [sizes, setSizes] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user) fetchSizes();
    }, [user]);

    const fetchSizes = async () => {
        try {
            const { data, error } = await supabase
                .from('user_sizes')
                .select('category, size_value')
                .eq('user_id', user?.id);

            if (error) throw error;

            const sizeMap: Record<string, string> = {};
            data?.forEach(item => {
                sizeMap[item.category] = item.size_value;
            });
            setSizes(sizeMap);
        } catch (error) {
            console.error("Error fetching sizes:", error);
            toast.error("Fehler beim Laden der Größen");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const updates = Object.entries(sizes).map(([category, value]) => ({
                user_id: user.id,
                category,
                size_value: value
            }));

            const { error } = await supabase
                .from('user_sizes')
                .upsert(updates, { onConflict: 'user_id, category' });

            if (error) throw error;
            toast.success("Größen gespeichert");
        } catch (error) {
            console.error(error);
            toast.error("Fehler beim Speichern");
        } finally {
            setSaving(false);
        }
    };

    const getSizeOptions = (category: string) => {
        const cat = category.toLowerCase();
        if (cat.includes('handschuh')) return ['7', '8', '9', '10', '11'];
        if (cat.includes('schuh')) return ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'];
        if (cat.includes('hose')) return ['42', '44', '46', '48', '50', '52', '54', '56', '58', '60', '62', '90', '94', '98', '102', '106'];
        if (cat.includes('helm')) return ['Universal', 'S (52-54)', 'M (55-58)', 'L (59-61)'];
        return ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-emerald-500" /></div>;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-400">
                    <Ruler size={32} />
                </div>
                <h2 className="text-2xl font-bold text-white">Meine Größen</h2>
                <p className="text-white/50">Hinterlege hier deine Konfektionsgrößen, damit sie bei Bestellungen automatisch vorgeschlagen werden.</p>
            </div>

            <GlassCard className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {CATEGORIES.map(cat => (
                    <div key={cat} className="space-y-2">
                        <label className="text-sm font-medium text-white/70 block ml-1">{cat}</label>
                        <select
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50 appearance-none transition-colors hover:bg-white/10"
                            value={sizes[cat] || ''}
                            onChange={(e) => setSizes(prev => ({ ...prev, [cat]: e.target.value }))}
                        >
                            <option value="" disabled className="bg-zinc-900 text-white/50">Bitte wählen...</option>
                            {getSizeOptions(cat).map(opt => (
                                <option key={opt} value={opt} className="bg-zinc-900">{opt}</option>
                            ))}
                        </select>
                    </div>
                ))}
            </GlassCard>

            <div className="flex justify-end">
                <Button onClick={handleSave} isLoading={saving} className="w-full md:w-auto">
                    <Save size={18} /> Speichern
                </Button>
            </div>
        </div>
    );
};
