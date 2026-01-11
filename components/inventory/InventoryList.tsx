import React, { useMemo } from 'react';
import { GroupedVirtuoso } from 'react-virtuoso';
import {
    Plus, Minus, X, CheckSquare, Square, ChevronDown, MapPin, Loader2,
    Building2, ExternalLink, Hash, Check, Clock
} from 'lucide-react';
import { Article } from '../../types';

interface InventoryListProps {
    groupedArticles: Record<string, Article[]>;
    collapsedCategories: string[] | undefined;
    toggleCategoryCollapse: (category: string) => void;
    isSelectionMode: boolean;
    selectedArticleIds: Set<string>;
    toggleCategorySelection: (articles: Article[]) => void;
    toggleArticleSelection: (articleId: string) => void;
    handleQuickAddToCategory: (e: React.MouseEvent, category: string) => void;

    // Quick Book State
    expandedArticleId: string | null;
    quickStockAmount: number;
    isBooking: boolean;

    // Handlers
    onCardClick: (article: Article) => void;
    onQuickStockChange: (amount: number) => void;
    onIncrementStock: (e: React.MouseEvent) => void;
    onDecrementStock: (e: React.MouseEvent) => void;
    onCancelQuickBook: (e: React.MouseEvent) => void;
    onQuickSave: (e: React.MouseEvent, articleId: string) => void;
    onOpenDetail: (article: Article) => void;

    // Additional Badges
    orderDetails: Record<string, { user: string }>;
    copiedField: string | null;
    onCopy: (text: string, field: string) => void;
    useWindowScroll?: boolean;
}

export const InventoryList: React.FC<InventoryListProps> = ({
    groupedArticles, collapsedCategories, toggleCategoryCollapse,
    isSelectionMode, selectedArticleIds, toggleCategorySelection, toggleArticleSelection,
    handleQuickAddToCategory,
    expandedArticleId, quickStockAmount, isBooking,
    onCardClick, onQuickStockChange, onIncrementStock, onDecrementStock, onCancelQuickBook, onQuickSave, onOpenDetail,
    orderDetails, copiedField, onCopy,
    useWindowScroll = true
}) => {

    const categories = useMemo(() => Object.keys(groupedArticles), [groupedArticles]);

    // Calculate group counts (0 if collapsed)
    const groupCounts = useMemo(() => {
        return categories.map(cat => {
            const isCollapsed = collapsedCategories?.includes(cat);
            return isCollapsed ? 0 : groupedArticles[cat].length;
        });
    }, [categories, collapsedCategories, groupedArticles]);

    // Flatten visible articles for itemContent access
    const visibleArticles = useMemo(() => {
        return categories.flatMap(cat => {
            const isCollapsed = collapsedCategories?.includes(cat);
            return isCollapsed ? [] : groupedArticles[cat];
        });
    }, [categories, collapsedCategories, groupedArticles]);

    return (
        <GroupedVirtuoso
            useWindowScroll={useWindowScroll}
            style={!useWindowScroll ? { height: '100%' } : undefined}
            groupCounts={groupCounts}
            groupContent={(index) => {
                const category = categories[index];
                const grpArticles = groupedArticles[category];
                const isCollapsed = collapsedCategories?.includes(category) || false;
                const isCatSelected = isSelectionMode && grpArticles.length > 0 && grpArticles.every(a => selectedArticleIds.has(a.id));

                return (
                    <div className="flex items-center justify-between px-2 py-3 bg-gray-900/50 backdrop-blur-sm z-10 sticky top-[120px] rounded-lg transition-colors group mb-2 border-b border-white/5">
                        <div className="flex items-center gap-3 w-full cursor-pointer select-none" onClick={() => toggleCategoryCollapse(category)}>
                            {isSelectionMode && (
                                <div onClick={(e) => { e.stopPropagation(); toggleCategorySelection(grpArticles); }} className="text-white/50 hover:text-white">
                                    {isCatSelected ? <CheckSquare size={20} className="text-emerald-400" /> : <Square size={20} />}
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <ChevronDown size={18} className={`transition-transform duration-300 ${isCollapsed ? '-rotate-90' : ''} text-white/50`} />
                                <h2 className="text-base font-semibold text-white/90">{category}</h2>
                                <span className="text-[10px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded-md">{grpArticles.length}</span>
                            </div>
                        </div>
                        {!isSelectionMode && (
                            <button
                                onClick={(e) => handleQuickAddToCategory(e, category)}
                                className="p-2 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                title={`Neu in ${category}`}
                            >
                                <Plus size={20} />
                            </button>
                        )}
                    </div>
                );
            }}
            itemContent={(index) => {
                const article = visibleArticles[index];
                if (!article) return null; // Should not happen if logic is correct

                const isTargetReached = article.stock >= article.targetStock;
                const isExpanded = expandedArticleId === article.id;
                const isSelected = selectedArticleIds.has(article.id);

                if (isExpanded) {
                    return (
                        <div className="pb-3 px-1">
                            <div
                                onClick={() => onCardClick(article)}
                                className="flex flex-col gap-4 p-3 rounded-xl bg-white/5 border shadow-lg cursor-pointer border-emerald-500/20"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1">
                                        <button onClick={onDecrementStock} className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 text-white"><Minus size={18} /></button>
                                        <input type="number" className="w-full h-10 text-center bg-white/5 rounded-lg text-white" value={quickStockAmount} onChange={(e) => onQuickStockChange(Number(e.target.value))} onClick={(e) => e.stopPropagation()} />
                                        <button onClick={onIncrementStock} className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 text-white"><Plus size={18} /></button>
                                    </div>
                                    <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                                        <button onClick={onCancelQuickBook} className="w-10 h-10 flex items-center justify-center text-white/40"><X size={20} /></button>
                                        <button onClick={(e) => onQuickSave(e, article.id)} className="px-4 h-10 rounded-lg bg-emerald-500 text-white text-sm">
                                            {isBooking ? <Loader2 className="animate-spin" /> : 'Buchen'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="pb-2 px-1">
                        <div
                            onClick={() => onCardClick(article)}
                            className={`group relative flex items-center gap-3 p-2 pr-4 rounded-xl transition-all border cursor-pointer ${isSelectionMode && isSelected ? 'bg-emerald-500/20 border-emerald-500/50' : isTargetReached ? 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/20'}`}
                        >
                            {isSelectionMode && <div className={`shrink-0 mr-1 text-white/50 ${isSelected ? 'text-emerald-400' : ''}`}>{isSelected ? <CheckSquare size={24} /> : <Square size={24} />}</div>}
                            <div onClick={(e) => { e.stopPropagation(); onOpenDetail(article); }} className="w-12 h-12 shrink-0 rounded-lg bg-black/20 overflow-hidden relative border border-white/5 cursor-pointer hover:opacity-80 transition-opacity">
                                <img src={article.image || `https://picsum.photos/seed/${article.id}/200/200`} className="w-full h-full object-contain opacity-80" alt={article.name} />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <h3 className="font-medium text-white text-sm truncate">{article.name}</h3>
                                <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                                    <span className="font-mono tracking-tight">{article.sku}</span>
                                    <span className="truncate text-white/50 flex items-center gap-1"><MapPin size={10} /> {article.location}</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {article.stock < article.targetStock && <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">Unter Soll</span>}
                                    {!!article.onOrderDate && <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">Bestellt</span>}
                                    <span className="text-[10px] bg-white/5 text-white/40 px-1.5 py-0.5 rounded">Soll: {article.targetStock}</span>

                                    {/* Supplier Name Badge */}
                                    {article.supplier && (
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (article.productUrl) window.open(article.productUrl, '_blank');
                                            }}
                                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-all ${article.productUrl ? 'cursor-pointer hover:bg-blue-500/20' : ''} bg-blue-500/10 border-blue-500/20 text-blue-200`}
                                            title={article.productUrl ? "Zum Shop öffnen" : "Lieferant"}
                                        >
                                            <Building2 size={10} />
                                            <span className="truncate max-w-[100px]">{article.supplier}</span>
                                            {article.productUrl && <ExternalLink size={8} className="opacity-70" />}
                                        </div>
                                    )}

                                    {/* Supplier SKU Badge */}
                                    {article.supplierSku && (
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCopy(article.supplierSku!, `${article.id}-suppSku`);
                                            }}
                                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-purple-500/10 border-purple-500/20 text-purple-200 cursor-pointer hover:bg-purple-500/20 transition-all"
                                            title="Artikelnummer kopieren"
                                        >
                                            {copiedField === `${article.id}-suppSku` ? <Check size={10} /> : <Hash size={10} />}
                                            <span className="font-mono">{article.supplierSku}</span>
                                        </div>
                                    )}

                                    {/* On Order Badge */}
                                    {article.onOrderDate && (
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-amber-500/10 border-amber-500/20 text-amber-200">
                                            <Clock size={10} />
                                            <span className="truncate">
                                                {new Date(article.onOrderDate).toLocaleDateString()}
                                                {orderDetails[article.id] ? ` • ${orderDetails[article.id].user}` : ''}
                                            </span>
                                        </div>
                                    )}

                                </div>
                            </div>
                            <div className="text-right">
                                <div className={`text-lg font-bold ${article.stock < article.targetStock ? 'text-rose-400' : 'text-emerald-400'}`}>{article.stock}</div>
                            </div>
                        </div>
                    </div>
                );
            }}
        />
    );
};
