import React, { useState, useEffect } from 'react';
import { Key, KeyEvent, UserProfile } from '../../types';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Button, GlassCard, GlassInput, GlassSelect } from '../UIComponents';
import { Loader2, User, MapPin, History, ArrowLeft, CheckCircle2, AlertTriangle, Key as KeyIcon, ChevronDown, X, Save } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface KeyDetailContentProps {
    keyData: Key;
    onClose: () => void;
    onUpdate: () => void;
}

type Mode = 'overview' | 'issue' | 'return' | 'history';

export const KeyDetailContent: React.FC<KeyDetailContentProps> = ({ keyData, onClose, onUpdate }) => {
    const { user } = useAuth();
    const [mode, setMode] = useState<Mode>('overview');
    const [history, setHistory] = useState<KeyEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [profiles, setProfiles] = useState<UserProfile[]>([]);

    // Handover State
    const [partnerName, setPartnerName] = useState('');
    const [holderId, setHolderId] = useState<string | null>(null);
    const [notes, setNotes] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        setMode('overview'); // Reset on key change
        fetchHistory();
        fetchProfiles();
    }, [keyData.id]);

    const fetchHistory = async () => {
        const { data } = await supabase
            .from('key_events')
            .select('*, profiles:user_id(full_name, email)')
            .eq('key_id', keyData.id)
            .order('created_at', { ascending: false });
        if (data) setHistory((data as any) || []);
    };

    const fetchProfiles = async () => {
        const { data } = await supabase.from('profiles').select('*');
        if (data) setProfiles(data);
    };

    // --- HANDLERS ---

    const handleNameChange = (val: string) => {
        setPartnerName(val);
        setShowSuggestions(true);
        const match = profiles.find(p => (p.full_name || '').toLowerCase() === val.toLowerCase());
        setHolderId(match ? match.id : null);
    };

    const selectUser = (profile: UserProfile) => {
        setPartnerName(profile.full_name || profile.email);
        setHolderId(profile.id);
        setShowSuggestions(false);
    };

    const executeHandover = async (type: 'issue' | 'return') => {
        if (type === 'issue' && !partnerName) return toast.error("Bitte Namen angeben");
        setLoading(true);
        try {
            await supabase.from('key_events').insert({
                key_id: keyData.id,
                user_id: user?.id,
                action: type === 'issue' ? 'checkout' : 'checkin',
                details: `${type === 'issue' ? 'An' : 'Von'}: ${partnerName}${notes ? `, Notiz: ${notes}` : ''}`
            });

            await supabase.from('keys').update({
                status: type === 'issue' ? 'InUse' : 'Available',
                holder_name: type === 'issue' ? partnerName : null,
                holder_id: type === 'issue' ? holderId : null
            }).eq('id', keyData.id);

            toast.success(type === 'issue' ? 'Schlüssel ausgegeben' : 'Schlüssel zurückgenommen');
            onUpdate();
            setMode('overview');
            // Reset form
            setPartnerName('');
            setHolderId(null);
            setNotes('');
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    };

    const prepareHandover = (type: 'issue' | 'return') => {
        if (type === 'issue') {
            setPartnerName('');
            setHolderId(null);
            if (user) {
                // Suggest current user? Maybe not for keys, usually issued TO someone else.
                // But let's leave empty to force selection.
            }
        } else {
            // Return: Pre-fill current holder
            setPartnerName(keyData.holder_name || '');
            if (keyData.holder_name) {
                const match = profiles.find(p => (p.full_name || '').toLowerCase() === (keyData.holder_name || '').toLowerCase());
                if (match) setHolderId(match.id);
            }
        }
        setMode(type);
    };

    // --- RENDER ---

    return (
        <div className="flex flex-col h-full bg-[#1a1d24] text-white">
            {/* HEADER */}
            <div className="p-6 border-b border-white/5 bg-gradient-to-br from-white/5 to-transparent">
                <div className="flex justify-between items-start mb-2">
                    <div className="text-emerald-400 font-mono text-sm">Platz #{keyData.slot_number}</div>
                    <div className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${keyData.status === 'InUse' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {keyData.status === 'InUse' ? 'Ausgegeben' : 'Verfügbar'}
                    </div>
                </div>
                <h2 className="text-2xl font-bold mb-4">{keyData.name}</h2>
                <div className="space-y-1 text-sm text-white/50">
                    {keyData.address && <div className="flex items-center gap-2"><MapPin size={14} /> {keyData.address}</div>}
                    {keyData.owner && <div className="flex items-center gap-2"><User size={14} /> Eigentümer: {keyData.owner}</div>}
                </div>
            </div>

            {/* TAB BAR */}
            {mode === 'overview' ? (
                <div className="p-4 border-b border-white/5 flex gap-2">
                    {keyData.status === 'Available' ? (
                        <Button onClick={() => prepareHandover('issue')} className="flex-1 bg-emerald-600 hover:bg-emerald-500">Ausgeben</Button>
                    ) : (
                        <Button onClick={() => prepareHandover('return')} className="flex-1" variant="secondary">Rücknahme</Button>
                    )}
                    <Button onClick={() => setMode('history')} variant="ghost" icon={<History size={18} />}>Verlauf</Button>
                </div>
            ) : (
                <div className="p-4 border-b border-white/5 flex items-center gap-2">
                    <button onClick={() => setMode('overview')} className="p-2 hover:bg-white/10 rounded-full"><ArrowLeft size={20} /></button>
                    <h3 className="font-bold">
                        {mode === 'issue' ? 'Schlüssel ausgeben' : mode === 'return' ? 'Schlüssel zurücknehmen' : 'Verlauf'}
                    </h3>
                </div>
            )}

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

                {/* OVERVIEW */}
                {mode === 'overview' && (
                    <div className="space-y-4">
                        {keyData.status === 'InUse' && (
                            <GlassCard className="bg-amber-500/10 border-amber-500/20">
                                <h3 className="text-sm font-bold text-amber-200 mb-2 flex items-center gap-2"><User size={16} /> Aktuell bei</h3>
                                <div className="text-xl font-bold text-white">{keyData.holder_name || 'Unbekannt'}</div>
                            </GlassCard>
                        )}
                        {keyData.notes && (
                            <div className="bg-white/5 p-4 rounded-xl border border-white/5 italic text-white/70">
                                "{keyData.notes}"
                            </div>
                        )}

                        <div className="mt-4">
                            <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Letzte Aktivitäten</h4>
                            <div className="space-y-3">
                                {history.slice(0, 3).map(log => (
                                    <div key={log.id} className="text-sm border-l-2 border-white/10 pl-3 py-1">
                                        <div className="font-bold text-white/80">{log.action === 'checkout' ? 'Ausgabe' : log.action === 'checkin' ? 'Rücknahme' : log.action}</div>
                                        <div className="text-xs text-white/40">{format(new Date(log.created_at), 'dd.MM.yyyy HH:mm')} • {log.profiles?.full_name || 'System'}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* HANDOVER (Issue/Return) */}
                {(mode === 'issue' || mode === 'return') && (
                    <div className="space-y-4 animate-in slide-in-from-right-4">
                        <div className="relative">
                            <label className="text-xs text-white/50 block mb-1">
                                {mode === 'issue' ? 'Ausgegeben an' : 'Zurückgegeben von'}
                            </label>
                            <User className="absolute left-3 top-8 text-white/30" size={16} />
                            <input
                                className="w-full bg-black/30 border border-white/10 rounded-lg py-2 pl-10 pr-10 text-white focus:border-emerald-500 outline-none"
                                value={partnerName}
                                onChange={e => handleNameChange(e.target.value)}
                                onFocus={() => setShowSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                placeholder="Name..."
                            />
                            {partnerName && <button onClick={() => setPartnerName('')} className="absolute right-3 top-8 text-white/30 hover:text-white"><X size={16} /></button>}

                            {showSuggestions && (
                                <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                    {profiles.filter(p => (p.full_name || '').toLowerCase().includes(partnerName.toLowerCase())).map(p => (
                                        <div key={p.id} onClick={() => selectUser(p)} className="px-4 py-2 hover:bg-white/10 cursor-pointer text-white text-sm">
                                            {p.full_name} <span className="text-white/30 text-xs ml-2">Intern</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs text-white/50 block mb-1">Notiz</label>
                            <textarea
                                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-emerald-500 outline-none h-24"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Optional..."
                            />
                        </div>

                        <Button onClick={() => executeHandover(mode)} disabled={loading} className={`w-full h-12 ${mode === 'issue' ? 'bg-emerald-600' : 'bg-white/10'}`}>
                            {loading ? <Loader2 className="animate-spin" /> : (mode === 'issue' ? 'Bestätigen & Ausgeben' : 'Rücknahme Bestätigen')}
                        </Button>
                    </div>
                )}

                {/* HISTORY */}
                {mode === 'history' && (
                    <div className="space-y-4 animate-in slide-in-from-right-4">
                        {history.map((event) => (
                            <div key={event.id} className="relative pl-6 pb-4 border-l border-white/10 last:pb-0">
                                <div className={`absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full ${event.action === 'checkout' ? 'bg-amber-500' :
                                        event.action === 'checkin' ? 'bg-emerald-500' :
                                            event.action === 'create' ? 'bg-blue-500' : 'bg-gray-500'
                                    }`}></div>

                                <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-xs font-bold uppercase tracking-wider ${event.action === 'checkout' ? 'text-amber-400' :
                                                event.action === 'checkin' ? 'text-emerald-400' : 'text-white/50'
                                            }`}>
                                            {event.action}
                                        </span>
                                        <span className="text-xs text-gray-500 font-mono">
                                            {format(new Date(event.created_at), 'dd.MM.yyyy HH:mm')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-300 mb-1">{event.details}</p>
                                    <div className="text-xs text-gray-600 flex items-center gap-1">
                                        <User size={10} />
                                        {/* @ts-ignore */}
                                        {event.profiles?.full_name || 'System'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
};
