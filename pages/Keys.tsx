import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, GlassInput, GlassModal } from '../src/components/UIComponents';
import { Key } from '../types';
import { supabase } from '../supabaseClient';
import { KeyModal, KeyHandoverModal } from '../src/features/keys/components/KeyComponents';
import { CategoryManagerModal } from '../src/features/keys/components/CategoryManagerModal';
import { Search, Plus, Key as KeyIcon, User, MapPin, Printer, RefreshCw, Tag, ChevronDown, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { useReactToPrint } from 'react-to-print';
import { KeyExportTemplate } from '../src/features/keys/components/KeyExportTemplate';
import { MasterDetailLayout } from '../src/components/MasterDetailLayout';
import { KeyDetailContent } from '../src/features/keys/components/KeyDetailContent';

const KeyCard: React.FC<{
    keyData: Key;
    onClick: (key: Key) => void;
    onEdit: (key: Key) => void;
    onDelete: (key: Key) => void;
}> = ({ keyData, onClick, onEdit, onDelete }) => (
    <div
        onClick={() => onClick(keyData)}
        className={`relative group rounded-xl border p-3 transition-all duration-300 cursor-pointer overflow-hidden ${keyData.status === 'InUse'
            ? 'bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40'
            : 'bg-white/5 border-white/10 hover:border-emerald-500/30 hover:bg-white/10'
            }`}
    >
        {/* Category Strip */}
        {/* @ts-ignore */}
        {keyData.key_categories && (
            <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                /* @ts-ignore */
                style={{ backgroundColor: keyData.key_categories.color }}
            ></div>
        )}

        <div className="flex justify-between items-start mb-2 pl-2">
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${keyData.status === 'InUse' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                #{keyData.slot_number}
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); onEdit(keyData); }} className="p-1 hover:bg-white/10 rounded">
                    <Edit size={12} className="text-gray-400" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(keyData); }} className="p-1 hover:bg-white/10 rounded">
                    <Trash2 size={12} className="text-red-400" />
                </button>
            </div>
        </div>

        <h3 className="font-bold text-white text-sm mb-1 truncate pl-2" title={keyData.name}>{keyData.name}</h3>

        {keyData.status === 'InUse' ? (
            <div className="text-xs text-amber-200/60 pl-2 truncate flex items-center gap-1">
                <User size={10} /> {keyData.holder_name || 'Unbekannt'}
            </div>
        ) : (
            <div className="text-xs text-emerald-400/60 pl-2 truncate">Verfügbar</div>
        )}
    </div>
);

const Keys: React.FC = () => {
    const [keys, setKeys] = useState<Key[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // State
    const [selectedKey, setSelectedKey] = useState<Key | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingKey, setEditingKey] = useState<Key | null>(null);

    // Categories
    const [categories, setCategories] = useState<any[]>([]);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'all' | 'available' | 'inUse'>('all');

    // Print
    const printComponentRef = React.useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printComponentRef,
        documentTitle: `Schluessel_Export_${new Date().toISOString().split('T')[0]}`,
    });

    useEffect(() => {
        fetchKeys();
        fetchCategories();

        const subscription = supabase.channel('keys_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'keys' }, () => fetchKeys())
            .subscribe();
        return () => { subscription.unsubscribe(); };
    }, []);

    const fetchKeys = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('keys').select('*, key_categories(id, name, color)').order('slot_number', { ascending: true });
            if (error) throw error;
            // @ts-ignore
            setKeys(data || []);
            // Update selected key if exists
            if (selectedKey) {
                // @ts-ignore
                const updated = data?.find(k => k.id === selectedKey.id);
                if (updated) setSelectedKey(updated);
            }
        } catch (error: any) { toast.error('Fehler: ' + error.message); } finally { setLoading(false); }
    };

    const fetchCategories = async () => {
        const { data } = await supabase.from('key_categories').select('*').order('name');
        if (data) setCategories(data);
    };

    const toggleCategory = (id: string) => {
        setExpandedCategories(prev => prev.includes(id) ? prev.filter(catId => catId !== id) : [...prev, id]);
    };

    // Filter
    const filteredKeys = React.useMemo(() => keys.filter(k => {
        const matchesSearch = k.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            k.slot_number.toString().includes(searchTerm) ||
            (k.holder_name && k.holder_name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (!matchesSearch) return false;
        if (activeTab === 'available') return k.status === 'Available';
        if (activeTab === 'inUse') return k.status === 'InUse';
        return true;
    }), [keys, searchTerm, activeTab]);

    const handleCreate = () => { setEditingKey(null); setIsEditModalOpen(true); };
    const handleEdit = (key: Key) => { setEditingKey(key); setIsEditModalOpen(true); };
    const handleDelete = async (key: Key) => {
        if (!confirm(`Schlüssel #${key.slot_number} "${key.name}" löschen?`)) return;
        await supabase.from('keys').delete().eq('id', key.id);
        if (selectedKey?.id === key.id) setSelectedKey(null);
    };

    const renderListContent = () => (
        <div className="space-y-6 pb-24 h-full overflow-y-auto pr-2">
            <header className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-300">Schlüssel</h1>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setIsCategoryModalOpen(true)} variant="secondary" icon={<Tag size={18} />} />
                    <Button onClick={handlePrint} variant="secondary" icon={<Printer size={18} />} />
                    <Button onClick={handleCreate} icon={<Plus size={18} />}>Neu</Button>
                </div>
            </header>

            {/* Stats / Tabs */}
            <div className="flex gap-2 p-1 bg-black/20 rounded-xl border border-white/5 mb-4">
                <button onClick={() => setActiveTab('all')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${activeTab === 'all' ? 'bg-white/10 text-white' : 'text-white/50'}`}>Gesamt <span className="text-[10px] bg-white/10 px-1 rounded">{keys.length}</span></button>
                <button onClick={() => setActiveTab('available')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${activeTab === 'available' ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/50'}`}>Verfügbar <span className="text-[10px] bg-white/10 px-1 rounded">{keys.filter(k => k.status === 'Available').length}</span></button>
                <button onClick={() => setActiveTab('inUse')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${activeTab === 'inUse' ? 'bg-amber-500/20 text-amber-300' : 'text-white/50'}`}>Ausgegeben <span className="text-[10px] bg-white/10 px-1 rounded">{keys.filter(k => k.status === 'InUse').length}</span></button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                <input className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors" placeholder="Suche..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>

            <div className="space-y-4">
                {/* Categories */}
                {categories.map(cat => {
                    const catKeys = filteredKeys.filter(k => k.category_id === cat.id);
                    if (catKeys.length === 0) return null;
                    const isExpanded = expandedCategories.includes(cat.id);
                    return (
                        <div key={cat.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                            <button onClick={() => toggleCategory(cat.id)} className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color, boxShadow: `0 0 10px ${cat.color}` }}></div>
                                    <span className="font-bold text-white text-sm">{cat.name}</span>
                                    <span className="bg-white/10 text-white/50 text-xs px-2 py-0.5 rounded-full">{catKeys.length}</span>
                                </div>
                                <ChevronDown className={`text-white/50 transition-transform ${isExpanded ? 'rotate-180' : ''}`} size={16} />
                            </button>
                            {isExpanded && (
                                <div className="p-3 border-t border-white/5 grid grid-cols-2 lg:grid-cols-3 gap-2">
                                    {catKeys.map(k => <KeyCard key={k.id} keyData={k} onClick={setSelectedKey} onEdit={handleEdit} onDelete={handleDelete} />)}
                                </div>
                            )}
                        </div>
                    )
                })}

                {/* Uncategorized */}
                {(() => {
                    const uncategorized = filteredKeys.filter(k => !k.category_id);
                    if (uncategorized.length === 0) return null;
                    const isExpanded = expandedCategories.includes('uncategorized');
                    return (
                        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                            <button onClick={() => toggleCategory('uncategorized')} className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full border-2 border-white/20"></div>
                                    <span className="font-bold text-white/70 text-sm">Ohne Kategorie</span>
                                    <span className="bg-white/10 text-white/50 text-xs px-2 py-0.5 rounded-full">{uncategorized.length}</span>
                                </div>
                                <ChevronDown className={`text-white/50 transition-transform ${isExpanded ? 'rotate-180' : ''}`} size={16} />
                            </button>
                            {isExpanded && (
                                <div className="p-3 border-t border-white/5 grid grid-cols-2 lg:grid-cols-3 gap-2">
                                    {uncategorized.map(k => <KeyCard key={k.id} keyData={k} onClick={setSelectedKey} onEdit={handleEdit} onDelete={handleDelete} />)}
                                </div>
                            )}
                        </div>
                    )
                })()}
            </div>
            {filteredKeys.length === 0 && <div className="text-center py-10 text-white/30">Keine Schlüssel gefunden</div>}

            {/* Hidden Print */}
            <div style={{ display: 'none' }}><KeyExportTemplate ref={printComponentRef} keys={keys} categories={categories} /></div>
        </div>
    );

    return (
        <MasterDetailLayout
            title="Schlüsselkasten"
            isOpen={!!selectedKey}
            onClose={() => setSelectedKey(null)}
            listContent={renderListContent()}
            detailContent={selectedKey ? <KeyDetailContent keyData={selectedKey} onClose={() => setSelectedKey(null)} onUpdate={fetchKeys} /> : null}
        >
            <KeyModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSave={fetchKeys} editingKey={editingKey} nextSlotNumber={keys.length > 0 ? Math.max(...keys.map(k => k.slot_number)) + 1 : 1} categories={categories} />
            <CategoryManagerModal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} onUpdate={() => { fetchKeys(); fetchCategories(); }} />
        </MasterDetailLayout>
    );
};

export default Keys;
