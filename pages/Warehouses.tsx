
import React, { useEffect, useState } from 'react';
import { GlassCard, Button, GlassInput } from '../src/components/UIComponents';
import { supabase } from '../supabaseClient';
import { Warehouse, WarehouseType } from '../types';
import { Warehouse as WarehouseIcon, Truck, HardHat, Plus, Edit2, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';

const Warehouses: React.FC = () => {
  const navigate = useNavigate();
  // Change: Use updateWarehousePreference from context instead of local logic
  const { profile } = useAuth();
  const { updateWarehousePreference } = useUserPreferences();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Data States
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [warehouseForm, setWarehouseForm] = useState({ name: '', type: 'Main' as WarehouseType, location: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('warehouses').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setWarehouses(data.map((item: any) => ({ id: item.id, name: item.name, type: item.type, location: item.location, itemsCount: item.items_count })));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // --- CRUD HANDLERS ---
  const handleOpenCreate = () => {
    setEditingId(null);
    setWarehouseForm({ name: '', type: 'Main', location: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingId(item.id);
    setWarehouseForm({ name: item.name, type: item.type, location: item.location || '' });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Lager "${name}" wirklich löschen?`)) {
      confirmDelete(id);
    }
  };

  const confirmDelete = async (id: string) => {
    await supabase.from('warehouses').delete().eq('id', id);
    setWarehouses(prev => prev.filter(w => w.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) await supabase.from('warehouses').update(warehouseForm).eq('id', editingId);
      else await supabase.from('warehouses').insert({ ...warehouseForm, items_count: 0 });

      await fetchData();
      setIsModalOpen(false);
    } catch (err: any) { alert("Fehler: " + err.message); } finally { setSubmitting(false); }
  };

  const getIcon = (type: WarehouseType) => {
    if (type === 'Main') return <WarehouseIcon size={24} className="text-emerald-400" />;
    if (type === 'Vehicle') return <Truck size={24} className="text-blue-400" />;
    return <HardHat size={24} className="text-amber-400" />;
  };

  const warehouseTypes = [
    { id: 'Main', label: 'Hauptlager', icon: WarehouseIcon },
    { id: 'Vehicle', label: 'Fahrzeug', icon: Truck },
    { id: 'Site', label: 'Baustelle', icon: HardHat },
  ];

  return (
    <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-24 px-1">
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <button onClick={() => navigate('/dashboard')} className="text-sm text-white/50 hover:text-white mb-2">← Dashboard</button>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-200">Lagerorte</h1>
        </div>
        <Button icon={<Plus size={18} />} onClick={handleOpenCreate}>Neu</Button>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {warehouses.map((warehouse) => (
          <GlassCard key={warehouse.id} className="relative group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">{getIcon(warehouse.type)}</div>
              <div className="flex-1"><h3 className="text-white font-bold">{warehouse.name}</h3></div>
              <div className="flex gap-2">
                <button onClick={() => handleOpenEdit(warehouse)} className="p-2 bg-white/5 rounded-lg text-white/60 hover:text-white"><Edit2 size={16} /></button>
                <button onClick={() => handleDelete(warehouse.id, warehouse.name)} className="p-2 bg-white/5 rounded-lg text-white/60 hover:text-rose-400"><Trash2 size={16} /></button>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => updateWarehousePreference('primary', warehouse.id)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${profile?.primary_warehouse_id === warehouse.id ? 'bg-emerald-500 text-white border-emerald-500 font-bold shadow-lg shadow-emerald-500/20' : 'text-white/50 border-white/10 hover:bg-white/10'}`}
              >
                {profile?.primary_warehouse_id === warehouse.id ? '✓ Primär' : 'Primär'}
              </button>
              <button
                onClick={() => updateWarehousePreference('secondary', warehouse.id)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${profile?.secondary_warehouse_id === warehouse.id ? 'bg-blue-500 text-white border-blue-500 font-bold shadow-lg shadow-blue-500/20' : 'text-white/50 border-white/10 hover:bg-white/10'}`}
              >
                {profile?.secondary_warehouse_id === warehouse.id ? '✓ Sekundär' : 'Sekundär'}
              </button>
            </div>
          </GlassCard>
        ))}
        {warehouses.length === 0 && <div className="text-center text-white/30 py-8">Keine Lagerorte angelegt.</div>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95">
          <GlassCard className="w-full max-w-lg" title={editingId ? "Lager bearbeiten" : "Neuer Lager"}>
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-white/50"><X size={20} /></button>
            <form onSubmit={handleSubmit} className="space-y-5 mt-2">
              <div>
                <label className="block text-sm text-white/60 mb-1">Name</label>
                <GlassInput value={warehouseForm.name} onChange={e => setWarehouseForm({ ...warehouseForm, name: e.target.value })} required />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Typ</label>
                <div className="grid grid-cols-3 gap-3">
                  {warehouseTypes.map((t) => {
                    const isActive = warehouseForm.type === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setWarehouseForm({ ...warehouseForm, type: t.id as WarehouseType })}
                        className={`flex flex-col items-center justify-center gap-2 py-3 rounded-xl border transition-all ${isActive ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'}`}
                      >
                        <t.icon size={20} />
                        <span className="text-xs font-medium">{t.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1">Standort / Kennzeichen</label>
                <GlassInput value={warehouseForm.location} onChange={e => setWarehouseForm({ ...warehouseForm, location: e.target.value })} />
              </div>

              <div className="pt-4 flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsModalOpen(false)}>Abbrechen</Button>
                <Button type="submit" className="flex-1" disabled={submitting}>Speichern</Button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default Warehouses;
