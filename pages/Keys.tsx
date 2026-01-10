import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, Button, GlassInput, PageHeader, GlassModal } from '../components/UIComponents';
import { Key } from '../types';
import { supabase } from '../supabaseClient';
import { KeyModal, KeyHandoverModal, KeyDetailsModal } from '../components/KeyComponents';
import { CategoryManagerModal } from '../components/CategoryManagerModal';
import { Search, Plus, Key as KeyIcon, User, MapPin, AlertCircle, RefreshCw, MoreVertical, Trash2, Edit, Tag, ChevronDown, Info, Printer } from 'lucide-react';
import { toast } from 'sonner';

import { useReactToPrint } from 'react-to-print';
import { KeyExportTemplate } from '../components/KeyExportTemplate';
// ... existing imports ...

// Extracted Component
const KeyCard: React.FC<{
    keyData: Key;
    onOpenDetails: (key: Key) => void;
    onEdit: (key: Key) => void;
    onConfirmDelete: (key: Key) => void;
    onHandover: (key: Key, type: 'issue' | 'return') => void;
}> = ({ keyData, onOpenDetails, onEdit, onConfirmDelete, onHandover }) => (
    <motion.div
        key={keyData.id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`relative group rounded-xl border p-4 transition-all duration-300 cursor-pointer overflow-hidden ${keyData.status === 'InUse'
            ? 'bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40'
            : 'bg-white/5 border-white/10 hover:border-emerald-500/30 hover:bg-white/10'
            }`}
        onClick={(e) => {
            // @ts-ignore
            if (e.target.closest('button')) return;
            onOpenDetails(keyData);
        }}
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

        <div className="flex justify-between items-start mb-3 pl-2">
            <div className={`px-2 py-1 rounded text-xs font-bold ${keyData.status === 'InUse' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'
                }`}>
                Platz {keyData.slot_number}
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(keyData)} className="p-1 hover:bg-white/10 rounded">
                    <Edit size={14} className="text-gray-400" />
                </button>
                <button onClick={() => onConfirmDelete(keyData)} className="p-1 hover:bg-white/10 rounded">
                    <Trash2 size={14} className="text-red-400" />
                </button>
            </div>
        </div>

        <h3 className="font-bold text-white text-lg mb-1 truncate" title={keyData.name}>{keyData.name}</h3>
        {keyData.address && (
            <div className="flex items-center text-xs text-gray-400 mb-4 truncate">
                <MapPin size={12} className="mr-1 flex-shrink-0" />
                <span className="truncate">{keyData.address}</span>
            </div>
        )}

        {keyData.status === 'InUse' ? (
            <div className="mb-4 bg-black/40 rounded p-2 text-xs space-y-2">
                <div className="flex items-start">
                    <User size={12} className="mr-2 mt-0.5 text-amber-500 shrink-0" />
                    <div>
                        <span className="text-gray-500 block text-[10px] uppercase tracking-wider">Ausgegeben an</span>
                        <span className="text-amber-200 font-medium">{keyData.holder_name || 'Unbekannt'}</span>
                    </div>
                </div>
            </div>
        ) : (
            <div className="mb-4 bg-white/5 rounded p-2 text-xs flex items-center justify-center text-emerald-500/50 font-medium tracking-wide">
                VERFÜGBAR
            </div>
        )}

        {/* Owner & Notes Info Block */}
        <div className="space-y-2 mb-4 text-xs border-t border-white/5 pt-3">
            {keyData.owner && (
                <div className="flex items-start text-gray-400">
                    <User size={12} className="mr-2 mt-0.5 shrink-0" />
                    <div>
                        <span className="block text-[10px] uppercase text-gray-600 tracking-wider">Eigentümer</span>
                        <span className="text-gray-300">{keyData.owner}</span>
                    </div>
                </div>
            )}
            {keyData.notes && (
                <div className="flex items-start text-gray-500 italic bg-white/5 p-2 rounded">
                    <span className="line-clamp-2">"{keyData.notes}"</span>
                </div>
            )}
        </div>

        <Button
            className="w-full"
            variant={keyData.status === 'InUse' ? 'secondary' : 'primary'}
            onClick={() => onHandover(keyData, keyData.status === 'InUse' ? 'return' : 'issue')}
        >
            {keyData.status === 'InUse' ? 'Rücknahme' : 'Ausgeben'}
        </Button>

    </motion.div>
);

const Keys: React.FC = () => {
    const [keys, setKeys] = useState<Key[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modals state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingKey, setEditingKey] = useState<Key | null>(null);

    // Details Modal
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedKeyForDetails, setSelectedKeyForDetails] = useState<Key | null>(null);

    const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
    const [selectedKeysForHandover, setSelectedKeysForHandover] = useState<Key[]>([]);
    const [handoverType, setHandoverType] = useState<'issue' | 'return'>('issue');
    const [activeTab, setActiveTab] = useState<'all' | 'available' | 'inUse'>('all');

    // Categories
    const [categories, setCategories] = useState<any[]>([]);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

    // Delete Confirmation State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [keyToDelete, setKeyToDelete] = useState<Key | null>(null);

    // Print Hook
    const printComponentRef = React.useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printComponentRef,
        documentTitle: `Schluessel_Export_${new Date().toISOString().split('T')[0]}`,
    });

    const handleOpenDetails = (key: Key) => {
        setSelectedKeyForDetails(key);
        setIsDetailsModalOpen(true);
    };

    // Fetch Keys
    const fetchKeys = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('keys')
                .select('*, key_categories(id, name, color)') // Join categories
                .order('slot_number', { ascending: true });

            if (error) throw error;
            // @ts-ignore
            setKeys(data || []);
        } catch (error: any) {
            toast.error('Fehler beim Laden: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        const { data } = await supabase.from('key_categories').select('*').order('name');
        if (data) setCategories(data);
    };

    useEffect(() => {
        fetchKeys();
        fetchCategories();

        // Subscription for Realtime updates
        const subscription = supabase
            .channel('keys_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'keys' }, () => {
                fetchKeys();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Handlers
    const handleEdit = (key: Key) => {
        setEditingKey(key);
        setIsEditModalOpen(true);
    };

    const handleCreate = () => {
        setEditingKey(null);
        setIsEditModalOpen(true);
    };

    const confirmDelete = (key: Key) => {
        setKeyToDelete(key);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!keyToDelete) return;

        try {
            const { error } = await supabase.from('keys').delete().eq('id', keyToDelete.id);
            if (error) throw error;
            toast.success('Schlüssel gelöscht');
            // fetchKeys triggered by realtime
        } catch (error: any) {
            toast.error('Fehler: ' + error.message);
        } finally {
            setIsDeleteModalOpen(false);
            setKeyToDelete(null);
        }
    };

    const handleHandover = (key: Key, type: 'issue' | 'return') => {
        setSelectedKeysForHandover([key]);
        setHandoverType(type);
        setIsHandoverModalOpen(true);
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

    // Stats
    const totalKeys = keys.length;
    const availableKeys = keys.filter(k => k.status === 'Available').length;
    const inUseKeys = keys.filter(k => k.status === 'InUse').length;

    // Collapsible Categories Logic
    const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

    const toggleCategory = (id: string) => {
        setExpandedCategories(prev =>
            prev.includes(id) ? prev.filter(catId => catId !== id) : [...prev, id]
        );
    };



    return (
        <div className="space-y-6 pb-20">
            {/* Hidden Print Template */}
            <div style={{ display: 'none' }}>
                <KeyExportTemplate
                    ref={printComponentRef}
                    keys={keys}
                    categories={categories}
                />
            </div>

            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-300">
                        Schlüsselkasten
                    </h1>
                    <p className="text-white/50">Verwaltung und Ausgabe von Objektschlüsseln.</p>
                </div>
                <div className="flex gap-2 self-end sm:self-auto">
                    <Button onClick={handlePrint} variant="secondary" icon={<Printer size={18} />}>
                        <span className="hidden md:inline">Liste drucken</span>
                    </Button>
                    <Button onClick={() => setIsCategoryModalOpen(true)} variant="secondary" icon={<Tag size={18} />}>
                        <span className="hidden md:inline">Kategorien</span>
                    </Button>
                    <Button onClick={handleCreate} icon={<Plus size={18} />} className="bg-emerald-600 hover:bg-emerald-500">
                        <span className="hidden md:inline">Neuer Schlüssel</span>
                    </Button>
                </div>
            </header>

            {/* TABS */}
            <div className="flex gap-2 p-1 bg-black/20 rounded-xl border border-white/5 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'all' ? 'bg-white/10 text-white shadow' : 'text-white/50'}`}
                >
                    <KeyIcon size={16} /> Gesamt
                    <span className="bg-gray-700 text-white text-[10px] px-1.5 rounded-full">{totalKeys}</span>
                </button>

                <button
                    onClick={() => setActiveTab('available')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'available' ? 'bg-white/10 text-white shadow' : 'text-white/50'}`}
                >
                    <div className={`w-2 h-2 rounded-full ${activeTab === 'available' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-emerald-500/50'}`}></div>
                    Verfügbar
                    {availableKeys > 0 && <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 rounded-full border border-emerald-500/30">{availableKeys}</span>}
                </button>

                <button
                    onClick={() => setActiveTab('inUse')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'inUse' ? 'bg-white/10 text-white shadow' : 'text-white/50'}`}
                >
                    <div className={`w-2 h-2 rounded-full ${activeTab === 'inUse' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'bg-amber-500/50'}`}></div>
                    Ausgegeben
                    {inUseKeys > 0 && <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 rounded-full border border-amber-500/30">{inUseKeys}</span>}
                </button>
            </div>

            {/* Content */}
            <GlassCard className="p-0 overflow-hidden min-h-[500px]">
                {/* Toolbar */}
                <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Suchen nach Name, Platz, Besitzer..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all placeholder:text-gray-600"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={fetchKeys} variant="ghost">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>

                {/* Grouped Content */}
                <div className="p-4 space-y-4">
                    {/* Iterate Categories */}
                    {categories.map(cat => {
                        const catKeys = filteredKeys.filter(k => k.category_id === cat.id);
                        if (catKeys.length === 0) return null;

                        const isExpanded = expandedCategories.includes(cat.id);

                        return (
                            <div key={cat.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                                <button
                                    onClick={() => toggleCategory(cat.id)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-3 h-3 rounded-full shadow-[0_0_8px]"
                                            style={{ backgroundColor: cat.color, boxShadow: `0 0 10px ${cat.color}` }}
                                        ></div>
                                        <span className="font-bold text-white text-lg">{cat.name}</span>
                                        <span className="bg-white/10 text-white/50 text-xs px-2 py-0.5 rounded-full">{catKeys.length}</span>
                                    </div>
                                    <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                        <ChevronDown className="text-white/50" />
                                    </div>
                                </button>

                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <div className="p-4 pt-0 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                {catKeys.map(key => (
                                                    <KeyCard
                                                        key={key.id}
                                                        keyData={key}
                                                        onOpenDetails={handleOpenDetails}
                                                        onEdit={handleEdit}
                                                        onConfirmDelete={confirmDelete}
                                                        onHandover={handleHandover}
                                                    />
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}

                    {/* Uncategorized Keys */}
                    {(() => {
                        const uncategorizedKeys = filteredKeys.filter(k => !k.category_id);
                        if (uncategorizedKeys.length === 0) return null;

                        const isExpanded = expandedCategories.includes('uncategorized');

                        return (
                            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                                <button
                                    onClick={() => toggleCategory('uncategorized')}
                                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full border-2 border-white/20"></div>
                                        <span className="font-bold text-white/70 text-lg">Ohne Kategorie</span>
                                        <span className="bg-white/10 text-white/50 text-xs px-2 py-0.5 rounded-full">{uncategorizedKeys.length}</span>
                                    </div>
                                    <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                        <ChevronDown className="text-white/50" />
                                    </div>
                                </button>

                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <div className="p-4 pt-0 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                {uncategorizedKeys.map(key => (
                                                    <KeyCard
                                                        key={key.id}
                                                        keyData={key}
                                                        onOpenDetails={handleOpenDetails}
                                                        onEdit={handleEdit}
                                                        onConfirmDelete={confirmDelete}
                                                        onHandover={handleHandover}
                                                    />
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })()}
                </div>

                {filteredKeys.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                        <KeyIcon size={48} className="mb-4 opacity-20" />
                        <p>Keine Schlüssel gefunden</p>
                    </div>
                )}
            </GlassCard>

            {/* Modals */}
            <KeyDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                keyData={selectedKeyForDetails}
            />
            <KeyModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSave={fetchKeys}
                editingKey={editingKey}
                nextSlotNumber={keys.length > 0 ? Math.max(...keys.map(k => k.slot_number)) + 1 : 1}
                categories={categories}
            />

            <CategoryManagerModal
                isOpen={isCategoryModalOpen}
                onClose={() => setIsCategoryModalOpen(false)}
                onUpdate={() => { fetchKeys(); fetchCategories(); }}
            />

            <KeyHandoverModal
                isOpen={isHandoverModalOpen}
                onClose={() => setIsHandoverModalOpen(false)}
                onSave={fetchKeys}
                selectedKeys={selectedKeysForHandover}
                type={handoverType}
            />

            {/* Delete Confirmation Modal */}
            <GlassModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Löschen bestätigen">
                <div className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="bg-red-500/10 p-3 rounded-full">
                            <Trash2 size={24} className="text-red-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Schlüssel löschen?</h3>
                            <p className="text-gray-400 text-sm">Diese Aktion kann nicht rückgängig gemacht werden.</p>
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10 mb-6">
                        <div className="flex justify-between items-center">
                            <span className="text-emerald-400 font-mono">#{keyToDelete?.slot_number}</span>
                            <span className="text-white font-bold">{keyToDelete?.name}</span>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button onClick={() => setIsDeleteModalOpen(false)} variant="secondary">Abbrechen</Button>
                        <Button onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white">Löschen</Button>
                    </div>
                </div>
            </GlassModal>

        </div>
    );
};

export default Keys;
