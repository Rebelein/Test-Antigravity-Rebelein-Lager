import React, { useEffect, useState } from 'react';
import { GlassCard, Button, GlassInput } from '../src/components/UIComponents';
import { supabase } from '../supabaseClient';
import { Supplier } from '../types';
import { Factory, Plus, Edit2, Trash2, FileText, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Suppliers: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Data States
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', customer_number: '', contact_email: '', website: '', csv_format: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('suppliers').select('*').order('name', { ascending: true });
      if (error) throw error;
      if (data) setSuppliers(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // --- CRUD HANDLERS ---
  const handleOpenCreate = () => {
    setEditingId(null);
    setSupplierForm({ name: '', customer_number: '', contact_email: '', website: '', csv_format: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingId(item.id);
    setSupplierForm({
      name: item.name,
      customer_number: item.customer_number || '',
      contact_email: item.contact_email || '',
      website: item.website || '',
      csv_format: item.csv_format || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Lieferant "${name}" wirklich löschen?`)) {
      confirmDelete(id);
    }
  };

  const confirmDelete = async (id: string) => {
    await supabase.from('suppliers').delete().eq('id', id);
    setSuppliers(prev => prev.filter(s => s.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) await supabase.from('suppliers').update(supplierForm).eq('id', editingId);
      else await supabase.from('suppliers').insert(supplierForm);

      await fetchData();
      setIsModalOpen(false);
    } catch (err: any) { alert("Fehler: " + err.message); } finally { setSubmitting(false); }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-24 px-1">
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <button onClick={() => navigate('/dashboard')} className="text-sm text-white/50 hover:text-white mb-2">← Dashboard</button>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-300">Lieferanten</h1>
        </div>
        <Button icon={<Plus size={18} />} onClick={handleOpenCreate}>Neu</Button>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {suppliers.map((supplier) => (
          <GlassCard key={supplier.id} className="relative group">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-purple-500/10 border border-purple-500/20 text-purple-300"><Factory size={24} /></div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white truncate">{supplier.name}</h3>
                <div className="flex flex-wrap gap-4 text-sm text-white/50 mt-1">
                  {supplier.customer_number && <span>KD-Nr: {supplier.customer_number}</span>}
                  {supplier.csv_format && <div className="flex items-center gap-1 text-emerald-400"><FileText size={12} /> CSV Vorlage aktiv</div>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleOpenEdit(supplier)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"><Edit2 size={16} /></button>
                <button onClick={() => handleDelete(supplier.id, supplier.name)} className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-300"><Trash2 size={16} /></button>
              </div>
            </div>
          </GlassCard>
        ))}
        {suppliers.length === 0 && <div className="text-center text-white/30 py-8">Keine Lieferanten angelegt.</div>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <GlassCard className="w-full max-w-lg" title={editingId ? "Lieferant bearbeiten" : "Neuer Lieferant"}>
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-white/50"><X size={20} /></button>
            <form onSubmit={handleSubmit} className="space-y-5 mt-2">
              <div><label className="block text-sm text-white/60 mb-1">Firmenname</label><GlassInput value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} required /></div>
              <div><label className="block text-sm text-white/60 mb-1">Kundennummer</label><GlassInput value={supplierForm.customer_number} onChange={e => setSupplierForm({ ...supplierForm, customer_number: e.target.value })} /></div>
              <div className="pt-4 border-t border-white/10">
                <label className="block text-sm font-medium text-emerald-400 mb-1 flex items-center gap-2"><FileText size={14} /> CSV Export Vorlage</label>
                <p className="text-[10px] text-white/50 mb-2">Definiere das Zeilenformat für den Export. Platzhalter: <code>&#123;&#123;sku&#125;&#125;</code>, <code>&#123;&#123;amount&#125;&#125;</code>, <code>&#123;&#123;name&#125;&#125;</code>.</p>
                <textarea
                  className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Beispiel: {{sku}};{{amount}}"
                  value={supplierForm.csv_format}
                  onChange={e => setSupplierForm({ ...supplierForm, csv_format: e.target.value })}
                />
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

export default Suppliers;