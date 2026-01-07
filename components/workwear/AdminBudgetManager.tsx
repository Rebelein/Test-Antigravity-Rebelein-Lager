import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { GlassCard, Button } from '../UIComponents';
import { ArrowLeft, Save, Search, UserCircle } from 'lucide-react';
import { UserProfile, WorkwearRole } from '../../types';
import { toast } from 'sonner';

interface AdminBudgetManagerProps {
    onBack: () => void;
}

interface UserWithBudget extends UserProfile {
    budget_id?: string;
    budget_limit: number;
    budget_year: number;
}

export const AdminBudgetManager: React.FC<AdminBudgetManagerProps> = ({ onBack }) => {
    const [users, setUsers] = useState<UserWithBudget[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [settingsId, setSettingsId] = useState<string | null>(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const currentYear = new Date().getFullYear();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Users
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .order('full_name');

            if (profileError) throw profileError;

            // 2. Fetch Budgets for current year
            const { data: budgets, error: budgetError } = await supabase
                .from('workwear_budgets')
                .select('*')
                .eq('year', currentYear);

            if (budgetError) throw budgetError;

            // 3. Fetch Settings
            const { data: settings } = await supabase
                .from('workwear_settings')
                .select('*')
                .single();

            if (settings) {
                setLogoUrl(settings.logo_url);
                setSettingsId(settings.id);
            }

            // 4. Merge
            const merged = profiles.map((p: any) => {
                const b = budgets?.find((b: any) => b.user_id === p.id);
                return {
                    ...p,
                    budget_id: b?.id,
                    budget_limit: b?.budget_limit || 0,
                    budget_year: currentYear
                };
            });

            setUsers(merged);

        } catch (error) {
            console.error(error);
            // Don't show error if settings just don't exist yet (first run)
        } finally {
            setLoading(false);
        }
    };

    const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploadingLogo(true);
            const file = event.target.files?.[0];
            if (!file) return;

            const fileExt = file.name.split('.').pop();
            const fileName = `logo_${Math.random()}.${fileExt}`;
            const filePath = `settings/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('workwear')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('workwear').getPublicUrl(filePath);
            const newLogoUrl = data.publicUrl;

            // Save to DB
            const payload = { logo_url: newLogoUrl };
            if (settingsId) {
                await supabase.from('workwear_settings').update(payload).eq('id', settingsId);
            } else {
                const { data: newSetting } = await supabase.from('workwear_settings').insert([payload]).select().single();
                if (newSetting) setSettingsId(newSetting.id);
            }

            setLogoUrl(newLogoUrl);
            toast.success("Firmenlogo aktualisiert");

        } catch (error) {
            console.error(error);
            toast.error("Fehler beim Logo-Upload");
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: WorkwearRole) => {
        // Optimistic update
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, workwear_role: newRole } : u));

        const { error } = await supabase.from('profiles').update({ workwear_role: newRole }).eq('id', userId);
        if (error) {
            toast.error("Fehler beim Speichern der Rolle");
            fetchData(); // Revert
        } else {
            toast.success("Rolle aktualisiert");
        }
    };

    const handleBudgetChange = (userId: string, amount: number) => {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, budget_limit: amount } : u));
    };

    const saveBudget = async (user: UserWithBudget) => {
        try {
            // Check if budget entry exists logic is handled by upsert on UNIQUE(user_id, year)
            const { error } = await supabase.from('workwear_budgets').upsert({
                user_id: user.id,
                year: currentYear,
                budget_limit: user.budget_limit
            }, { onConflict: 'user_id, year' });

            if (error) throw error;
            toast.success(`Budget für ${user.full_name} gespeichert`);
        } catch (e) {
            console.error(e);
            toast.error("Fehler beim Speichern des Budgets");
        }
    };

    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button onClick={onBack} variant="ghost" className="rounded-full w-10 h-10 p-0 flex items-center justify-center">
                    <ArrowLeft size={20} />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold text-white">Einstellungen & Budget</h2>
                    <p className="text-white/50">Verwaltung für Jahr {currentYear}</p>
                </div>
            </div>

            {/* Global Settings Card */}
            <GlassCard className="p-6 flex flex-col md:flex-row items-center gap-6">
                <div className="w-20 h-20 bg-white/5 rounded-xl flex items-center justify-center overflow-hidden border border-white/10 shrink-0">
                    {logoUrl ? <img src={logoUrl} className="w-full h-full object-contain p-2" /> : <div className="text-xs text-white/30 text-center">Kein Logo</div>}
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h3 className="text-lg font-bold text-white">Firmenlogo</h3>
                    <p className="text-white/50 text-sm mb-4">Dieses Logo wird für Artikel verwendet, bei denen "Mit Firmenlogo" aktiviert ist.</p>
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg cursor-pointer transition-colors text-sm font-medium border border-emerald-500/20">
                        {uploadingLogo ? 'Lade hoch...' : 'Logo hochladen / ändern'}
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                    </label>
                </div>
            </GlassCard>

            <div className="flex items-center gap-2 mt-8 mb-4">
                <UserCircle className="text-emerald-400" size={20} />
                <h3 className="text-lg font-bold text-white">Mitarbeiter Übersicht ({users.length})</h3>
            </div>

            <GlassCard className="p-4 flex gap-2">
                <Search className="text-white/40" />
                <input
                    type="text"
                    placeholder="Benutzer suchen..."
                    className="bg-transparent outline-none text-white w-full"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </GlassCard>

            <div className="grid gap-4">
                {filteredUsers.map(user => (
                    <GlassCard key={user.id} className="p-4 flex flex-col md:flex-row items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/50 shrink-0">
                            {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full rounded-full" /> : <UserCircle />}
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <div className="font-bold text-white">{user.full_name || 'Unbekannt'}</div>
                            <div className="text-xs text-white/50">{user.email}</div>
                        </div>

                        {/* Role Selector */}
                        <div className="w-full md:w-40">
                            <label className="text-[10px] uppercase text-white/30 font-bold ml-1">Rolle</label>
                            <select
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
                                value={user.workwear_role || 'monteur'}
                                onChange={(e) => handleRoleChange(user.id, e.target.value as WorkwearRole)}
                            >
                                <option className="bg-zinc-900" value="monteur">Monteur</option>
                                <option className="bg-zinc-900" value="besteller">Besteller</option>
                                <option className="bg-zinc-900" value="chef">Chef</option>
                            </select>
                        </div>

                        {/* Budget Input */}
                        <div className="w-full md:w-40 flex items-end gap-2">
                            <div className="flex-1">
                                <label className="text-[10px] uppercase text-white/30 font-bold ml-1">Budget {currentYear} (€)</label>
                                <input
                                    type="number"
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
                                    value={user.budget_limit}
                                    onChange={(e) => handleBudgetChange(user.id, parseFloat(e.target.value))}
                                />
                            </div>
                            <Button onClick={() => saveBudget(user)} variant="ghost" className="h-[38px] w-[38px] p-0 flex items-center justify-center bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
                                <Save size={18} />
                            </Button>
                        </div>
                    </GlassCard>
                ))}
            </div>
        </div>
    );
};
