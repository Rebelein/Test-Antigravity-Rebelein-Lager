
import React, { useEffect, useState, useRef } from 'react';
import { GlassCard, StatusBadge, Button, GlassInput, GlassSelect } from '../components/UIComponents';
import { MachineStatus, Machine, MachineEvent, UserProfile, MachineReservation } from '../types';
import { Wrench, Calendar, User, Loader2, Plus, Printer, AlertTriangle, Edit2, CheckCircle2, History, X, Trash2, ArrowRight, ImageIcon, ExternalLink, MoreVertical, Eye, Drill, Lock } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

const Machines: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);

  // --- TAB STATE ---
  // 'available' = Only Status AVAILABLE
  // 'unavailable' = Status RENTED OR REPAIR
  const [activeTab, setActiveTab] = useState<'available' | 'unavailable'>('available');

  // --- MODAL STATES ---
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);
  const [machineForm, setMachineForm] = useState({ name: '', image: '', nextMaintenance: '' });
  
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Image Upload State
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Borrow Flow State
  const [borrowTargetUser, setBorrowTargetUser] = useState<string>('');
  const [borrowExternalName, setBorrowExternalName] = useState<string>('');
  const [isExternalBorrow, setIsExternalBorrow] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Return Flow State
  const [returnCondition, setReturnCondition] = useState<'OK' | 'Defect'>('OK');
  const [defectNote, setDefectNote] = useState('');

  // Reservation Flow State
  const [resStartDate, setResStartDate] = useState('');
  const [resEndDate, setResEndDate] = useState('');
  const [resNote, setResNote] = useState('');
  const [reservations, setReservations] = useState<MachineReservation[]>([]);

  // History State
  const [historyLogs, setHistoryLogs] = useState<MachineEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
      fetchMachines();
      fetchUsers();
  }, []);

  // Handle Scanner Redirect (Deep Link)
  useEffect(() => {
      const state = location.state as { openMachineId?: string } | null;
      if (state && state.openMachineId && machines.length > 0) {
          const target = machines.find(m => m.id === state.openMachineId);
          if (target) {
              // Open borrow or return based on status
              if (target.status === MachineStatus.AVAILABLE) {
                  handleOpenBorrow(target);
              } else {
                  handleOpenReturn(target);
              }
              // Clear state to prevent re-opening on refresh
              window.history.replaceState({}, document.title);
          }
      }
  }, [location, machines]);

  // Click outside listener for context menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (contextMenu && !(event.target as Element).closest('.context-menu-container')) {
        setContextMenu(null);
      }
    }
    function handleScroll() {
        if (contextMenu) setContextMenu(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("scroll", handleScroll, true);
    };
  }, [contextMenu]);

  const fetchMachines = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('machines')
        .select('*, profiles:assigned_to(full_name)')
        .order('name', { ascending: true }); // Database sort
      
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
          profiles: m.profiles // joined data
        }));
        setMachines(mapped);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      if (data) setUsers(data as any[]);
  };

  const fetchReservations = async (machineId: string) => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('machine_reservations')
        .select('*, profiles(full_name)')
        .eq('machine_id', machineId)
        .gte('end_date', today) // Only future/current
        .order('start_date');
      
      if (data) setReservations(data as any[]);
  };

  // --- IMAGE UPLOAD LOGIC ---
  const processFileUpload = async (file: File) => {
      try {
          setIsUploading(true);
          
          const fileExt = file.name.split('.').pop();
          const fileName = `machine_${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { data, error } = await supabase.storage
              .from('article-images') // Reuse existing bucket
              .upload(filePath, file);

          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage
              .from('article-images')
              .getPublicUrl(filePath);

          setMachineForm(prev => ({ ...prev, image: publicUrl }));
      } catch (error: any) {
          console.error("Upload error:", error);
          alert("Fehler beim Upload: " + (error.message || "Unbekannt"));
      } finally {
          setIsUploading(false);
      }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          processFileUpload(e.target.files[0]);
      }
  };

  // --- ACTION HANDLERS ---

  const handleContextMenuClick = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      // Position menu to the left of the button to avoid overflow
      setContextMenu({
          id,
          x: rect.left - 160, // Shift left
          y: rect.bottom + 5
      });
  };

  const handleOpenBorrow = async (machine: Machine) => {
      setSelectedMachine(machine);
      setBorrowTargetUser(user?.id || ''); // Default to self
      setIsExternalBorrow(false);
      setBorrowExternalName('');
      setConflictWarning(null);
      
      // Check for reservations for THIS machine
      await fetchReservations(machine.id);
      
      setShowBorrowModal(true);
  };

  const checkReservationConflict = () => {
      // Simple check if "today" is reserved by someone else
      const today = new Date().toISOString().split('T')[0];
      const conflict = reservations.find(r => r.start_date <= today && r.end_date >= today && r.user_id !== borrowTargetUser);
      
      if (conflict) {
          setConflictWarning(`ACHTUNG: Reserviert für ${conflict.profiles?.full_name} bis ${conflict.end_date}!`);
      } else {
          setConflictWarning(null);
      }
  };
  
  useEffect(() => {
      if (showBorrowModal && reservations.length > 0) {
          checkReservationConflict();
      }
  }, [borrowTargetUser, reservations]);

  const executeBorrow = async () => {
      if (!selectedMachine || !user) return;
      setIsSubmitting(true);
      try {
          const isTransfer = selectedMachine.status === MachineStatus.RENTED;
          const actionType = isTransfer ? 'transfer' : 'rented';
          
          const updates: any = {
              status: MachineStatus.RENTED,
              assigned_to: isExternalBorrow ? null : (borrowTargetUser || null), // Ensure null if empty string
              external_borrower: isExternalBorrow ? borrowExternalName : null
          };

          await supabase.from('machines').update(updates).eq('id', selectedMachine.id);

          // Log Event
          const borrowerName = isExternalBorrow ? borrowExternalName : users.find(u => u.id === borrowTargetUser)?.full_name;
          const details = isTransfer 
            ? `Übergabe von ${selectedMachine.profiles?.full_name || selectedMachine.externalBorrower || 'Unbekannt'} an ${borrowerName}`
            : `Ausgeliehen an ${borrowerName}`;

          await supabase.from('machine_events').insert({
              machine_id: selectedMachine.id,
              user_id: user.id,
              action: actionType,
              details: details
          });

          await fetchMachines();
          setShowBorrowModal(false);
      } catch (e: any) {
          alert(e.message);
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleOpenReturn = (machine: Machine) => {
      setSelectedMachine(machine);
      setReturnCondition('OK');
      setDefectNote('');
      setShowReturnModal(true);
  };

  const executeReturn = async () => {
      if (!selectedMachine || !user) return;
      setIsSubmitting(true);
      try {
          const isDefect = returnCondition === 'Defect';
          
          await supabase.from('machines').update({
              status: isDefect ? MachineStatus.REPAIR : MachineStatus.AVAILABLE,
              assigned_to: null,
              external_borrower: null,
              notes: isDefect ? defectNote : null
          }).eq('id', selectedMachine.id);

          await supabase.from('machine_events').insert({
              machine_id: selectedMachine.id,
              user_id: user.id,
              action: isDefect ? 'defect' : 'returned',
              details: isDefect ? `Rückgabe mit Defekt: ${defectNote}` : 'Rückgabe OK'
          });

          await fetchMachines();
          setShowReturnModal(false);
      } catch (e: any) {
          alert(e.message);
      } finally {
          setIsSubmitting(false);
      }
  };
  
  const handleRepairFinish = async (machine: Machine) => {
      if (!window.confirm("Reparatur abgeschlossen und Maschine wieder verfügbar?")) return;
      
      try {
          await supabase.from('machines').update({
              status: MachineStatus.AVAILABLE,
              notes: null
          }).eq('id', machine.id);
          
          if (user) {
              await supabase.from('machine_events').insert({
                  machine_id: machine.id,
                  user_id: user.id,
                  action: 'repaired',
                  details: 'Reparatur abgeschlossen, wieder verfügbar'
              });
          }
          await fetchMachines();
      } catch (e) { console.error(e); }
  };

  const handleOpenReservations = async (machine: Machine) => {
      setContextMenu(null);
      setSelectedMachine(machine);
      await fetchReservations(machine.id);
      setResStartDate('');
      setResEndDate('');
      setResNote('');
      setShowReservationModal(true);
  };

  const executeReservation = async () => {
      if (!selectedMachine || !user || !resStartDate || !resEndDate) return;
      
      // Basic Overlap Check
      const overlap = reservations.find(r => {
          return (resStartDate <= r.end_date && resEndDate >= r.start_date);
      });
      
      if (overlap) {
          alert(`Konflikt! Bereits reserviert von ${overlap.start_date} bis ${overlap.end_date}`);
          return;
      }

      setIsSubmitting(true);
      try {
          await supabase.from('machine_reservations').insert({
              machine_id: selectedMachine.id,
              user_id: user.id,
              start_date: resStartDate,
              end_date: resEndDate,
              note: resNote
          });
          
          await supabase.from('machine_events').insert({
              machine_id: selectedMachine.id,
              user_id: user.id,
              action: 'reserved',
              details: `Reserviert vom ${resStartDate} bis ${resEndDate}`
          });

          await fetchReservations(selectedMachine.id); // Refresh list
          setResStartDate('');
          setResEndDate('');
          setResNote('');
      } catch (e: any) {
          alert(e.message);
      } finally {
          setIsSubmitting(false);
      }
  };
  
  const handleDeleteReservation = async (resId: string) => {
      if (!window.confirm("Reservierung löschen?")) return;
      await supabase.from('machine_reservations').delete().eq('id', resId);
      if (selectedMachine) fetchReservations(selectedMachine.id);
  };

  const handleOpenHistory = async (machine: Machine) => {
      setContextMenu(null);
      setSelectedMachine(machine);
      setLoadingHistory(true);
      setShowHistoryModal(true);
      
      const { data } = await supabase
          .from('machine_events')
          .select('*, profiles(full_name)')
          .eq('machine_id', machine.id)
          .order('created_at', { ascending: false });
      
      setHistoryLogs(data as any[] || []);
      setLoadingHistory(false);
  };

  // --- CRUD ---

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
      if (!window.confirm(`Möchtest du "${machine.name}" wirklich unwiderruflich löschen?`)) return;
      
      try {
          const { error } = await supabase.from('machines').delete().eq('id', machine.id);
          if (error) throw error;
          await fetchMachines();
      } catch (e: any) {
          alert("Fehler beim Löschen: " + e.message);
      }
  };

  const executeSave = async () => {
      setIsSubmitting(true);
      try {
          const payload = {
              name: machineForm.name,
              image_url: machineForm.image,
              next_maintenance: machineForm.nextMaintenance || null,
              status: editingMachineId ? undefined : MachineStatus.AVAILABLE
          };
          
          // Remove undefined keys
          Object.keys(payload).forEach(key => (payload as any)[key] === undefined && delete (payload as any)[key]);

          if (editingMachineId) {
              await supabase.from('machines').update(payload).eq('id', editingMachineId);
          } else {
              await supabase.from('machines').insert(payload);
          }
          await fetchMachines();
          setShowEditModal(false);
      } catch (e: any) {
          alert(e.message);
      } finally {
          setIsSubmitting(false);
      }
  };

  const handlePrintLabel = (machine: Machine) => {
      setContextMenu(null);
      const printWindow = window.open('', 'PRINT_MACH', 'height=400,width=600');
      if (!printWindow) return;
      
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`MACH:${machine.id}`)}`;
      
      printWindow.document.write(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 20px;">
             <h2 style="margin:0">${machine.name}</h2>
             <p style="margin:5px 0; font-size: 10px;">ID: ${machine.id}</p>
             <img src="${qrUrl}" style="width: 150px; height: 150px;" />
             <p style="font-weight:bold;">Eigentum der Firma</p>
          </body>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </html>
      `);
      printWindow.document.close();
  };

  // --- RENDER HELPERS ---

  const getStatusType = (status: MachineStatus) => {
    switch(status) {
      case MachineStatus.AVAILABLE: return 'success';
      case MachineStatus.RENTED: return 'warning';
      case MachineStatus.REPAIR: return 'danger';
      default: return 'neutral';
    }
  };

  const translateStatus = (status: MachineStatus) => {
    switch(status) {
      case MachineStatus.AVAILABLE: return 'Verfügbar';
      case MachineStatus.RENTED: return 'Verliehen';
      case MachineStatus.REPAIR: return 'In Reparatur';
      default: return status;
    }
  };

  // Filter & Sort Lists (Client Side Sort to guarantee alphabetical order)
  // UPDATED LOGIC:
  // "Available" = Status AVAILABLE
  // "Unavailable" = Status NOT AVAILABLE (includes RENTED and REPAIR)
  
  const availableMachines = machines
    .filter(m => m.status === MachineStatus.AVAILABLE)
    .sort((a, b) => a.name.localeCompare(b.name));

  const unavailableMachines = machines
    .filter(m => m.status !== MachineStatus.AVAILABLE) // RENTED or REPAIR
    .sort((a, b) => a.name.localeCompare(b.name));

  const visibleMachines = activeTab === 'available' ? availableMachines : unavailableMachines;
  const contextMenuMachine = contextMenu ? machines.find(m => m.id === contextMenu.id) : null;

  return (
    <div className="space-y-6 pb-24 relative">
       <header className="flex justify-between items-start">
        <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-200">
            Maschinenpark
            </h1>
            <p className="text-white/50">Verwaltung und Verleih von Werkzeugen.</p>
        </div>
        <Button icon={<Plus size={18} />} onClick={handleCreate}>Neu</Button>
      </header>

      {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-emerald-400"/></div>
      ) : (
          <>
            {/* --- TABS (Reiter) --- */}
            <div className="flex gap-2 p-1 bg-black/20 rounded-xl border border-white/5 mb-6">
                <button 
                    onClick={() => setActiveTab('available')} 
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'available' ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 shadow' : 'text-white/50'}`}
                >
                    <Drill size={16} /> Verfügbar
                    <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeTab === 'available' ? 'bg-emerald-500/30 text-white' : 'bg-white/5 text-white/40'}`}>
                        {availableMachines.length}
                    </span>
                </button>
                <button 
                    onClick={() => setActiveTab('unavailable')} 
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'unavailable' ? 'bg-rose-500/20 text-rose-200 border border-rose-500/30 shadow' : 'text-white/50'}`}
                >
                    <Lock size={16} /> Nicht Verfügbar
                    <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeTab === 'unavailable' ? 'bg-rose-500/30 text-white' : 'bg-white/5 text-white/40'}`}>
                        {unavailableMachines.length}
                    </span>
                </button>
            </div>

            {/* --- MAIN LIST VIEW (Compact Mobile) --- */}
            <div className="flex flex-col gap-3">
                {visibleMachines.map((machine) => (
                    <div key={machine.id} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-2.5 flex items-center gap-3 hover:bg-white/10 transition-colors animate-in fade-in slide-in-from-bottom-2">
                        
                        {/* Left: Image (Small Fixed) */}
                        <div className="w-14 h-14 shrink-0 rounded-lg bg-black/30 overflow-hidden relative border border-white/5">
                             <img src={machine.image || `https://picsum.photos/seed/${machine.id}/200`} alt={machine.name} className="w-full h-full object-cover opacity-90" />
                             {machine.status === MachineStatus.REPAIR && (
                                 <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                     <Wrench size={16} className="text-rose-400" />
                                 </div>
                             )}
                             {machine.status === MachineStatus.RENTED && (
                                 <div className="absolute inset-0 bg-emerald-900/60 flex items-center justify-center">
                                     <User size={16} className="text-white" />
                                 </div>
                             )}
                        </div>

                        {/* Middle: Info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <h3 className="text-base font-bold text-white truncate pr-2">{machine.name}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <StatusBadge status={translateStatus(machine.status)} type={getStatusType(machine.status)} />
                                {machine.status === MachineStatus.RENTED && (
                                    <span className="text-xs text-amber-300 truncate max-w-[100px]">
                                        {machine.profiles?.full_name || machine.externalBorrower}
                                    </span>
                                )}
                                {machine.status === MachineStatus.REPAIR && machine.notes && (
                                    <span className="text-xs text-rose-300 truncate max-w-[120px]">
                                        {machine.notes}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Right: Actions (One main button + Kebab Menu) */}
                        <div className="flex items-center gap-2 shrink-0 ml-auto">
                             {machine.status === MachineStatus.AVAILABLE && (
                                <Button onClick={() => handleOpenBorrow(machine)} className="h-9 px-3 text-xs bg-emerald-600 hover:bg-emerald-500">Ausleihen</Button>
                             )}
                             {machine.status === MachineStatus.RENTED && (
                                <Button onClick={() => handleOpenReturn(machine)} variant="secondary" className="h-9 px-3 text-xs">Rückgabe</Button>
                             )}
                             {machine.status === MachineStatus.REPAIR && (
                                <Button onClick={() => handleRepairFinish(machine)} className="h-9 px-3 text-xs bg-emerald-600 hover:bg-emerald-500">Repariert</Button>
                             )}
                             
                             <button 
                                onClick={(e) => handleContextMenuClick(e, machine.id)} 
                                className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                             >
                                 <MoreVertical size={20} />
                             </button>
                        </div>
                    </div>
                ))}
                {visibleMachines.length === 0 && <div className="text-center py-8 text-white/30">Keine Maschinen in diesem Bereich.</div>}
            </div>
          </>
      )}

      {/* --- CONTEXT MENU --- */}
      {contextMenu && contextMenuMachine && (
          <div 
            className="fixed bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-[9999] overflow-hidden w-48 context-menu-container" 
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
             <div className="py-1">
                 <button onClick={() => handleOpenReservations(contextMenuMachine)} className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 flex gap-3 items-center"><Calendar size={16} /> Reservieren</button>
                 <button onClick={() => handleOpenHistory(contextMenuMachine)} className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 flex gap-3 items-center"><History size={16} /> Verlauf</button>
                 <button onClick={() => handlePrintLabel(contextMenuMachine)} className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 flex gap-3 items-center"><Printer size={16} /> Etikett</button>
                 <button onClick={() => handleEdit(contextMenuMachine)} className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 flex gap-3 items-center"><Edit2 size={16} /> Bearbeiten</button>
                 <div className="h-px bg-white/10 my-1"></div>
                 <button onClick={() => handleDeleteMachine(contextMenuMachine)} className="w-full text-left px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 flex gap-3 items-center"><Trash2 size={16} /> Löschen</button>
             </div>
          </div>
      )}

      {/* --- MODALS --- */}

      {/* 1. BORROW MODAL */}
      {showBorrowModal && selectedMachine && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <GlassCard className="w-full max-w-md">
                  <h2 className="text-xl font-bold text-white mb-1">Maschine ausleihen</h2>
                  <p className="text-sm text-white/50 mb-4">{selectedMachine.name}</p>
                  
                  {conflictWarning && (
                      <div className="mb-4 p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-200 text-sm flex items-center gap-2">
                          <AlertTriangle size={16}/> {conflictWarning}
                      </div>
                  )}

                  <div className="space-y-4">
                      <div className="flex gap-2 p-1 bg-white/5 rounded-lg">
                          <button onClick={() => setIsExternalBorrow(false)} className={`flex-1 py-1.5 text-xs rounded ${!isExternalBorrow ? 'bg-emerald-600 text-white' : 'text-white/50'}`}>Intern</button>
                          <button onClick={() => setIsExternalBorrow(true)} className={`flex-1 py-1.5 text-xs rounded ${isExternalBorrow ? 'bg-blue-600 text-white' : 'text-white/50'}`}>Extern / Kunde</button>
                      </div>

                      {!isExternalBorrow ? (
                          <div>
                              <label className="text-xs text-white/50 mb-1 block">Mitarbeiter</label>
                              <GlassSelect 
                                value={borrowTargetUser}
                                onChange={(e) => setBorrowTargetUser(e.target.value)}
                              >
                                  {users.map(u => <option key={u.id} value={u.id} className="bg-gray-900 text-white">{u.full_name}</option>)}
                              </GlassSelect>
                          </div>
                      ) : (
                          <div>
                              <label className="text-xs text-white/50 mb-1 block">Name des Kunden / Externen</label>
                              <GlassInput value={borrowExternalName} onChange={(e) => setBorrowExternalName(e.target.value)} placeholder="Z.B. Kunde Müller" />
                          </div>
                      )}
                  </div>

                  <div className="flex gap-3 mt-6 justify-end">
                      <Button variant="secondary" onClick={() => setShowBorrowModal(false)}>Abbrechen</Button>
                      <Button onClick={executeBorrow} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-500">{isSubmitting ? <Loader2 className="animate-spin"/> : 'Bestätigen'}</Button>
                  </div>
              </GlassCard>
          </div>
      )}

      {/* 2. RETURN MODAL */}
      {showReturnModal && selectedMachine && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <GlassCard className="w-full max-w-md">
                  <h2 className="text-xl font-bold text-white mb-4">Rückgabe prüfen</h2>
                  
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                          <button 
                            onClick={() => setReturnCondition('OK')}
                            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${returnCondition === 'OK' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-white/5 border-white/10 text-white/50'}`}
                          >
                              <CheckCircle2 size={32} />
                              <span className="font-bold">Alles OK</span>
                          </button>
                          <button 
                            onClick={() => setReturnCondition('Defect')}
                            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${returnCondition === 'Defect' ? 'bg-rose-500/20 border-rose-500 text-rose-300' : 'bg-white/5 border-white/10 text-white/50'}`}
                          >
                              <AlertTriangle size={32} />
                              <span className="font-bold">Defekt / Problem</span>
                          </button>
                      </div>

                      {returnCondition === 'Defect' && (
                          <div className="animate-in slide-in-from-top-2">
                              <label className="text-xs text-white/50 mb-1 block">Beschreibung des Defekts</label>
                              <textarea 
                                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:outline-none"
                                rows={3}
                                placeholder="Was ist kaputt?"
                                value={defectNote}
                                onChange={e => setDefectNote(e.target.value)}
                              />
                          </div>
                      )}
                  </div>

                  <div className="flex gap-3 mt-6 justify-end">
                      <Button variant="secondary" onClick={() => setShowReturnModal(false)}>Abbrechen</Button>
                      <Button onClick={executeReturn} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-500">{isSubmitting ? <Loader2 className="animate-spin"/> : 'Rücknahme Buchen'}</Button>
                  </div>
              </GlassCard>
          </div>
      )}

      {/* 3. RESERVATION MODAL */}
      {showReservationModal && selectedMachine && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <GlassCard className="w-full max-w-lg">
                  <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold text-white">Reservierungen</h2>
                      <button onClick={() => setShowReservationModal(false)}><X className="text-white/50 hover:text-white"/></button>
                  </div>
                  
                  {/* List of existing */}
                  <div className="mb-6 max-h-40 overflow-y-auto space-y-2 bg-black/20 p-2 rounded-xl border border-white/5">
                      {reservations.length === 0 ? <div className="text-white/30 text-center text-sm py-2">Keine Reservierungen.</div> : reservations.map(r => (
                          <div key={r.id} className="flex justify-between items-center p-2 bg-white/5 rounded-lg text-sm">
                              <div>
                                  <div className="font-bold text-white">{new Date(r.start_date).toLocaleDateString()} - {new Date(r.end_date).toLocaleDateString()}</div>
                                  <div className="text-xs text-white/50">{r.profiles?.full_name}</div>
                              </div>
                              {r.user_id === user?.id && (
                                  <button onClick={() => handleDeleteReservation(r.id)} className="text-rose-400 hover:text-rose-300"><Trash2 size={14}/></button>
                              )}
                          </div>
                      ))}
                  </div>

                  <div className="border-t border-white/10 pt-4">
                      <h3 className="font-bold text-white mb-3">Neue Reservierung</h3>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                              <label className="text-xs text-white/50 block mb-1">Von</label>
                              <input type="date" className="w-full bg-white/10 border border-white/10 rounded p-2 text-white text-sm" value={resStartDate} onChange={e => setResStartDate(e.target.value)} />
                          </div>
                          <div>
                              <label className="text-xs text-white/50 block mb-1">Bis</label>
                              <input type="date" className="w-full bg-white/10 border border-white/10 rounded p-2 text-white text-sm" value={resEndDate} onChange={e => setResEndDate(e.target.value)} />
                          </div>
                      </div>
                      <div className="mb-4">
                           <label className="text-xs text-white/50 block mb-1">Notiz (Optional)</label>
                           <input type="text" className="w-full bg-white/10 border border-white/10 rounded p-2 text-white text-sm" value={resNote} onChange={e => setResNote(e.target.value)} />
                      </div>
                      <Button onClick={executeReservation} disabled={isSubmitting || !resStartDate || !resEndDate} className="w-full">{isSubmitting ? <Loader2 className="animate-spin"/> : 'Reservieren'}</Button>
                  </div>
              </GlassCard>
          </div>
      )}

      {/* 4. HISTORY MODAL */}
      {showHistoryModal && selectedMachine && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <GlassCard className="w-full max-w-lg max-h-[80vh] flex flex-col p-0">
                  <div className="p-4 border-b border-white/10 flex justify-between">
                      <h2 className="text-lg font-bold text-white">Verlauf: {selectedMachine.name}</h2>
                      <button onClick={() => setShowHistoryModal(false)}><X className="text-white/50 hover:text-white"/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {loadingHistory ? <Loader2 className="mx-auto animate-spin text-emerald-400"/> : historyLogs.map(log => (
                          <div key={log.id} className="bg-white/5 rounded-lg p-3 text-sm border border-white/5">
                              <div className="flex justify-between mb-1">
                                  <span className={`font-bold uppercase text-xs px-2 py-0.5 rounded ${log.action === 'defect' ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10 text-white/60'}`}>{log.action}</span>
                                  <span className="text-white/30 text-xs">{new Date(log.created_at).toLocaleString()}</span>
                              </div>
                              <div className="text-white">{log.details}</div>
                              <div className="text-xs text-white/40 mt-1">Log: {log.profiles?.full_name}</div>
                          </div>
                      ))}
                  </div>
              </GlassCard>
           </div>
      )}

      {/* 5. EDIT MODAL */}
      {showEditModal && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <GlassCard className="w-full max-w-md">
                  <h2 className="text-xl font-bold text-white mb-4">{editingMachineId ? 'Maschine bearbeiten' : 'Neue Maschine'}</h2>
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs text-white/50 block mb-1">Bezeichnung</label>
                          <GlassInput value={machineForm.name} onChange={e => setMachineForm({...machineForm, name: e.target.value})} />
                      </div>
                      
                      {/* IMAGE UPLOAD */}
                      <div>
                          <label className="text-xs text-white/50 block mb-2">Bild</label>
                          <div 
                             className="w-full h-40 rounded-xl border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center relative overflow-hidden group hover:border-white/20 transition-all"
                          >
                              <input 
                                  type="file" 
                                  ref={fileInputRef} 
                                  className="hidden" 
                                  accept="image/*" 
                                  onChange={handleFileSelect} 
                              />

                              {isUploading ? (
                                  <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="animate-spin text-emerald-400" size={24} />
                                    <span className="text-[10px] text-white/50">Upload...</span>
                                  </div>
                              ) : machineForm.image ? (
                                  <>
                                    <img src={machineForm.image} className="w-full h-full object-cover" alt="Maschine" />
                                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                                        >
                                            <ImageIcon size={16} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setMachineForm({...machineForm, image: ''}); }}
                                            className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-200 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                  </>
                              ) : (
                                  <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex flex-col items-center gap-2 text-white/30 hover:text-emerald-400 transition-colors"
                                  >
                                     <ImageIcon size={32} />
                                     <span className="text-xs">Bild hochladen</span>
                                  </button>
                              )}
                          </div>
                      </div>

                      <div>
                          <label className="text-xs text-white/50 block mb-1">Nächste Wartung</label>
                          <input type="date" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white" value={machineForm.nextMaintenance} onChange={e => setMachineForm({...machineForm, nextMaintenance: e.target.value})} />
                      </div>
                  </div>
                  <div className="flex items-center justify-end mt-6 pt-4 border-t border-white/10 gap-3">
                      <Button variant="secondary" onClick={() => setShowEditModal(false)}>Abbrechen</Button>
                      <Button onClick={executeSave} disabled={isSubmitting || isUploading} className="bg-emerald-600 hover:bg-emerald-500">
                        {isSubmitting ? <Loader2 className="animate-spin"/> : 'Speichern'}
                      </Button>
                  </div>
              </GlassCard>
           </div>
      )}
    </div>
  );
};

export default Machines;
