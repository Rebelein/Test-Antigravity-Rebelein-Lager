import React, { useState, useEffect } from 'react';
import { Machine, MachineStatus, UserProfile, MachineReservation, MachineEvent } from '../../types';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Button, GlassCard, GlassInput, GlassSelect } from '../UIComponents';
import { Loader2, AlertTriangle, CheckCircle2, History, Calendar, Wrench, User, Lock, Drill, ArrowLeft, ArrowRight, Save, Trash2, X, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface MachineDetailContentProps {
    machine: Machine;
    users: UserProfile[];
    onClose: () => void;
    onUpdate: () => void;
}

type DetailViewMode = 'overview' | 'borrow' | 'return' | 'reservations' | 'history' | 'edit';

export const MachineDetailContent: React.FC<MachineDetailContentProps> = ({ machine, users, onClose, onUpdate }) => {
    const { user } = useAuth();
    const [mode, setMode] = useState<DetailViewMode>('overview');
    const [loading, setLoading] = useState(false);
    const [reservations, setReservations] = useState<MachineReservation[]>([]);
    const [historyLogs, setHistoryLogs] = useState<MachineEvent[]>([]);

    // Borrow State
    const [borrowTargetUser, setBorrowTargetUser] = useState<string>('');
    const [borrowExternalName, setBorrowExternalName] = useState<string>('');
    const [isExternalBorrow, setIsExternalBorrow] = useState(false);
    const [conflictWarning, setConflictWarning] = useState<string | null>(null);

    // Return State
    const [returnCondition, setReturnCondition] = useState<'OK' | 'Defect'>('OK');
    const [defectNote, setDefectNote] = useState('');

    // Reservation State
    const [resStartDate, setResStartDate] = useState('');
    const [resEndDate, setResEndDate] = useState('');
    const [resNote, setResNote] = useState('');

    useEffect(() => {
        setMode('overview');
        fetchReservations(); // Load reservations initially for overview/badges
    }, [machine.id]);

    const fetchReservations = async () => {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
            .from('machine_reservations')
            .select('*, profiles(full_name)')
            .eq('machine_id', machine.id)
            .gte('end_date', today)
            .order('start_date');

        if (data) setReservations(data as any[]);
    };

    const fetchHistory = async () => {
        const { data } = await supabase
            .from('machine_events')
            .select('*, profiles(full_name)')
            .eq('machine_id', machine.id)
            .order('created_at', { ascending: false });
        if (data) setHistoryLogs(data as any[]);
    };

    // --- ACTIONS ---

    const executeBorrow = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const isTransfer = machine.status === MachineStatus.RENTED;
            const actionType = isTransfer ? 'transfer' : 'rented';

            const updates: any = {
                status: MachineStatus.RENTED,
                assigned_to: isExternalBorrow ? null : (borrowTargetUser || null),
                external_borrower: isExternalBorrow ? borrowExternalName : null
            };

            await supabase.from('machines').update(updates).eq('id', machine.id);

            const borrowerName = isExternalBorrow ? borrowExternalName : users.find(u => u.id === borrowTargetUser)?.full_name;
            const details = isTransfer
                ? `Übergabe von ${machine.profiles?.full_name || machine.externalBorrower || 'Unbekannt'} an ${borrowerName}`
                : `Ausgeliehen an ${borrowerName}`;

            await supabase.from('machine_events').insert({
                machine_id: machine.id,
                user_id: user.id,
                action: actionType,
                details: details
            });

            toast.success("Maschine ausgeliehen");
            onUpdate();
            setMode('overview');
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    };

    const executeReturn = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const isDefect = returnCondition === 'Defect';

            await supabase.from('machines').update({
                status: isDefect ? MachineStatus.REPAIR : MachineStatus.AVAILABLE,
                assigned_to: null,
                external_borrower: null,
                notes: isDefect ? defectNote : null
            }).eq('id', machine.id);

            await supabase.from('machine_events').insert({
                machine_id: machine.id,
                user_id: user.id,
                action: isDefect ? 'defect' : 'returned',
                details: isDefect ? `Rückgabe mit Defekt: ${defectNote}` : 'Rückgabe OK'
            });

            toast.success("Rückgabe verbucht");
            onUpdate();
            setMode('overview');
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    };

    const executeRepairFinish = async () => {
        if (!window.confirm("Reparatur abgeschlossen?")) return;
        setLoading(true);
        try {
            await supabase.from('machines').update({ status: MachineStatus.AVAILABLE, notes: null }).eq('id', machine.id);
            if (user) {
                await supabase.from('machine_events').insert({
                    machine_id: machine.id,
                    user_id: user.id,
                    action: 'repaired',
                    details: 'Reparatur abgeschlossen'
                });
            }
            toast.success("Maschine wieder verfügbar");
            onUpdate();
            setMode('overview');
        } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
    };

    const executeReservation = async () => {
        if (!user || !resStartDate || !resEndDate) return;

        // Overlap Check locally
        const overlap = reservations.find(r => (resStartDate <= r.end_date && resEndDate >= r.start_date));
        if (overlap) {
            toast.error(`Konflikt! Bereits reserviert von ${overlap.start_date} bis ${overlap.end_date}`);
            return;
        }

        setLoading(true);
        try {
            await supabase.from('machine_reservations').insert({
                machine_id: machine.id,
                user_id: user.id,
                start_date: resStartDate,
                end_date: resEndDate,
                note: resNote
            });

            await supabase.from('machine_events').insert({
                machine_id: machine.id,
                user_id: user.id,
                action: 'reserved',
                details: `Reserviert vom ${resStartDate} bis ${resEndDate}`
            });

            fetchReservations();
            setResStartDate('');
            setResEndDate('');
            setResNote('');
            toast.success("Reservierung erstellt");
        } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
    };

    const deleteReservation = async (id: string) => {
        if (!confirm("Reservierung löschen?")) return;
        await supabase.from('machine_reservations').delete().eq('id', id);
        fetchReservations();
    };

    const checkReservationConflict = () => {
        const today = new Date().toISOString().split('T')[0];
        const conflict = reservations.find(r => r.start_date <= today && r.end_date >= today && r.user_id !== borrowTargetUser);
        if (conflict) setConflictWarning(`ACHTUNG: Reserviert für ${conflict.profiles?.full_name}!`);
        else setConflictWarning(null);
    };

    useEffect(() => {
        if (mode === 'borrow') checkReservationConflict();
    }, [borrowTargetUser, reservations, mode]);

    useEffect(() => {
        if (mode === 'history') fetchHistory();
    }, [mode]);

    // Used for default assignment
    useEffect(() => {
        if (mode === 'borrow' && user) setBorrowTargetUser(user.id);
    }, [mode, user]);


    // --- RENDER CONTENT ---

    return (
        <div className="flex flex-col h-full bg-transparent text-slate-100">
            {/* HEADER */}
            <div className="relative h-48 w-full bg-black/50 shrink-0">
                <img src={machine.image || `https://picsum.photos/seed/${machine.id}/800/400`} className="w-full h-full object-cover opacity-60" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1d24] to-transparent"></div>

                <div className="absolute bottom-4 left-4 right-4">
                    <h2 className="text-2xl font-bold text-white mb-1">{machine.name}</h2>
                    <div className="flex gap-2">
                        <div className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${machine.status === MachineStatus.AVAILABLE ? 'bg-emerald-500/20 text-emerald-400' :
                            machine.status === MachineStatus.RENTED ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'
                            }`}>
                            {machine.status === MachineStatus.AVAILABLE ? 'Verfügbar' :
                                machine.status === MachineStatus.RENTED ? 'Verliehen' : 'In Reparatur'}
                        </div>
                        {machine.nextMaintenance && (
                            <div className="px-2 py-0.5 rounded text-xs bg-white/10 text-white/50 flex items-center gap-1">
                                <Wrench size={12} /> Wartung: {new Date(machine.nextMaintenance).toLocaleDateString()}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* QUICK ACTIONS BAR (Only in Overview) */}
            {mode === 'overview' && (
                <div className="p-4 grid grid-cols-2 gap-2 shrink-0 border-b border-white/5">
                    {machine.status === MachineStatus.AVAILABLE ? (
                        <Button onClick={() => setMode('borrow')} className="bg-emerald-600 hover:bg-emerald-500">Ausleihen</Button>
                    ) : machine.status === MachineStatus.RENTED ? (
                        <>
                            <Button onClick={() => setMode('return')} variant="secondary">Rückgabe</Button>
                            <Button onClick={() => setMode('borrow')} className="bg-amber-600 hover:bg-amber-500">Weitergeben</Button>
                        </>
                    ) : (
                        <Button onClick={executeRepairFinish} className="bg-emerald-600 hover:bg-emerald-500 col-span-2">Reparatur Fertig</Button>
                    )}
                </div>
            )}

            {/* TAB NAVIGATION */}
            {mode === 'overview' && (
                <div className="flex border-b border-white/5 mx-4 overflow-x-auto gap-4 my-2">
                    <button onClick={() => setMode('reservations')} className="pb-2 text-sm text-white/50 hover:text-white transition-colors flex items-center gap-2">
                        <Calendar size={14} /> Reservierungen {reservations.length > 0 && <span className="bg-white/10 px-1 rounded text-[10px]">{reservations.length}</span>}
                    </button>
                    <button onClick={() => setMode('history')} className="pb-2 text-sm text-white/50 hover:text-white transition-colors flex items-center gap-2">
                        <History size={14} /> Verlauf
                    </button>
                    {/* Add Edit button later or here */}
                </div>
            )}

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

                {/* --- OVERVIEW --- */}
                {mode === 'overview' && (
                    <div className="space-y-4">
                        {machine.status === MachineStatus.RENTED && (
                            <GlassCard className="bg-amber-500/10 border-amber-500/20">
                                <h3 className="text-sm font-bold text-amber-200 mb-2 flex items-center gap-2"><User size={16} /> Aktueller Besitzer</h3>
                                <div className="text-xl font-bold text-white">{machine.profiles?.full_name || machine.externalBorrower || 'Unbekannt'}</div>
                            </GlassCard>
                        )}
                        {machine.status === MachineStatus.REPAIR && (
                            <GlassCard className="bg-rose-500/10 border-rose-500/20">
                                <h3 className="text-sm font-bold text-rose-200 mb-2 flex items-center gap-2"><AlertTriangle size={16} /> Defekt Beschreibung</h3>
                                <div className="text-white italic">"{machine.notes}"</div>
                            </GlassCard>
                        )}

                        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                            <h3 className="text-sm font-bold text-white/50 mb-4">Nächste Reservierungen</h3>
                            {reservations.length === 0 ? <div className="text-white/30 text-sm">Keine anstehenden Reservierungen.</div> : (
                                <div className="space-y-2">
                                    {reservations.slice(0, 3).map(r => (
                                        <div key={r.id} className="flex justify-between items-center text-sm bg-black/20 p-2 rounded">
                                            <span className="text-emerald-400 font-mono">{new Date(r.start_date).toLocaleDateString()}</span>
                                            <span className="text-white">{r.profiles?.full_name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- BORROW --- */}
                {mode === 'borrow' && (
                    <div className="space-y-4 animate-in slide-in-from-right-4">
                        <div className="flex items-center gap-2 mb-4">
                            <button onClick={() => setMode('overview')} className="p-2 hover:bg-white/10 rounded-full"><ArrowLeft size={20} className="text-white" /></button>
                            <h3 className="text-lg font-bold text-white">{machine.status === MachineStatus.RENTED ? 'Weitergeben / Transfer' : 'Ausleihen'}</h3>
                        </div>

                        {conflictWarning && (
                            <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-200 text-sm flex items-center gap-2">
                                <AlertTriangle size={16} /> {conflictWarning}
                            </div>
                        )}

                        <div className="flex gap-2 p-1 bg-white/5 rounded-lg mb-4">
                            <button onClick={() => setIsExternalBorrow(false)} className={`flex-1 py-2 text-sm rounded transition-colors ${!isExternalBorrow ? 'bg-emerald-600 text-white shadow' : 'text-white/50 hover:bg-white/5'}`}>Intern (Mitarbeiter)</button>
                            <button onClick={() => setIsExternalBorrow(true)} className={`flex-1 py-2 text-sm rounded transition-colors ${isExternalBorrow ? 'bg-blue-600 text-white shadow' : 'text-white/50 hover:bg-white/5'}`}>Extern / Kunde</button>
                        </div>

                        {!isExternalBorrow ? (
                            <div className="space-y-2">
                                <label className="text-xs text-white/50">Mitarbeiter wählen</label>
                                <GlassSelect value={borrowTargetUser} onChange={(e) => setBorrowTargetUser(e.target.value)}>
                                    <option value="" disabled>Bitte wählen...</option>
                                    {users.map(u => <option key={u.id} value={u.id} className="bg-gray-900">{u.full_name}</option>)}
                                </GlassSelect>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-xs text-white/50">Name des Kunden</label>
                                <GlassInput value={borrowExternalName} onChange={(e) => setBorrowExternalName(e.target.value)} placeholder="Max Mustermann" />
                            </div>
                        )}

                        <Button onClick={executeBorrow} disabled={loading || (!isExternalBorrow && !borrowTargetUser) || (isExternalBorrow && !borrowExternalName)} className="w-full mt-4 bg-emerald-600 h-12">
                            {loading ? <Loader2 className="animate-spin" /> : 'Bestätigen'}
                        </Button>
                    </div>
                )}

                {/* --- RETURN --- */}
                {mode === 'return' && (
                    <div className="space-y-4 animate-in slide-in-from-right-4">
                        <div className="flex items-center gap-2 mb-4">
                            <button onClick={() => setMode('overview')} className="p-2 hover:bg-white/10 rounded-full"><ArrowLeft size={20} className="text-white" /></button>
                            <h3 className="text-lg font-bold text-white">Rückgabe</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setReturnCondition('OK')} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${returnCondition === 'OK' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-white/5 border-white/10 text-white/50'}`}>
                                <CheckCircle2 size={32} /> <span className="font-bold">Alles OK</span>
                            </button>
                            <button onClick={() => setReturnCondition('Defect')} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${returnCondition === 'Defect' ? 'bg-rose-500/20 border-rose-500 text-rose-300' : 'bg-white/5 border-white/10 text-white/50'}`}>
                                <AlertTriangle size={32} /> <span className="font-bold">Defekt</span>
                            </button>
                        </div>

                        {returnCondition === 'Defect' && (
                            <div className="space-y-2 animate-in fade-in">
                                <label className="text-xs text-white/50">Beschreibung des Defekts</label>
                                <textarea
                                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-rose-500"
                                    rows={3}
                                    value={defectNote}
                                    onChange={e => setDefectNote(e.target.value)}
                                    placeholder="Was ist beschädigt?"
                                />
                            </div>
                        )}

                        <Button onClick={executeReturn} disabled={loading} className="w-full mt-4 bg-emerald-600 h-12">
                            {loading ? <Loader2 className="animate-spin" /> : 'Rücknahme Buchen'}
                        </Button>
                    </div>
                )}

                {/* --- HISTORY --- */}
                {mode === 'history' && (
                    <div className="space-y-4 animate-in slide-in-from-right-4">
                        <div className="flex items-center gap-2 mb-4">
                            <button onClick={() => setMode('overview')} className="p-2 hover:bg-white/10 rounded-full"><ArrowLeft size={20} className="text-white" /></button>
                            <h3 className="text-lg font-bold text-white">Verlauf</h3>
                        </div>
                        <div className="space-y-3">
                            {historyLogs.map(log => (
                                <div key={log.id} className="relative pl-4 border-l border-white/10 text-sm pb-4 last:pb-0">
                                    <div className="absolute -left-1 top-0 w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <div className="font-bold text-white">{new Date(log.created_at).toLocaleString()}</div>
                                    <div className="text-white/70">{log.details}</div>
                                    <div className="text-xs text-white/30 mt-1">Durch: {log.profiles?.full_name}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- RESERVATIONS --- */}
                {mode === 'reservations' && (
                    <div className="space-y-4 animate-in slide-in-from-right-4">
                        <div className="flex items-center gap-2 mb-4">
                            <button onClick={() => setMode('overview')} className="p-2 hover:bg-white/10 rounded-full"><ArrowLeft size={20} className="text-white" /></button>
                            <h3 className="text-lg font-bold text-white">Reservierungen</h3>
                        </div>

                        <div className="bg-white/5 rounded-xl p-4 border border-white/5 mb-6">
                            <h4 className="font-bold text-white mb-3 text-sm">Neue Reservierung</h4>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div><label className="text-xs text-white/50">Von</label><input type="date" className="w-full bg-black/30 border border-white/10 rounded p-2 text-sm text-white" value={resStartDate} onChange={e => setResStartDate(e.target.value)} /></div>
                                <div><label className="text-xs text-white/50">Bis</label><input type="date" className="w-full bg-black/30 border border-white/10 rounded p-2 text-sm text-white" value={resEndDate} onChange={e => setResEndDate(e.target.value)} /></div>
                            </div>
                            <input className="w-full bg-black/30 border border-white/10 rounded p-2 text-sm text-white mb-3" placeholder="Notiz (Optional)" value={resNote} onChange={e => setResNote(e.target.value)} />
                            <Button onClick={executeReservation} disabled={loading} size="sm" className="w-full">Reservieren</Button>
                        </div>

                        <div className="space-y-2">
                            {reservations.map(r => (
                                <div key={r.id} className="bg-white/5 p-3 rounded-lg flex justify-between items-center group">
                                    <div>
                                        <div className="font-bold text-white text-sm">{new Date(r.start_date).toLocaleDateString()} - {new Date(r.end_date).toLocaleDateString()}</div>
                                        <div className="text-xs text-white/50">{r.profiles?.full_name} {r.note && `• ${r.note}`}</div>
                                    </div>
                                    {r.user_id === user?.id && (
                                        <button onClick={() => deleteReservation(r.id)} className="p-2 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                                    )}
                                </div>
                            ))}
                            {reservations.length === 0 && <div className="text-center text-white/30 text-sm py-4">Keine Reservierungen.</div>}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
