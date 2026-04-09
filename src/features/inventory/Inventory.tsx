import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { usePersistentState } from '../../../hooks/usePersistentState';
import { supabase } from '../../../supabaseClient';
import { useInventoryData } from './hooks/useInventoryData';
import { Article } from '../../../types';
import { Button, GlassCard } from '../../components/UIComponents';
import { useAuth } from '../../../contexts/AuthContext';
import { useUserPreferences } from '../../../contexts/UserPreferencesContext';
import { Plus, ListChecks, CheckSquare, Loader2, Copy, Trash2, X, Check, Layers, Wand2, Menu, ChevronRight, Hash, Filter } from 'lucide-react';
import { InventoryToolbar } from './components/InventoryToolbar';
import { InventoryList } from './components/InventoryList';
import { MasterDetailLayout } from '../../components/MasterDetailLayout';
import { ArticleDetailContent } from './components/ArticleDetailContent';
import { ArticleEditForm } from './components/ArticleEditForm';
import { clsx } from 'clsx';

interface SortConfig {
    key: string;
    direction: 'asc' | 'desc';
}


const Inventory = () => {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const { loading: authLoading, user } = useAuth();
    const { primaryWarehouseId, secondaryWarehouseId, collapsedCategories, toggleCategoryCollapse } = useUserPreferences();

    // --- VIEW STATE ---
    const [viewMode, setViewMode] = useState<'primary' | 'secondary'>('primary');
    // Header Collapse State
    const [isHeaderExpanded, setIsHeaderExpanded] = useState(!isMobile);
    
    // --- CATEGORY SIDEBAR STATE ---
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [isMobileCategoryOpen, setIsMobileCategoryOpen] = useState(false);

    const {
        articles, warehouses, suppliers, loading,
        updateLocalArticle, removeLocalArticle
    } = useInventoryData(viewMode);

    // Mock orderDetails for now as it was removed from useInventoryData but used in UI
    const orderDetails: Record<string, { user: string }> = {};

    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    // Persistent Sort State (Default: Location Ascending)
    const [sortConfig, setSortConfig] = usePersistentState<SortConfig>('inventory-sort-v1', { key: 'location', direction: 'asc' });

    // --- SELECTION & ACTIONS ---
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(new Set());

    // --- MASTER-DETAIL STATE ---
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

    // --- MODAL STATES ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // Quick Actions
    const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);
    const [quickStockAmount, setQuickStockAmount] = useState(0);
    const [isBooking, setIsBooking] = useState(false);

    // Context Menu
    const [contextMenu, setContextMenu] = useState<{ id: string, x: number, y: number } | null>(null);

    // Delete Modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    // Copy Modal
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
    const [copyConfig, setCopyConfig] = useState({ targetWarehouseId: '', targetCategory: '', targetLocation: '', stock: 0, targetStock: 0 });
    const [isManualTargetCategory, setIsManualTargetCategory] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- CLIPBOARD ---
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const handleCopy = (text: string, field: string) => {
        if (!text || text === '-') return;
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // --- NAVIGATION LOGIC ---
    useEffect(() => {

    }, [articles]);

    // --- FILTERING & SORTING ---
    const currentWarehouseId = viewMode === 'primary' ? primaryWarehouseId : secondaryWarehouseId;
    const currentWarehouse = warehouses.find(w => w.id === currentWarehouseId);

    const filteredArticles = useMemo(() => {
        return articles.filter(article => {
            if (currentWarehouseId && article.warehouseId !== currentWarehouseId) return false;

            let matchesSearch = true;
            if (searchTerm) {
                const lowerTerm = searchTerm.toLowerCase();
                matchesSearch =
                    article.name.toLowerCase().includes(lowerTerm) ||
                    (article.sku || '').toLowerCase().includes(lowerTerm) ||
                    (article.ean || '').toLowerCase().includes(lowerTerm) ||
                    (article.supplierSku || '').toLowerCase().includes(lowerTerm) ||
                    (article.category || '').toLowerCase().includes(lowerTerm) ||
                    (article.manufacturerSkus && article.manufacturerSkus.some(s => s.sku.toLowerCase().includes(lowerTerm)));
            }

            let matchesFilter = true;
            if (activeFilter === 'low_stock') matchesFilter = article.stock < article.targetStock;
            if (activeFilter === 'on_order') matchesFilter = !!article.onOrderDate;
            if (activeFilter === 'no_stock') matchesFilter = article.stock === 0;

            // NEW: Category Filter
            let matchesCategory = true;
            if (selectedCategory) {
                matchesCategory = (article.category || 'Unkategorisiert') === selectedCategory;
            }

            return matchesSearch && matchesFilter && matchesCategory;
        });
    }, [articles, currentWarehouseId, searchTerm, activeFilter, selectedCategory]);

    const sortedArticles = useMemo(() => {
        return [...filteredArticles].sort((a, b) => {
            if (!sortConfig.key) return 0;
            let valA: any = a[sortConfig.key as keyof Article];
            let valB: any = b[sortConfig.key as keyof Article];

            if (sortConfig.key === 'stockLevel') {
                valA = a.stock / (a.targetStock || 1);
                valB = b.stock / (b.targetStock || 1);
            }

            // Use localeCompare for natural alphanumeric sorting (A1, A2, A10)
            if (typeof valA === 'string' && typeof valB === 'string') {
                const comparison = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
                return sortConfig.direction === 'asc' ? comparison : -comparison;
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredArticles, sortConfig]);

    const groupedArticles = useMemo(() => {
        return sortedArticles.reduce((acc, article) => {
            const cat = article.category || 'Unkategorisiert';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(article);
            return acc;
        }, {} as Record<string, Article[]>);
    }, [sortedArticles]);

    const distinctCategories = useMemo(() => {
        const cats = Array.from(new Set(articles.map(a => a.category || 'Unkategorisiert')))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        return cats;
    }, [articles]);

    // --- EVENT HANDLERS ---
    const handleWarehouseChange = (id: string) => {
        if (primaryWarehouseId === id) setViewMode('primary');
        else if (secondaryWarehouseId === id) setViewMode('secondary');
    };

    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedArticleIds(new Set());
    };

    const toggleArticleSelection = (id: string) => {
        const newSet = new Set(selectedArticleIds);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedArticleIds(newSet);
    };

    const toggleCategorySelection = (categoryArticles: Article[]) => {
        const categoryIds = categoryArticles.map(a => a.id);
        const allSelected = categoryIds.every(id => selectedArticleIds.has(id));
        const newSet = new Set(selectedArticleIds);
        if (allSelected) categoryIds.forEach(id => newSet.delete(id));
        else categoryIds.forEach(id => newSet.add(id));
        setSelectedArticleIds(newSet);
    };



    const handleQuickAddToCategory = (e: React.MouseEvent, category: string) => {
        e.stopPropagation();
        openNewArticleModal(category);
    };

    // --- DETAIL & EDIT ---
    const openDetail = (article: Article) => {
        setSelectedArticle(article);
    };

    const openNewArticleModal = (prefillCategory?: string) => {
        setIsEditMode(false);
        if (prefillCategory) {
            setSelectedArticle({ category: prefillCategory } as Article);
        } else {
            setSelectedArticle(null);
        }
        setIsEditModalOpen(true);
    };

    const openEditArticleModal = (article: Article) => {
        setIsEditMode(true);
        setSelectedArticle(article);
        setIsEditModalOpen(true);
    };

    const handleEditNavigate = (direction: 'prev' | 'next') => {
        if (!selectedArticle) return;
        const flatArticles = Object.values(groupedArticles).flat();
        const currentIndex = flatArticles.findIndex(a => a.id === selectedArticle.id);
        if (currentIndex === -1) return;

        const newIndex = direction === 'next'
            ? (currentIndex + 1) % flatArticles.length
            : (currentIndex - 1 + flatArticles.length) % flatArticles.length;

        setSelectedArticle(flatArticles[newIndex]);
    };

    // --- QUICK BOOKING LOGIC ---
    const handleCardClick = (article: Article) => {
        if (isSelectionMode) {
            toggleArticleSelection(article.id);
            return;
        }

        if (expandedArticleId === article.id) {
            setExpandedArticleId(null);
        } else {
            setExpandedArticleId(article.id);
            setQuickStockAmount(0); // Reset amount when opening
        }
    };

    // --- DELETE LOGIC ---
    const handleDeleteArticle = (id: string) => {
        setContextMenu(null);
        setDeleteTargetId(id);
        setShowDeleteModal(true);
    };

    const executeDelete = async () => {
        if (!deleteTargetId) return;
        try {
            const { error } = await supabase.from('articles').delete().eq('id', deleteTargetId);
            if (error) throw error;
            removeLocalArticle(deleteTargetId);
            setShowDeleteModal(false);
            setDeleteTargetId(null);
            if (selectedArticle?.id === deleteTargetId) setSelectedArticle(null);
        } catch (err: any) {
            alert("Fehler: " + err.message);
        }
    };

    // --- COPY LOGIC ---
    const handleOpenCopyModal = () => {
        if (selectedArticleIds.size === 0) return;
        setCopyConfig({ targetWarehouseId: '', targetCategory: '', targetLocation: '', stock: 0, targetStock: 0 });
        setIsCopyModalOpen(true);
    };

    const executeBulkCopy = async () => {
        if (!copyConfig.targetWarehouseId) return;
        setIsSubmitting(true);
        try {
            const targets = articles.filter(a => selectedArticleIds.has(a.id));

            for (const article of targets) {
                const newArticlePayload = {
                    name: article.name,
                    sku: article.sku,
                    ean: article.ean,
                    category: isManualTargetCategory ? copyConfig.targetCategory : copyConfig.targetCategory || article.category,
                    stock: copyConfig.stock,
                    target_stock: copyConfig.targetStock,
                    location: copyConfig.targetLocation,
                    supplier: article.supplier,
                    supplier_sku: article.supplierSku,
                    product_url: article.productUrl,
                    image_url: article.image,
                    warehouse_id: copyConfig.targetWarehouseId
                };
                const { error } = await supabase.from('articles').insert(newArticlePayload);
                if (error) throw error;
            }
            setIsCopyModalOpen(false);
            setSelectedArticleIds(new Set());
            setIsSelectionMode(false);
        } catch (e: any) {
            alert("Fehler beim Kopieren: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- SAVE HANDLER FOR MODAL ---
    const handleSaveFromModal = async (articleData: any, shouldClose: boolean) => {
        const targetWarehouseId = viewMode === 'primary' ? primaryWarehouseId : secondaryWarehouseId;
        if (!targetWarehouseId) throw new Error("Kein Lager gewählt");

        const payload = {
            name: articleData.name,
            sku: articleData.manufacturer_skus?.find((s: any) => s.isPreferred)?.sku || '',
            manufacturer_skus: articleData.manufacturer_skus,
            ean: articleData.ean,
            category: articleData.category || 'Sonstiges',
            stock: Number(articleData.stock),
            target_stock: Number(articleData.targetStock),
            location: articleData.location,
            supplier: articleData.tempSuppliers?.find((s: any) => s.isPreferred)?.supplierName || '',
            supplier_sku: articleData.tempSuppliers?.find((s: any) => s.isPreferred)?.supplierSku || '',
            product_url: articleData.tempSuppliers?.find((s: any) => s.isPreferred)?.url || '',
            image_url: articleData.image,
            warehouse_id: targetWarehouseId,
        };

        let currentId = selectedArticle?.id;
        if (isEditMode && currentId) {
            await supabase.from('articles').update(payload).eq('id', currentId);
        } else {
            const { data } = await supabase.from('articles').insert(payload).select('id').single();
            if (data) currentId = data.id;
        }

        if (currentId && articleData.tempSuppliers) {
            await supabase.from('article_suppliers').delete().eq('article_id', currentId);
            const validSuppliers = articleData.tempSuppliers.filter((s: any) => s.supplierId);
            if (validSuppliers.length > 0) {
                const inserts = validSuppliers.map((s: any) => ({
                    article_id: currentId,
                    supplier_id: s.supplierId,
                    supplier_sku: s.supplierSku,
                    url: s.url,
                    is_preferred: !!s.isPreferred
                }));
                await supabase.from('article_suppliers').insert(inserts);
            }
        }

        if (shouldClose) {
            setIsEditModalOpen(false);
        }
    };

    // --- STOCK MANIPULATION ---
    const handleIncrementStock = (e: React.MouseEvent) => {
        e.stopPropagation();
        setQuickStockAmount(prev => prev + 1);
    };

    const handleDecrementStock = (e: React.MouseEvent) => {
        e.stopPropagation();
        setQuickStockAmount(prev => prev - 1);
    };

    const handleQuickSave = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (quickStockAmount === 0) return;
        setIsBooking(true);

        const article = articles.find(a => a.id === id);
        if (!article) return;

        const newStock = Math.max(0, article.stock + quickStockAmount);
        updateLocalArticle(id, { stock: newStock });

        try {
            const { error } = await supabase.from('articles').update({ stock: newStock }).eq('id', id);
            if (error) throw error;
            setExpandedArticleId(null);
            setQuickStockAmount(0);
        } catch (err) {
            updateLocalArticle(id, { stock: article.stock });
            console.error(err);
        } finally {
            setIsBooking(false);
        }
    };

    if (loading || authLoading) return <div className="flex flex-col items-center justify-center h-[60vh] text-white/50"><Loader2 size={40} className="animate-spin mb-4 text-emerald-400" /><p>Lade Lagerbestand...</p></div>;

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
            {distinctCategories.map(cat => (
                <button
                    key={cat}
                    onClick={() => { setSelectedCategory(cat); setIsMobileCategoryOpen(false); }}
                    className={clsx(
                        "flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 text-left group",
                        selectedCategory === cat ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-white/50 hover:text-white hover:bg-white/5"
                    )}
                >
                    <div className="flex items-center gap-3">
                        <ChevronRight size={14} className={clsx("transition-transform", selectedCategory === cat ? "rotate-90 text-emerald-400" : "text-white/20 group-hover:text-white/40")} />
                        <span className="text-sm truncate">{cat}</span>
                    </div>
                    {selectedCategory === cat && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                </button>
            ))}
        </div>
    );

    const headerContent = (
        <>
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1 pt-4 pb-2">
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
                        <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-200">Lagerbestand</h1>
                        {selectedCategory && <p className="text-xs text-emerald-400/70 font-medium truncate max-w-[200px]">{selectedCategory}</p>}
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant={isSelectionMode ? 'secondary' : 'primary'} className={clsx("transition-all", isSelectionMode ? 'bg-white/20 text-white' : 'bg-white/5 text-white/70 hover:text-white border-white/10')} onClick={toggleSelectionMode} icon={isSelectionMode ? <CheckSquare size={18} /> : <ListChecks size={18} />}>
                        <span className="hidden sm:inline">{isSelectionMode ? 'Fertig' : 'Auswahl'}</span>
                    </Button>
                    <Button variant="primary" icon={<Plus size={18} />} onClick={() => openNewArticleModal()}>Neu</Button>
                </div>
            </header>

            <div className="px-1 pb-2">
                <InventoryToolbar
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    currentWarehouse={currentWarehouse}
                    warehouses={warehouses}
                    onWarehouseChange={handleWarehouseChange}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    activeFilter={activeFilter}
                    setActiveFilter={setActiveFilter}
                    sortConfig={sortConfig}
                    setSortConfig={setSortConfig}
                    isExpanded={isHeaderExpanded}
                    onToggle={() => setIsHeaderExpanded(!isHeaderExpanded)}
                />
            </div>
        </>
    );

    const listContent = (
        <div className="relative h-full flex flex-col overflow-hidden">
            <div className="flex h-full overflow-hidden">
                {/* Desktop Sidebar */}
                {!isMobile && (
                    <aside className="w-64 flex-shrink-0 border-r border-white/5 flex flex-col animate-in slide-in-from-left duration-500">
                        <div className="px-4 py-2 flex items-center gap-2 text-white/30 uppercase tracking-widest text-[10px] font-bold">
                            <Filter size={10} />
                            Kategorien
                        </div>
                        <CategorySidebar />
                    </aside>
                )}

                <div className="flex-1 h-full overflow-hidden flex flex-col">
                    <InventoryList
                        groupedArticles={groupedArticles}
                        collapsedCategories={collapsedCategories}
                        toggleCategoryCollapse={toggleCategoryCollapse}
                        isSelectionMode={isSelectionMode}
                        selectedArticleIds={selectedArticleIds}
                        toggleCategorySelection={toggleCategorySelection}
                        toggleArticleSelection={toggleArticleSelection}
                        handleQuickAddToCategory={handleQuickAddToCategory}
                        expandedArticleId={expandedArticleId}
                        quickStockAmount={quickStockAmount}
                        isBooking={isBooking}
                        onCardClick={handleCardClick}
                        onQuickStockChange={setQuickStockAmount}
                        onIncrementStock={handleIncrementStock}
                        onDecrementStock={handleDecrementStock}
                        onCancelQuickBook={(e) => { e.stopPropagation(); setExpandedArticleId(null); }}
                        onQuickSave={handleQuickSave}
                        onOpenDetail={openDetail}
                        orderDetails={orderDetails}
                        copiedField={copiedField}
                        onCopy={handleCopy}
                        useWindowScroll={false}
                        headerContent={headerContent}
                        hideGroupHeaders={true}
                    />
                </div>
            </div>

            {/* Mobile Category Drawer */}
            <AnimatePresence>
                {isMobileCategoryOpen && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileCategoryOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] lg:hidden"
                        />
                        <motion.div 
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed left-0 top-0 bottom-0 w-[80%] max-w-sm bg-[#1a1a1a] z-[201] border-r border-white/10 p-6 flex flex-col lg:hidden shadow-2xl shadow-black"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-bold text-white">Kategorien</h2>
                                <button onClick={() => setIsMobileCategoryOpen(false)} className="p-2 text-white/40 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <CategorySidebar />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {isSelectionMode && selectedArticleIds.size > 0 && (
                <div className="absolute bottom-4 left-0 right-0 p-4 z-[90] flex justify-center animate-in slide-in-from-bottom-5 pointer-events-none">
                    <div className="bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-3 flex items-center gap-4 max-w-lg w-full pointer-events-auto">
                        <div className="pl-2 font-bold text-white whitespace-nowrap">{selectedArticleIds.size} Ausgewählt</div>
                        <div className="h-6 w-px bg-white/20"></div>
                        <Button onClick={handleOpenCopyModal} icon={<Copy size={16} />} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-xs sm:text-sm whitespace-nowrap">In anderes Lager kopieren</Button>
                    </div>
                </div>
            )}
        </div >
    );

    return (
        <>
            <MasterDetailLayout
                isOpen={!!selectedArticle || isEditModalOpen}
                onClose={() => { setSelectedArticle(null); setIsEditModalOpen(false); }}
                title={isEditModalOpen ? (isEditMode ? 'Artikel bearbeiten' : 'Neuer Artikel') : (selectedArticle ? selectedArticle.name : 'Details')}
                hideHeader={isEditModalOpen}
                contentClassName={isEditModalOpen ? "p-0 overflow-hidden h-full" : "p-6 overflow-y-auto custom-scrollbar"}
                listContent={listContent}
                detailContent={
                    isEditModalOpen ? (
                        <div className="h-full bg-[#1a1d24]">
                            <ArticleEditForm
                                isEditMode={isEditMode}
                                initialArticle={selectedArticle}
                                warehouses={warehouses}
                                suppliers={suppliers}
                                onSave={handleSaveFromModal}
                                onCancel={() => setIsEditModalOpen(false)}
                                distinctCategories={distinctCategories}
                                onNavigate={handleEditNavigate}
                                hasNavigation={true}
                            />
                        </div>
                    ) : selectedArticle ? (
                        <ArticleDetailContent
                            article={selectedArticle}
                            onClose={() => setSelectedArticle(null)}
                            onEdit={openEditArticleModal}
                            onNavigate={handleEditNavigate}
                            hasNavigation={true}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-white/30">
                            <Layers size={64} strokeWidth={1} className="mb-4 opacity-50" />
                            <p>Wähle einen Artikel aus</p>
                        </div>
                    )
                }
            />

            {showDeleteModal && deleteTargetId && (
                <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95">
                    <GlassCard className="w-full max-w-sm p-6 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-400 border border-red-500/20"><Trash2 size={32} /></div>
                        <h3 className="text-xl font-bold text-white mb-2">Artikel löschen?</h3>
                        <div className="flex gap-3 w-full"><Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="flex-1">Abbrechen</Button><Button variant="danger" onClick={executeDelete} className="flex-1">Löschen</Button></div>
                    </GlassCard>
                </div>
            )}

            {isCopyModalOpen && (
                <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in zoom-in-95">
                    <GlassCard className="w-full max-w-lg">
                        <h2 className="text-xl font-bold text-white mb-4">Artikel Kopieren (Beta)</h2>
                        <div className="text-white/60 mb-6">Funktion wird implementiert...</div>
                        <Button onClick={() => setIsCopyModalOpen(false)}>Schließen</Button>
                    </GlassCard>
                </div>
            )}
        </>
    );
};

export default Inventory;
