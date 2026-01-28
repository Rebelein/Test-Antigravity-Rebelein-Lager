import React, { useState, useRef, useEffect } from 'react';
import { GlassModal, Button, GlassInput, GlassSelect } from './UIComponents'; // Adjusted imports
import { Key, KeyEvent, UserProfile } from '../types';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner'; // Using sonner as per package.json
import { useAuth } from '../contexts/AuthContext';
// import { useReactToPrint } from 'react-to-print'; // Removed due to build issues
import { KeyProtocol } from './KeyProtocol';
import { Printer, Save, X, Key as KeyIcon, User, MapPin, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

// --- KEY MODAL (Create/Edit) ---

interface KeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    editingKey?: Key | null;
    nextSlotNumber?: number; // Autosuggestion
    categories: any[]; // New prop
}

export const KeyModal: React.FC<KeyModalProps> = ({ isOpen, onClose, onSave, editingKey, nextSlotNumber = 1, categories }) => {
    const { user } = useAuth();
    const [formData, setFormData] = useState<Partial<Key>>({
        slot_number: nextSlotNumber,
        name: '',
        address: '',
        status: 'Available',
        notes: '',
        category_id: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (editingKey) {
            setFormData(editingKey);
        } else {
            // Find next free slot (logic usually on backend, but here simple approximation or just user input)
            setFormData({
                slot_number: nextSlotNumber,
                name: '',
                address: '',
                status: 'Available',
                notes: '',
                category_id: ''
            });
        }
    }, [editingKey, isOpen, nextSlotNumber]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (editingKey) {
                const { error } = await supabase
                    .from('keys')
                    .update({
                        slot_number: formData.slot_number,
                        name: formData.name,
                        address: formData.address,
                        owner: formData.owner, // Update owner
                        notes: formData.notes,
                        category_id: formData.category_id || null
                    })
                    .eq('id', editingKey.id);

                if (error) throw error;

                // Log Update Event
                await supabase.from('key_events').insert({
                    key_id: editingKey.id,
                    user_id: user?.id,
                    action: 'update',
                    details: 'Schlüsseldaten bearbeitet'
                });

                toast.success('Schlüssel aktualisiert');
            } else {
                const { data, error } = await supabase
                    .from('keys')
                    .insert([{
                        ...formData,
                        category_id: formData.category_id || null, // Handle empty string as null
                        status: 'Available' // Always start available, owner is just metadata
                    }])
                    .select()
                    .single();

                if (error) throw error;

                // Log Create Event
                if (data) {
                    await supabase.from('key_events').insert({
                        key_id: data.id,
                        user_id: user?.id,
                        action: 'create',
                        details: 'Schlüssel erstellt'
                    });
                }

                toast.success('Schlüssel erstellt');
            }
            onSave();
            onClose();
        } catch (error: any) {
            toast.error('Fehler beim Speichern: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Print Logic
    const handlePrint = () => {
        const protocolData = {
            type: 'issue',
            keys: [formData],
            partnerName: formData.owner || "_____________ (Kunde)",
            partnerAddress: formData.address,
            date: new Date(),
            notes: "Schlüssel Empfangsbestätigung"
        };
        sessionStorage.setItem('printProtocolData', JSON.stringify(protocolData));
        window.open('#/print-protocol', '_blank', 'width=900,height=1200');
    };

    return (
        <GlassModal isOpen={isOpen} onClose={onClose} title={editingKey ? 'Schlüssel bearbeiten' : 'Neuen Schlüssel anlegen'}>
            {/* Header Action for Print */}
            <div className="absolute top-4 right-16">
                <Button onClick={handlePrint} variant="ghost" className="!p-2">
                    <Printer size={20} className="text-gray-400 hover:text-white" />
                </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-4">
                <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-300 mb-1">Platz-Nr.</label>
                        <input
                            type="number"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            value={formData.slot_number}
                            onChange={(e) => setFormData({ ...formData, slot_number: parseInt(e.target.value) })}
                        />
                    </div>
                    <div className="col-span-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Bezeichnung / Name</label>
                                <div className="relative">
                                    <KeyIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-2 pl-10 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        placeholder="z.B. Heizungsraum"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Kategorie</label>
                                <div className="relative">
                                    <select
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white appearance-none focus:outline-none focus:border-emerald-500"
                                        value={formData.category_id || ''}
                                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                    >
                                        <option value="" className="bg-gray-900">Keine Kategorie</option>
                                        {categories.map((cat: any) => (
                                            <option key={cat.id} value={cat.id} className="bg-gray-900">{cat.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Objektadresse</label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-2 pl-10 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            placeholder="Straße, PLZ, Ort"
                            value={formData.address || ''}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Eigentümer / Kunde (Optional)</label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-2 pl-10 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            placeholder="Wem gehört der Schlüssel?"
                            value={formData.owner || ''}
                            onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Notizen</label>
                    <textarea
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[80px]"
                        value={formData.notes || ''}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                </div>

                <div className="flex justify-end pt-4">
                    <Button type="submit" variant="primary" disabled={loading}>
                        {loading ? 'Speichere...' : 'Speichern'}
                    </Button>
                </div>
            </form>

        </GlassModal>
    );
};

// --- HANDOVER MODAL (Check-in / Check-out) ---

export interface KeyHandoverContentProps {
    onClose: () => void;
    onSave: () => void;
    selectedKeys: Key[];
    type: 'issue' | 'return';
}

export const KeyHandoverContent: React.FC<KeyHandoverContentProps> = ({ onClose, onSave, selectedKeys, type }) => {
    const { user } = useAuth();

    // Form State
    const [partnerName, setPartnerName] = useState('');
    const [holderId, setHolderId] = useState<string | null>(null);
    const [partnerAddress, setPartnerAddress] = useState(''); // Only relevant if external
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    // User Selection State
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Fetch profiles on mount and init defaults
    useEffect(() => {
        const fetchProfiles = async () => {
            const { data } = await supabase.from('profiles').select('*');
            if (data) setProfiles(data);
        };
        fetchProfiles();
    }, []);

    // Init Logic moved from Modal to Content
    // We run this only once on mount of content or when selectedKeys/type changes significantly
    useEffect(() => {
        if (type === 'issue' && user && !partnerName) {
            setPartnerName(user.user_metadata?.full_name || user.email || '');
            setHolderId(user.id);
        } else if (type === 'return' && selectedKeys.length > 0 && !partnerName) {
            // Pre-fill with the holder of the first key (assuming batch return from same person usually)
            const currentHolder = selectedKeys[0].holder_name;
            if (currentHolder) {
                setPartnerName(currentHolder);
                // Try to find ID if exists in profiles (requires profiles to be loaded, might need check)
                // NOTE: Since profiles fetch is async, this might miss on first render if profiles empty. 
                // However, for return logic, we just need the name mostly. ID is cleared on return anyway.
            }
        }
    }, [type, selectedKeys, user]); // Run on mount/change

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

    const handleConfirm = async () => {
        if (!partnerName) {
            toast.error('Bitte Namen angeben');
            return;
        }

        setLoading(true);
        try {
            // 1. Log Events
            const eventUpdates = selectedKeys.map(k => ({
                key_id: k.id,
                user_id: user?.id,
                action: type === 'issue' ? 'checkout' : 'checkin',
                details: `${type === 'issue' ? 'An' : 'Von'}: ${partnerName}${notes ? `, Notiz: ${notes}` : ''}`
            }));

            const { error: eventError } = await supabase.from('key_events').insert(eventUpdates);
            if (eventError) throw eventError;

            // 2. Update Key Status
            const updatePromises = selectedKeys.map(k => {
                return supabase.from('keys').update({
                    status: type === 'issue' ? 'InUse' : 'Available',
                    holder_name: type === 'issue' ? partnerName : null,
                    holder_id: type === 'issue' ? holderId : null // Set ID if internal user
                }).eq('id', k.id);
            });

            const results = await Promise.all(updatePromises);
            const updateError = results.find(r => r.error)?.error;

            if (updateError) throw updateError;

            toast.success(type === 'issue' ? 'Schlüssel ausgegeben' : 'Schlüssel zurückgenommen');
            onSave();
            onClose();

        } catch (error: any) {
            toast.error('Fehler: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Filter suggestions
    const filteredProfiles = profiles.filter(p =>
        ((p.full_name || '').toLowerCase().includes(partnerName.toLowerCase()) ||
            (p.email || '').toLowerCase().includes(partnerName.toLowerCase())) &&
        (p.full_name !== partnerName)
    );

    return (
        <div className="flex flex-col h-full bg-transparent overflow-hidden">
            {/* Header if embedded? Or just Content? The modal wrapper has title. 
                 For split view, we might want a header. Let's add a robust header here, 
                 that fits both modal (if transparent) or panel.
                 Actually, Standard Modal uses title prop. 
                 Let's keep it simple content-focused.
             */}

            <div className={`p-6 w-full mx-auto space-y-6 flex-1 overflow-y-auto ${type === 'issue' ? '' : ''}`}>
                {/* Header for Split View context mostly */}
                <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-white/10 mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {type === 'issue' ? 'Schlüssel ausgeben' : 'Schlüssel zurücknehmen'}
                    </h2>
                    {/* Close button handled by parent usually, but good to have if needed inside */}
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-500 dark:text-white/60"><X size={20} /></button>
                </div>


                {/* Selected Keys List */}
                <div className="bg-white dark:bg-white/5 rounded-lg p-4 border border-gray-200 dark:border-white/10 shadow-sm">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Gewählte Schlüssel</h3>
                    <ul className="space-y-3">
                        {selectedKeys.map(k => (
                            <li key={k.id} className="text-sm bg-gray-50 dark:bg-white/5 p-3 rounded-md border border-gray-200 dark:border-white/5">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-gray-900 dark:text-white">{k.name}</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">#{k.slot_number}</span>
                                </div>
                                <div className="space-y-1 text-gray-500 dark:text-gray-400 text-xs">
                                    {k.address && (
                                        <div className="flex items-center gap-2">
                                            <MapPin size={12} />
                                            <span>{k.address}</span>
                                        </div>
                                    )}
                                    {k.owner && (
                                        <div className="flex items-center gap-2">
                                            <User size={12} />
                                            <span>Eigentümer: <span className="text-gray-700 dark:text-gray-300">{k.owner}</span></span>
                                        </div>
                                    )}
                                    {k.notes && (
                                        <div className="mt-1 pt-1 border-t border-gray-200 dark:border-white/10 italic text-gray-400 dark:text-gray-500">
                                            "{k.notes}"
                                        </div>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                    <div className="relative">
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                            {type === 'issue' ? 'Ausgegeben an' : 'Abgegeben von (Name)'}
                        </label>
                        <div className="relative group">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />

                            <input
                                type="text"
                                required
                                className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-2 pl-10 pr-10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                value={partnerName}
                                onChange={(e) => handleNameChange(e.target.value)}
                                onFocus={() => setShowSuggestions(true)}
                                // Slightly longer delay to allow clear button click
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
                                placeholder="Benutzer wählen oder Namen eingeben"
                            />

                            {/* Chevron or Clear Button */}
                            {partnerName ? (
                                <button
                                    onClick={() => { setPartnerName(''); setHolderId(null); }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 dark:hover:text-white z-20 bg-transparent"
                                >
                                    <X size={16} />
                                </button>
                            ) : (
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                            )}

                            {/* Suggestions Dropdown */}
                            {showSuggestions && (
                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                    {filteredProfiles.length > 0 ? (
                                        filteredProfiles.map(p => (
                                            <div
                                                key={p.id}
                                                className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer text-sm text-gray-900 dark:text-gray-200 flex items-center justify-between"
                                                onClick={() => selectUser(p)}
                                            >
                                                <span>{p.full_name || p.email}</span>
                                                <span className="text-xs text-gray-500">Intern</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="px-4 py-2 text-sm text-gray-500 italic">
                                            Kein interner Nutzer gefunden. <br />
                                            <span className="text-emerald-500 dark:text-emerald-400">"{partnerName}"</span> als externen Namen verwenden.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Notiz</label>
                        <textarea
                            className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 h-20"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Zweck, Besonderheiten..."
                        />
                    </div>
                </div>

                {/* Footer Logic for Modal vs Panel */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-white/10 mt-auto">
                    {/* We can hide Cancel button in split view if we want, or keep it as "Close" */}
                    <Button onClick={onClose} variant="secondary">Abbrechen</Button>
                    <Button onClick={handleConfirm} variant="primary" disabled={loading}>
                        <Save size={18} className="mr-2" />
                        {loading ? 'Buche...' : 'Buchen & Fertig'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

interface KeyHandoverModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    selectedKeys: Key[]; // Can be multiple for mass handover? Typically one or few.
    type: 'issue' | 'return';
}

export const KeyHandoverModal: React.FC<KeyHandoverModalProps> = ({ isOpen, onClose, onSave, selectedKeys, type }) => {
    if (!isOpen) return null;

    return (
        <GlassModal isOpen={isOpen} onClose={onClose} title="">
            {/* We rely on Content's header now or obscure modal title */}
            <KeyHandoverContent onClose={onClose} onSave={onSave} selectedKeys={selectedKeys} type={type} />
        </GlassModal>
    );
};

// --- DETAILS & HISTORY MODAL ---

interface KeyDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    keyData: Key | null;
}

export const KeyDetailsModal: React.FC<KeyDetailsModalProps> = ({ isOpen, onClose, keyData }) => {
    const [history, setHistory] = useState<KeyEvent[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && keyData) {
            fetchHistory();
        }
    }, [isOpen, keyData]);

    const fetchHistory = async () => {
        if (!keyData) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('key_events')
            .select(`
                *,
                profiles:user_id (full_name, email)
            `)
            .eq('key_id', keyData.id)
            .order('created_at', { ascending: false });

        if (data) {
            // @ts-ignore
            setHistory(data);
        }
        setLoading(false);
    };

    if (!isOpen || !keyData) return null;

    return (
        <GlassModal isOpen={isOpen} onClose={onClose} title="Schlüssel-Details">
            <div className="p-6 max-w-2xl w-full mx-auto">
                {/* Header Info */}
                <div className="flex justify-between items-start mb-6 bg-white/5 p-4 rounded-xl border border-white/10">
                    <div>
                        <div className="text-emerald-400 font-mono text-sm mb-1">Platz #{keyData.slot_number}</div>
                        <h2 className="text-2xl font-bold text-white mb-2">{keyData.name}</h2>
                        <div className="flex flex-col gap-1 text-sm text-gray-400">
                            {keyData.address && <div className="flex items-center gap-2"><MapPin size={14} /> {keyData.address}</div>}
                            {keyData.owner && <div className="flex items-center gap-2"><User size={14} /> Eigentümer: {keyData.owner}</div>}
                        </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-bold border ${keyData.status === 'InUse'
                        ? 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
                        }`}>
                        {keyData.status === 'InUse' ? 'Ausgegeben' : 'Verfügbar'}
                    </div>
                </div>

                {/* History Timeline */}
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                    <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                    Verlauf
                </h3>

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Lade Verlauf...</div>
                    ) : history.length > 0 ? (
                        history.map((event) => (
                            <div key={event.id} className="relative pl-6 pb-4 border-l border-white/10 last:pb-0">
                                <div className={`absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full ${event.action === 'checkout' ? 'bg-amber-500' :
                                    event.action === 'checkin' ? 'bg-emerald-500' :
                                        event.action === 'create' ? 'bg-blue-500' : 'bg-gray-500'
                                    }`}></div>

                                <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-xs font-bold uppercase tracking-wider ${event.action === 'checkout' ? 'text-amber-400' :
                                            event.action === 'checkin' ? 'text-emerald-400' :
                                                event.action === 'create' ? 'text-blue-400' : 'text-gray-400'
                                            }`}>
                                            {event.action === 'checkout' && 'Ausgabe'}
                                            {event.action === 'checkin' && 'Rücknahme'}
                                            {event.action === 'create' && 'Erstellt'}
                                            {event.action === 'update' && 'Bearbeitet'}
                                        </span>
                                        <span className="text-xs text-gray-500 font-mono">
                                            {format(new Date(event.created_at), 'dd.MM.yyyy HH:mm')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-300 mb-1">{event.details}</p>
                                    <div className="text-xs text-gray-600 flex items-center gap-1">
                                        <User size={10} />
                                        {/* @ts-ignore */}
                                        {event.profiles?.full_name || event.profiles?.email || 'System'}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-gray-500 bg-white/5 rounded-xl border border-white/5 border-dashed">
                            Keine Einträge vorhanden
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end">
                    <Button onClick={onClose} variant="secondary">Schließen</Button>
                </div>
            </div>
        </GlassModal>
    );
};
