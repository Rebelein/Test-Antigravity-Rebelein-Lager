import React, { useEffect, useState, useRef } from 'react';
import { GlassCard, StatusBadge, Button, GlassInput } from '../components/UIComponents';
import { MachineStatus, Machine, UserProfile } from '../types';
import { Wrench, Plus, MoreVertical, Edit2, Trash2, Printer, Search, Lock, Drill, User } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { MasterDetailLayout } from '../components/MasterDetailLayout';
import { MachineDetailContent } from '../components/machines/MachineDetailContent';
import { toast } from 'sonner';

const Machines: React.FC = () => {
    const { user } = useAuth();
    const location = useLocation();

    // Data State
    const [machines, setMachines] = useState<Machine[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    // View State
    const [activeTab, setActiveTab] = useState<'available' | 'unavailable'>('available');
    const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingMachineId, setEditingMachineId] = useState<string | null>(null);
    const [machineForm, setMachineForm] = useState({ name: '', image: '', nextMaintenance: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Image Upload State
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number; } | null>(null);

    useEffect(() => {
        fetchMachines();
        fetchUsers();
    }, []);

    // Handle Deep Linking
    useEffect(() => {
        const state = location.state as { openMachineId?: string } | null;
        if (state && state.openMachineId && machines.length > 0) {
            const target = machines.find(m => m.id === state.openMachineId);
            if (target) {
                setSelectedMachine(target);
                // Clear state
                window.history.replaceState({}, document.title);
            }
        }
    }, [location, machines]);

    const fetchMachines = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('machines')
                .select('*, profiles:assigned_to(full_name)')
                .order('name', { ascending: true });

            if (error) throw error;
            if (data) {
                const mapped: Machine[] = data.map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    status: m.status,
                    assignedTo: m.assigned_to,
                    externalBorrower: m.external_borrower,
                    nextMaintenance: m.next_maintenance,
                    image: m.image_url,
                    notes: m.notes,
                    profiles: m.profiles
                }));
                // Update selected machine if it exists (to refresh view)
                setMachines(mapped);
                if (selectedMachine) {
                    const updated = mapped.find(m => m.id === selectedMachine.id);
                    if (updated) setSelectedMachine(updated);
                }
            }
        } catch (err) {
            console.error(err);
            toast.error("Fehler beim Laden der Maschinen");
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        const { data } = await supabase.from('profiles').select('id, full_name');
        if (data) setUsers(data as any[]);
    };

    // --- HANDLERS ---

    const handleCreate = () => {
        setEditingMachineId(null);
        setMachineForm({ name: '', image: '', nextMaintenance: '' });
        setShowEditModal(true);
    };

    const handleEdit = (m: Machine) => {
        setContextMenu(null);
        setEditingMachineId(m.id);
        setMachineForm({ name: m.name, image: m.image || '', nextMaintenance: m.nextMaintenance || '' });
        setShowEditModal(true);
    };

    const handleDeleteMachine = async (machine: Machine) => {
        setContextMenu(null);
        if (!window.confirm(`Möchtest du "${machine.name}" wirklich löschen?`)) return;
        try {
            const { error } = await supabase.from('machines').delete().eq('id', machine.id);
            if (error) throw error;
            toast.success("Maschine gelöscht");
            if (selectedMachine?.id === machine.id) setSelectedMachine(null);
            fetchMachines();
        } catch (e: any) {
            toast.error("Fehler beim Löschen: " + e.message);
        }
    };

    const executeSave = async () => {
        if (!machineForm.name) return toast.error("Name ist erforderlich");
        setIsSubmitting(true);
        try {
            const payload = {
                name: machineForm.name,
                image_url: machineForm.image,
                next_maintenance: machineForm.nextMaintenance || null,
                status: editingMachineId ? undefined : MachineStatus.AVAILABLE
            };

            // Remove undefined keys in a cleaner way if needed, but supabase ignores undefined often if not set. 
            // Better to be explicit:
            const dataToUpsert = editingMachineId ? payload : { ...payload, status: MachineStatus.AVAILABLE };

            if (editingMachineId) {
                await supabase.from('machines').update(dataToUpsert).eq('id', editingMachineId);
            } else {
                await supabase.from('machines').insert(dataToUpsert);
            }
            fetchMachines();
            setShowEditModal(false);
            toast.success("Maschine gespeichert");
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const processFileUpload = async (file: File) => {
        try {
            setIsUploading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `machine_${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
            const { error } = await supabase.storage.from('article-images').upload(fileName, file);
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from('article-images').getPublicUrl(fileName);
            setMachineForm(prev => ({ ...prev, image: publicUrl }));
        } catch (error: any) {
            toast.error("Upload Fehler: " + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleContextMenuClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // Check if this stops card click
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        setContextMenu({ id, x: rect.left - 160, y: rect.bottom + 5 });
    };

    // Close Context Menu
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    const handlePrintLabel = (machine: Machine) => {
        setContextMenu(null);
        // Standard print logic can be extracted, reusing inline for simple port
        const printWindow = window.open('', 'PRINT_MACH', 'height=400,width=600');
        if (!printWindow) return;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`MACH:${machine.id}`)}`;
        printWindow.document.write(`<html><body style="font-family:sans-serif;text-align:center;padding:20px;"><h2 style="margin:0">${machine.name}</h2><p style="margin:5px 0;font-size:10px;">ID: ${machine.id}</p><img src="${qrUrl}" style="width:150px;height:150px;" /><p style="font-weight:bold;">Eigentum der Firma</p></body><script>window.onload=()=>{window.print();window.close();}</script></html>`);
        printWindow.document.close();
    };


    // --- FILTERING ---
    const getFilteredMachines = (tab: 'available' | 'unavailable') => {
        return machines.filter(m => {
            const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesTab = tab === 'available' ? m.status === MachineStatus.AVAILABLE : m.status !== MachineStatus.AVAILABLE;
            return matchesSearch && matchesTab;
        }).sort((a, b) => a.name.localeCompare(b.name));
    };

    const visibleMachines = getFilteredMachines(activeTab);
    const availableCount = machines.filter(m => m.status === MachineStatus.AVAILABLE).length;
    const unavailableCount = machines.filter(m => m.status !== MachineStatus.AVAILABLE).length;

    // --- RENDER CONTENT ---

    const renderListContent = () => (
        <div className="space-y-6 pb-24 h-full overflow-y-auto pr-2">
            <header className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-200">
                        Maschinenpark
                    </h1>
                    <p className="text-white/50">Verwaltung und Verleih von Werkzeugen.</p>
                </div>
                <Button icon={<Plus size={18} />} onClick={handleCreate}>Neu</Button>
            </header>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-black/20 rounded-xl border border-white/5 mb-6">
                <button
                    onClick={() => setActiveTab('available')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'available' ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 shadow' : 'text-white/50'}`}
                >
                    <Drill size={16} /> Verfügbar <span className="ml-1 bg-white/10 px-1.5 rounded text-[10px]">{availableCount}</span>
                </button>
                <button
                    onClick={() => setActiveTab('unavailable')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'unavailable' ? 'bg-rose-500/20 text-rose-200 border border-rose-500/30 shadow' : 'text-white/50'}`}
                >
                    <Lock size={16} /> Verliehen / Defekt <span className="ml-1 bg-white/10 px-1.5 rounded text-[10px]">{unavailableCount}</span>
                </button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                <input
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder="Maschine suchen..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* List */}
            <div className="flex flex-col gap-3">
                {visibleMachines.map((machine) => (
                    <div
                        key={machine.id}
                        onClick={() => setSelectedMachine(machine)}
                        className={`bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-2.5 flex items-center gap-3 hover:bg-white/10 transition-all cursor-pointer ${selectedMachine?.id === machine.id ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`}
                    >
                        <div className="w-14 h-14 shrink-0 rounded-lg bg-black/30 overflow-hidden relative border border-white/5">
                            <img src={machine.image || `https://picsum.photos/seed/${machine.id}/200`} className="w-full h-full object-cover opacity-90" />
                            {machine.status !== MachineStatus.AVAILABLE && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    {machine.status === MachineStatus.REPAIR ? <Wrench size={16} className="text-rose-400" /> : <User size={16} className="text-white" />}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-white truncate">{machine.name}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <StatusBadge status={machine.status} />
                                {machine.status === MachineStatus.RENTED && <span className="text-xs text-amber-300 truncate">{machine.profiles?.full_name || machine.externalBorrower}</span>}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={(e) => handleContextMenuClick(e, machine.id)} className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                <MoreVertical size={20} />
                            </button>
                        </div>
                    </div>
                ))}
                {visibleMachines.length === 0 && <div className="text-center py-8 text-white/30">Keine Maschinen gefunden.</div>}
            </div>
        </div>
    );

    return (
        <MasterDetailLayout
            title="Maschinenpark"
            isOpen={!!selectedMachine}
            onClose={() => setSelectedMachine(null)}
            listContent={renderListContent()}
            detailContent={selectedMachine ? (
                <MachineDetailContent
                    machine={selectedMachine}
                    users={users}
                    onClose={() => setSelectedMachine(null)}
                    onUpdate={fetchMachines}
                />
            ) : null}
        >
            {/* EDIT MODAL (Global) */}
            {showEditModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <GlassCard className="w-full max-w-md">
                        <h2 className="text-xl font-bold text-white mb-4">{editingMachineId ? 'Maschine bearbeiten' : 'Neue Maschine'}</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-white/50 block mb-1">Name</label>
                                <GlassInput value={machineForm.name} onChange={e => setMachineForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Bezeichnung" />
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 bg-white/5 rounded-lg border border-white/10 flex items-center justify-center overflow-hidden relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    {machineForm.image ? <img src={machineForm.image} className="w-full h-full object-cover" /> : <Plus className="text-white/20" />}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-white">Ändern</div>
                                </div>
                                <div className="flex-1">
                                    <button onClick={() => fileInputRef.current?.click()} className="text-sm text-emerald-400 hover:text-emerald-300">Bild hochladen</button>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => { if (e.target.files?.[0]) processFileUpload(e.target.files[0]) }} />
                                    <p className="text-xs text-white/40 mt-1">Klicken zum Upload</p>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-white/50 block mb-1">Nächste Wartung (Optional)</label>
                                <input type="date" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:outline-none" value={machineForm.nextMaintenance ? new Date(machineForm.nextMaintenance).toISOString().split('T')[0] : ''} onChange={e => setMachineForm(prev => ({ ...prev, nextMaintenance: e.target.value }))} />
                            </div>

                            <div className="flex justify-end gap-3 mt-4">
                                <Button variant="secondary" onClick={() => setShowEditModal(false)}>Abbrechen</Button>
                                <Button onClick={executeSave} disabled={isSubmitting || isUploading} className="bg-emerald-600 hover:bg-emerald-500">{isSubmitting ? 'Speichere...' : 'Speichern'}</Button>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* CONTEXT MENU */}
            {contextMenu && (
                <div className="fixed bg-[#1a1d24] border border-white/10 rounded-xl shadow-2xl z-[9999] overflow-hidden w-48" style={{ top: contextMenu.y, left: contextMenu.x }}>
                    {(() => {
                        const m = machines.find(mac => mac.id === contextMenu.id);
                        if (!m) return null;
                        return (
                            <div className="py-1">
                                <button onClick={() => { handlePrintLabel(m); }} className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 flex gap-3 items-center"><Printer size={16} /> Etikett</button>
                                <button onClick={() => { handleEdit(m); }} className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 flex gap-3 items-center"><Edit2 size={16} /> Bearbeiten</button>
                                <div className="h-px bg-white/10 my-1"></div>
                                <button onClick={() => { handleDeleteMachine(m); }} className="w-full text-left px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 flex gap-3 items-center"><Trash2 size={16} /> Löschen</button>
                            </div>
                        )
                    })()}
                </div>
            )}
        </MasterDetailLayout>
    );
};

export default Machines;
