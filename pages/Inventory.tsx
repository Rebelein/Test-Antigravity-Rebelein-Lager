import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../hooks/useIsMobile';
import { supabase } from '../supabaseClient';
import { useInventoryData } from '../hooks/useInventoryData';
import { Article } from '../types';
import { Button, GlassCard } from '../components/UIComponents';
import { useAuth } from '../contexts/AuthContext';
import { Plus, ListChecks, CheckSquare, Loader2, Copy, Trash2, X, Check, Layers, Wand2 } from 'lucide-react';
import { InventoryToolbar } from '../components/inventory/InventoryToolbar';
import { InventoryList } from '../components/inventory/InventoryList';
import { MasterDetailLayout } from '../components/MasterDetailLayout';
import { ArticleDetailContent } from '../components/inventory/ArticleDetailContent';
import { ArticleEditForm } from '../components/inventory/ArticleEditForm';

interface SortConfig {
    key: string;
    direction: 'asc' | 'desc';
}

const Inventory = () => {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const { profile, loading: authLoading, user } = useAuth();

    // --- VIEW STATE ---
    const [viewMode, setViewMode] = useState<'primary' | 'secondary'>('primary');

    const {
        articles, warehouses, suppliers, loading,
        updateLocalArticle, removeLocalArticle
    } = useInventoryData(viewMode);

    // Mock orderDetails for now as it was removed from useInventoryData but used in UI
    const orderDetails: Record<string, { user: string }> = {};

    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: 'asc' });

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
        if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
            // console.log("Inventory Render. Articles:", articles.length);
        }
    }, [articles]);

    // --- FILTERING & SORTING ---
    const currentWarehouseId = viewMode === 'primary' ? profile?.primary_warehouse_id : profile?.secondary_warehouse_id;
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

            return matchesSearch && matchesFilter;
        });
    }, [articles, currentWarehouseId, searchTerm, activeFilter]);

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
        return Array.from(new Set(articles.map(a => a.category || 'Unkategorisiert'))).sort();
    }, [articles]);

    // --- EVENT HANDLERS ---
    const handleWarehouseChange = (id: string) => {
        if (profile?.primary_warehouse_id === id) setViewMode('primary');
        else if (profile?.secondary_warehouse_id === id) setViewMode('secondary');
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

    const toggleCategoryCollapse = async (category: string) => {
        if (!user || !profile) return;
        const currentCollapsed = profile.collapsed_categories || [];
        const newCollapsed = currentCollapsed.includes(category)
            ? currentCollapsed.filter(c => c !== category)
            : [...currentCollapsed, category];

        await supabase.from('profiles').update({ collapsed_categories: newCollapsed }).eq('id', user.id);
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
        const targetWarehouseId = viewMode === 'primary' ? profile?.primary_warehouse_id : profile?.secondary_warehouse_id;
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

    const listContent = (
        <div className={`space-y-6 relative h-full flex flex-col ${isMobile ? 'pb-24' : 'pb-0'}`}>
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-200">Lagerbestand</h1>
                <div className="flex gap-3">
                    <Button variant={isSelectionMode ? 'secondary' : 'primary'} className={`transition-colors ${isSelectionMode ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70 hover:text-white'}`} onClick={toggleSelectionMode} icon={isSelectionMode ? <CheckSquare size={18} /> : <ListChecks size={18} />}>{isSelectionMode ? 'Fertig' : 'Auswahl'}</Button>
                    <Button variant="primary" icon={<Plus size={18} />} onClick={() => openNewArticleModal()}>Neu</Button>
                </div>
            </header>

            <div className="shrink-0">
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
                />
            </div>

            <div className="flex-1 min-h-0">
                <InventoryList
                    groupedArticles={groupedArticles}
                    collapsedCategories={profile?.collapsed_categories}
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
                    useWindowScroll={isMobile}
                />
            </div>

            {isSelectionMode && selectedArticleIds.size > 0 && (
                <div className="absolute bottom-4 left-0 right-0 p-4 z-[90] flex justify-center animate-in slide-in-from-bottom-5 pointer-events-none">
                    <div className="bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-3 flex items-center gap-4 max-w-lg w-full pointer-events-auto">
                        <div className="pl-2 font-bold text-white whitespace-nowrap">{selectedArticleIds.size} Ausgewählt</div>
                        <div className="h-6 w-px bg-white/20"></div>
                        <Button onClick={handleOpenCopyModal} icon={<Copy size={16} />} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-xs sm:text-sm whitespace-nowrap">In anderes Lager kopieren</Button>
                    </div>
                </div>
            )}
        </div>
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
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95">
                    <GlassCard className="w-full max-w-sm p-6 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-400 border border-red-500/20"><Trash2 size={32} /></div>
                        <h3 className="text-xl font-bold text-white mb-2">Artikel löschen?</h3>
                        <div className="flex gap-3 w-full"><Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="flex-1">Abbrechen</Button><Button variant="danger" onClick={executeDelete} className="flex-1">Löschen</Button></div>
                    </GlassCard>
                </div>
            )}

            {isCopyModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in zoom-in-95">
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
