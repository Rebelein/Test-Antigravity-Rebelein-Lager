import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, GlassInput, GlassModal } from '../../components/UIComponents';
import { Key } from '../../../types';
import { supabase } from '../../../supabaseClient';
import { KeyModal, KeyHandoverModal } from '../../features/keys/components/KeyComponents';
import { CategoryManagerModal } from '../../features/keys/components/CategoryManagerModal';
import { Search, Plus, Key as KeyIcon, User, MapPin, Printer, RefreshCw, Tag, ChevronDown, Trash2, Edit, ChevronRight, Layers, Filter, Menu, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { toast } from 'sonner';
import { useReactToPrint } from 'react-to-print';
import { KeyExportTemplate } from '../../features/keys/components/KeyExportTemplate';
import { MasterDetailLayout } from '../../components/MasterDetailLayout';
import { KeyDetailContent } from '../../features/keys/components/KeyDetailContent';

const KeyCard: React.FC<{
    keyData: Key;
    onClick: (key: Key) => void;
    onEdit: (key: Key) => void;
    onDelete: (key: Key) => void;
}> = ({ keyData, onClick, onEdit, onDelete }) => (
    <div
        onClick={() => onClick(keyData)}
        className={`relative group rounded-xl border p-3 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col h-full ${keyData.status === 'InUse'
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

        <div className="flex flex-col gap-1 pl-2 mb-3 mt-1 flex-1">
            {keyData.owner && (
                <div className="text-[11px] text-white/60 truncate flex items-center gap-1.5" title={`Eigentümer: ${keyData.owner}`}>
                    <User size={10} className="shrink-0 text-white/40" /> {keyData.owner}
                </div>
            )}
            {keyData.address && (
                <div className="text-[11px] text-white/60 truncate flex items-center gap-1.5" title={`Adresse: ${keyData.address}`}>
                    <MapPin size={10} className="shrink-0 text-white/40" /> {keyData.address}
                </div>
            )}
        </div>

        {keyData.status === 'InUse' ? (
            <div className="text-xs text-amber-200/60 pl-2 truncate flex items-center gap-1 mt-auto bg-amber-500/10 -mx-3 -mb-3 p-2 pt-2.5 mt-2">
                <User size={12} className="shrink-0" /> <span className="font-medium">{keyData.holder_name || 'Unbekannt'}</span>
            </div>
        ) : (
            <div className="text-xs text-emerald-400/60 pl-2 truncate mt-auto bg-emerald-500/5 -mx-3 -mb-3 p-2 pt-2.5 mt-2 flex items-center gap-1">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span> Verfügbar
                 {keyData.holder_name && <span className="text-[10px] text-white/40 ml-1 truncate">(Zuletzt: {keyData.holder_name})</span>}
            </div>
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
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [isMobileCategoryOpen, setIsMobileCategoryOpen] = useState(false);
    const isMobile = useIsMobile();
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

    // Filter
    const filteredKeys = React.useMemo(() => keys.filter(k => {
        const matchesSearch = k.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            k.slot_number.toString().includes(searchTerm) ||
            (k.holder_name && k.holder_name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (!matchesSearch) return false;
        if (activeTab === 'available' && k.status !== 'Available') return false;
        if (activeTab === 'inUse' && k.status !== 'InUse') return false;

        if (selectedCategory === 'uncategorized') {
             if (k.category_id) return false;
        } else if (selectedCategory) {
             if (k.category_id !== selectedCategory) return false;
        }

        return true;
    }), [keys, searchTerm, activeTab, selectedCategory]);

    const handleCreate = () => { setEditingKey(null); setIsEditModalOpen(true); };
    const handleEdit = (key: Key) => { setEditingKey(key); setIsEditModalOpen(true); };
    const handleDelete = async (key: Key) => {
        if (!confirm(`Schlüssel #${key.slot_number} "${key.name}" löschen?`)) return;
        await supabase.from('keys').delete().eq('id', key.id);
        if (selectedKey?.id === key.id) setSelectedKey(null);
    };

    const CategorySidebar = () => (
        <div className="flex flex-col gap-1 py-2 h-full overflow-y-auto custom-scrollbar pr-2">
            <button
                onClick={() => { setSelectedCategory(null); setIsMobileCategoryOpen(false); }}
                className={clsx(
                    "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 text-left",
                    !selectedCategory ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10" : "text-white/60 hover:text-white hover:bg-white/5"
                )}
            >
                <div className="flex items-center gap-3">
                    <Layers size={18} />
                    <span className="font-medium text-sm">Alle Kategorien</span>
                </div>
                {!selectedCategory && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
            </button>
            <div className="h-px bg-white/5 my-2 mx-4" />
            {categories.map(cat => {
                const count = keys.filter(k => k.category_id === cat.id).length;
                if (count === 0) return null;
                return (
                <button
                    key={cat.id}
                    onClick={() => { setSelectedCategory(cat.id); setIsMobileCategoryOpen(false); }}
                    className={clsx(
                        "flex items-start px-4 py-2.5 rounded-xl transition-all duration-200 text-left group w-full gap-3",
                        selectedCategory === cat.id ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-white/50 hover:text-white hover:bg-white/5"
                    )}
                >
                    <ChevronRight size={14} className={clsx("transition-transform shrink-0 mt-1", selectedCategory === cat.id ? "rotate-90 text-emerald-400" : "text-white/20 group-hover:text-white/40")} />
                    <div className="w-3 h-3 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: cat.color, boxShadow: `0 0 10px ${cat.color}` }}></div>
                    <span className="text-sm font-medium flex-1 break-words leading-tight mt-0.5">{cat.name}</span>
                    <span className="bg-white/10 text-white/50 text-[10px] px-1.5 py-0.5 rounded-full shrink-0 mt-0.5">{count}</span>
                </button>
            )})}
            
            {/* Ohne Kategorie */}
            {(() => {
                const count = keys.filter(k => !k.category_id).length;
                if (count === 0) return null;
                return (
                <button
                    onClick={() => { setSelectedCategory('uncategorized'); setIsMobileCategoryOpen(false); }}
                    className={clsx(
                        "flex items-start px-4 py-2.5 mt-2 rounded-xl transition-all duration-200 text-left group w-full gap-3",
                        selectedCategory === 'uncategorized' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-white/50 hover:text-white hover:bg-white/5"
                    )}
                >
                    <ChevronRight size={14} className={clsx("transition-transform shrink-0 mt-1", selectedCategory === 'uncategorized' ? "rotate-90 text-emerald-400" : "text-white/20 group-hover:text-white/40")} />
                    <div className="w-3 h-3 rounded-full border-2 border-white/20 shrink-0 mt-1.5"></div>
                    <span className="text-sm font-medium text-white/70 flex-1 break-words leading-tight mt-0.5">Ohne Kategorie</span>
                    <span className="bg-white/10 text-white/50 text-[10px] px-1.5 py-0.5 rounded-full shrink-0 mt-0.5">{count}</span>
                </button>
            )})()}
        </div>
    );

    const renderListContent = () => (
        <div className="relative h-full flex flex-col overflow-hidden">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1 pt-4 pb-4 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-3">
                    {isMobile && (
                        <button 
                            onClick={() => setIsMobileCategoryOpen(true)}
                            className="p-2.5 rounded-xl bg-white/5 text-emerald-400 border border-white/10 active:scale-95 transition-transform"
                        >
                            <Menu size={20} />
                        </button>
                    )}
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-300">Schlüssel</h1>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setIsCategoryModalOpen(true)} variant="secondary" icon={<Tag size={18} />} />
                    <Button onClick={handlePrint} variant="secondary" icon={<Printer size={18} />} />
                    <Button onClick={handleCreate} icon={<Plus size={18} />}>Neu</Button>
                </div>
            </header>

            <div className="flex h-full overflow-hidden mt-2">
                {/* Desktop Sidebar */}
                {!isMobile && (
                    <aside className="w-64 flex-shrink-0 border-r border-white/5 flex flex-col pr-4 animate-in slide-in-from-left duration-500">
                        <div className="px-4 py-2 flex items-center gap-2 text-white/30 uppercase tracking-widest text-[10px] font-bold">
                            <Filter size={10} />
                            Kategorien
                        </div>
                        <CategorySidebar />
                    </aside>
                )}

                {/* Mobile Sidebar Overlay */}
                <AnimatePresence>
                    {isMobile && isMobileCategoryOpen && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsMobileCategoryOpen(false)}
                                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                            />
                            <motion.aside
                                initial={{ x: '-100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '-100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="fixed inset-y-0 left-0 w-[80%] max-w-sm bg-gray-900 border-r border-white/10 shadow-2xl z-50 flex flex-col"
                            >
                                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-sm">
                                        <Filter size={16} /> Kategorien
                                    </div>
                                    <button onClick={() => setIsMobileCategoryOpen(false)} className="p-2 rounded-xl bg-white/5 text-white/50 hover:text-white">
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="p-2 flex-1 overflow-hidden">
                                    <CategorySidebar />
                                </div>
                            </motion.aside>
                        </>
                    )}
                </AnimatePresence>

                <div className="flex-1 h-full overflow-hidden flex flex-col lg:pl-4">
                    {/* Stats / Tabs */}
                    <div className="flex gap-2 p-1 bg-black/20 rounded-xl border border-white/5 mb-4 shrink-0">
                        <button onClick={() => { setActiveTab('all'); setSelectedCategory(null); }} className={`flex-1 py-2 rounded-lg text-sm font-medium ${activeTab === 'all' ? 'bg-white/10 text-white' : 'text-white/50'}`}>Gesamt <span className="text-[10px] bg-white/10 px-1 rounded">{keys.length}</span></button>
                        <button onClick={() => { setActiveTab('available'); setSelectedCategory(null); }} className={`flex-1 py-2 rounded-lg text-sm font-medium ${activeTab === 'available' ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/50'}`}>Verfügbar <span className="text-[10px] bg-white/10 px-1 rounded">{keys.filter(k => k.status === 'Available').length}</span></button>
                        <button onClick={() => { setActiveTab('inUse'); setSelectedCategory(null); }} className={`flex-1 py-2 rounded-lg text-sm font-medium ${activeTab === 'inUse' ? 'bg-amber-500/20 text-amber-300' : 'text-white/50'}`}>Ausgegeben <span className="text-[10px] bg-white/10 px-1 rounded">{keys.filter(k => k.status === 'InUse').length}</span></button>
                    </div>

                    {/* Search */}
                    <div className="relative mb-4 shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                        <input className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors" placeholder="Suche..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pb-24 pr-2">
                        {filteredKeys.length === 0 ? (
                            <div className="text-center py-10 text-white/30 flex flex-col items-center justify-center h-full gap-4">
                                <KeyIcon size={48} className="opacity-20" />
                                Keine Schlüssel in dieser Ansicht gefunden.
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {filteredKeys.map(k => <KeyCard key={k.id} keyData={k} onClick={setSelectedKey} onEdit={handleEdit} onDelete={handleDelete} />)}
                            </div>
                        )}
                    </div>
                </div>
            </div>

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
