import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Layers, Plus, Minus, Check, ChevronRight, Package, ShoppingCart, Filter } from 'lucide-react';
import { Article } from '../../../../types';
import { Button, GlassCard } from '../../../components/UIComponents';
import { CachedImage } from '../../../components/CachedImage';
import { clsx } from 'clsx';
import { useIsMobile } from '../../../../hooks/useIsMobile';

interface StockPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    articles: Article[];
    onAddItems: (items: { article: Article, amount: number }[]) => void;
}

export const StockPickerModal: React.FC<StockPickerModalProps> = ({
    isOpen,
    onClose,
    articles,
    onAddItems
}) => {
    const isMobile = useIsMobile();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [stagedQuantities, setStagedQuantities] = useState<Record<string, number>>({});
    const [isMobileCategoryOpen, setIsMobileCategoryOpen] = useState(false);

    const distinctCategories = useMemo(() => {
        const cats = Array.from(new Set(articles.map(a => a.category || 'Unkategorisiert')))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        return cats;
    }, [articles]);

    const filteredArticles = useMemo(() => {
        return articles.filter(a => {
            const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 (a.sku || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategory || (a.category || 'Unkategorisiert') === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [articles, searchTerm, selectedCategory]);

    const handleQuantityChange = (articleId: string, delta: number) => {
        setStagedQuantities(prev => {
            const current = prev[articleId] || 0;
            const next = Math.max(0, current + delta);
            if (next === 0) {
                const { [articleId]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [articleId]: next };
        });
    };

    const handleSetQuantity = (articleId: string, val: string) => {
        const num = parseInt(val) || 0;
        setStagedQuantities(prev => {
            if (num <= 0) {
                const { [articleId]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [articleId]: num };
        });
    };

    const handleAddAll = () => {
        const itemsToAdd = Object.entries(stagedQuantities).map(([id, amount]) => {
            const article = articles.find(a => a.id === id);
            return article ? { article, amount } : null;
        }).filter((item): item is { article: Article, amount: number } => item !== null);

        if (itemsToAdd.length > 0) {
            onAddItems(itemsToAdd);
            setStagedQuantities({});
            onClose();
        }
    };

    const stagedCount = Object.keys(stagedQuantities).length;

    if (!isOpen) return null;

    const CategoryList = () => (
        <div className="flex flex-col gap-1 py-2 h-full overflow-y-auto custom-scrollbar pr-2">
            <button
                onClick={() => { setSelectedCategory(null); setIsMobileCategoryOpen(false); }}
                className={clsx(
                    "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 text-left",
                    !selectedCategory ? "bg-primary/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10" : "text-muted-foreground hover:text-white hover:bg-muted"
                )}
            >
                <div className="flex items-center gap-3">
                    <Layers size={18} />
                    <span className="font-medium text-sm">Alle Kategorien</span>
                </div>
                {!selectedCategory && <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
            </button>
            <div className="h-px bg-muted my-2 mx-4" />
            {distinctCategories.map(cat => {
                const countInCategory = Object.entries(stagedQuantities).filter(([id]) => {
                    const article = articles.find(a => a.id === id);
                    return (article?.category || 'Unkategorisiert') === cat;
                }).length;

                return (
                    <button
                        key={cat}
                        onClick={() => { setSelectedCategory(cat); setIsMobileCategoryOpen(false); }}
                        className={clsx(
                            "flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 text-left group",
                            selectedCategory === cat ? "bg-primary/20 text-emerald-400 border border-emerald-500/30" : "text-muted-foreground hover:text-white hover:bg-muted"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <ChevronRight size={14} className={clsx("transition-transform", selectedCategory === cat ? "rotate-90 text-emerald-400" : "text-muted-foreground group-hover:text-muted-foreground")} />
                            <span className="text-sm truncate">{cat}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {countInCategory > 0 && <span className="bg-primary text-black text-[10px] font-bold px-1.5 rounded-full">{countInCategory}</span>}
                            {selectedCategory === cat && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </div>
                    </button>
                );
            })}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            />
            
            <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative w-full max-w-6xl h-[90vh] bg-[#121212] border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-inner">
                            <Package size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Material aus Hauptlager</h2>
                            <p className="text-sm text-muted-foreground">Artikel auswählen und Menge festlegen.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <input 
                                className="w-full bg-muted border border-border rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all text-sm"
                                placeholder="Artikel oder SKU suchen..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button onClick={onClose} className="p-2.5 rounded-xl bg-muted text-muted-foreground hover:text-white hover:bg-muted transition-all border border-white/5"><X size={20} /></button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar Desktop */}
                    {!isMobile && (
                        <aside className="w-72 flex-shrink-0 border-r border-white/5 flex flex-col p-4 bg-white/[0.01]">
                            <div className="px-4 py-2 flex items-center gap-2 text-muted-foreground uppercase tracking-widest text-[10px] font-bold mb-2">
                                <Filter size={10} />
                                Kategorien
                            </div>
                            <CategoryList />
                        </aside>
                    )}

                    {/* Main List */}
                    <main className="flex-1 flex flex-col min-w-0 bg-transparent">
                        {isMobile && (
                            <div className="p-4 border-b border-white/5 flex items-center gap-2">
                                <button 
                                    onClick={() => setIsMobileCategoryOpen(true)}
                                    className="flex-1 flex items-center gap-3 px-4 py-2 rounded-xl bg-muted border border-border text-muted-foreground"
                                >
                                    <Menu size={18} className="text-emerald-400" />
                                    <span className="text-sm font-medium">{selectedCategory || 'Alle Kategorien'}</span>
                                </button>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                            <div className="flex flex-col gap-3">
                                {filteredArticles.length === 0 ? (
                                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                                        <Search size={48} strokeWidth={1} className="mb-4" />
                                        <p>Keine Artikel gefunden.</p>
                                    </div>
                                ) : (
                                    filteredArticles.map(article => {
                                        const quantity = stagedQuantities[article.id] || 0;
                                        return (
                                            <div 
                                                key={article.id}
                                                className={clsx(
                                                    "group p-4 rounded-2xl border transition-all duration-300",
                                                    quantity > 0 
                                                        ? "bg-primary/10 border-emerald-500/40 shadow-lg shadow-emerald-500/5" 
                                                        : "bg-white/[0.03] border-white/5 hover:border-border"
                                                )}
                                            >
                                                <div className="flex justify-between items-start gap-3 mb-3">
                                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                                        <div className="w-12 h-12 shrink-0 rounded-lg bg-black/20 overflow-hidden relative border border-white/5">
                                                            <CachedImage
                                                                src={article.image || `https://picsum.photos/seed/${article.id}/200/200`}
                                                                articleId={article.id}
                                                                className="w-full h-full object-contain opacity-80"
                                                                alt={article.name}
                                                            />
                                                        </div>
                                                        <div className="min-w-0 flex-1 py-0.5">
                                                            <h3 className={clsx("font-bold text-sm", quantity > 0 ? "text-emerald-300" : "text-white")}>{article.name}</h3>
                                                            <p className="text-[10px] text-muted-foreground mt-0.5">{article.sku} • {article.location}</p>
                                                        </div>
                                                    </div>
                                                    <div className={clsx("text-xs font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5", article.stock > 0 ? "bg-primary/10 text-emerald-400" : "bg-rose-500/10 text-rose-400")}>
                                                        {article.stock} Stk
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center bg-black/40 rounded-xl border border-white/5 overflow-hidden flex-1">
                                                        <button 
                                                            onClick={() => handleQuantityChange(article.id, -1)}
                                                            className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-muted transition-colors"
                                                        >
                                                            <Minus size={16} />
                                                        </button>
                                                        <input 
                                                            type="number"
                                                            className="w-full h-10 bg-transparent text-center text-sm font-bold text-white focus:outline-none"
                                                            value={quantity === 0 ? '' : quantity}
                                                            onChange={e => handleSetQuantity(article.id, e.target.value)}
                                                            placeholder="0"
                                                        />
                                                        <button 
                                                            onClick={() => handleQuantityChange(article.id, 1)}
                                                            className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-muted transition-colors"
                                                        >
                                                            <Plus size={16} />
                                                        </button>
                                                    </div>
                                                    {quantity > 0 && (
                                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                                                            <Check size={20} strokeWidth={3} />
                                                        </motion.div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </main>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-white/5 flex items-center justify-between bg-white/[0.02]">
                    <div className="hidden sm:flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <ShoppingCart size={18} />
                            <span>Auswahl:</span>
                        </div>
                        <span className="font-bold text-white bg-primary/20 px-3 py-1 rounded-full border border-emerald-500/20">{stagedCount} Artikel</span>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Button variant="secondary" onClick={onClose} className="flex-1 sm:flex-none h-12 px-8">Abbrechen</Button>
                        <Button 
                            onClick={handleAddAll}
                            disabled={stagedCount === 0}
                            className="flex-1 sm:flex-none h-12 px-8 bg-primary hover:bg-primary shadow-xl shadow-emerald-500/20"
                            icon={<Plus size={20} />}
                        >
                            Übernehmen ({stagedCount})
                        </Button>
                    </div>
                </div>

                {/* Mobile Drawer */}
                <AnimatePresence>
                    {isMobileCategoryOpen && (
                        <>
                            <motion.div 
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setIsMobileCategoryOpen(false)}
                                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[310] lg:hidden"
                            />
                            <motion.div 
                                initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="fixed left-0 top-0 bottom-0 w-[80%] max-w-sm bg-[#121212] z-[311] border-r border-border p-6 flex flex-col lg:hidden"
                            >
                                <div className="flex items-center justify-between mb-8">
                                    <h2 className="text-2xl font-bold text-white">Kategorien</h2>
                                    <button onClick={() => setIsMobileCategoryOpen(false)} className="p-2 text-muted-foreground hover:text-white"><X size={24} /></button>
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <CategoryList />
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

const Menu = ({ size, className }: { size: number, className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" />
    </svg>
);
