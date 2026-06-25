import React, { useMemo } from 'react';
import { Virtuoso, GroupedVirtuoso } from 'react-virtuoso';
import { motion } from 'framer-motion';
import {
    Plus, Minus, X, CheckSquare, Square, ChevronDown, MapPin, Loader2,
    Building2, ExternalLink, Hash, Check, Clock
} from 'lucide-react';
import { Article } from '../../../../types';
import { CachedImage } from '../../../components/CachedImage';

interface InventoryListProps {
    groupedArticles: Record<string, Article[]>;
    collapsedCategories: string[] | undefined;
    toggleCategoryCollapse: (category: string) => void;
    isSelectionMode: boolean;
    selectedArticleIds: Set<string>;
    toggleCategorySelection: (articles: Article[]) => void;
    toggleArticleSelection: (articleId: string) => void;
    handleQuickAddToCategory: (e: React.MouseEvent, category: string) => void;
    hideGroupHeaders?: boolean;

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
    headerContent?: React.ReactNode;
}

const ListHeader = React.forwardRef<HTMLDivElement, { context?: { headerContent: React.ReactNode } }>(({ context }, ref) => {
    if (!context?.headerContent) return null;
    return <div ref={ref}>{context.headerContent}</div>;
});

const ListFooter = React.forwardRef<HTMLDivElement, any>((props, ref) => {
    return <div ref={ref} className="h-24 md:h-0" />;
});

export const InventoryList: React.FC<InventoryListProps> = ({
    groupedArticles, collapsedCategories, toggleCategoryCollapse,
    isSelectionMode, selectedArticleIds, toggleCategorySelection, toggleArticleSelection,
    handleQuickAddToCategory,
    hideGroupHeaders = false,
    expandedArticleId, quickStockAmount, isBooking,
    onCardClick, onQuickStockChange, onIncrementStock, onDecrementStock, onCancelQuickBook, onQuickSave, onOpenDetail,
    orderDetails, copiedField, onCopy,
    useWindowScroll = true,
    headerContent
}) => {

    const categories = useMemo(() => {
        return Object.keys(groupedArticles).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        );
    }, [groupedArticles]);

    // Flatten visible articles for both components
    const visibleArticles = useMemo(() => {
        return categories.flatMap(cat => {
            const isCollapsed = !hideGroupHeaders && collapsedCategories?.includes(cat);
            return isCollapsed ? [] : groupedArticles[cat];
        });
    }, [categories, collapsedCategories, groupedArticles, hideGroupHeaders]);

    // Group counts for GroupedVirtuoso
    const groupCounts = useMemo(() => {
        return categories.map(cat => {
            const isCollapsed = !hideGroupHeaders && collapsedCategories?.includes(cat);
            return isCollapsed ? 0 : groupedArticles[cat].length;
        });
    }, [categories, collapsedCategories, groupedArticles, hideGroupHeaders]);

    const virtuosoComponents = useMemo(() => ({
        Header: headerContent ? ListHeader as any : undefined,
        Footer: ListFooter as any
    }), [!!headerContent]);

    const renderArticleItem = (article: Article) => {
        if (!article) return null;

        const isTargetReached = article.stock >= article.targetStock;
        const isExpanded = expandedArticleId === article.id;
        const isSelected = selectedArticleIds.has(article.id);

        if (isExpanded) {
            return (
                <motion.div 
                    className="pb-3 px-1"
                    initial={{ opacity: 0, y: -10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2 }}
                >
                    <div
                        onClick={() => onCardClick(article)}
                        data-article-card="true"
                        className="flex flex-col gap-4 p-3 rounded-xl bg-muted border shadow-lg cursor-pointer border-emerald-500/20"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1">
                                <button onClick={onDecrementStock} className="w-10 h-10 flex items-center justify-center rounded-lg bg-muted text-foreground"><Minus size={18} /></button>
                                <input type="number" className="w-full h-10 text-center bg-muted rounded-lg text-foreground" value={quickStockAmount} onChange={(e) => onQuickStockChange(Number(e.target.value))} onClick={(e) => e.stopPropagation()} />
                                <button onClick={onIncrementStock} className="w-10 h-10 flex items-center justify-center rounded-lg bg-muted text-foreground"><Plus size={18} /></button>
                            </div>
                            <div className="flex items-center gap-2 border-l border-border pl-3">
                                <button onClick={onCancelQuickBook} className="w-10 h-10 flex items-center justify-center text-muted-foreground"><X size={20} /></button>
                                <button onClick={(e) => onQuickSave(e, article.id)} className="px-4 h-10 rounded-lg bg-primary text-white text-sm">
                                    {isBooking ? <Loader2 className="animate-spin" /> : 'Buchen'}
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            );
        }

        return (
            <motion.div 
                className="pb-2 px-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
            >
                <motion.div
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onCardClick(article)}
                    data-article-card="true"
                    className={`group relative flex items-center gap-3 p-2 pr-4 rounded-xl transition-all border cursor-pointer ${isSelectionMode && isSelected ? 'bg-primary/20 border-emerald-500/50' : isTargetReached ? 'bg-primary/5 hover:bg-primary/10 border-emerald-500/20' : 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/20'}`}
                >
                    {isSelectionMode && <div className={`shrink-0 mr-1 text-muted-foreground ${isSelected ? 'dark:text-emerald-400 text-emerald-800' : ''}`}>{isSelected ? <CheckSquare size={24} /> : <Square size={24} />}</div>}
                    <div onClick={(e) => { e.stopPropagation(); onOpenDetail(article); }} className="w-12 h-12 shrink-0 rounded-lg dark:bg-black/20 bg-muted/60 overflow-hidden relative border dark:border-white/5 border-border cursor-pointer hover:opacity-80 transition-opacity">
                        <CachedImage
                            src={article.image || `https://picsum.photos/seed/${article.id}/200/200`}
                            articleId={article.id}
                            className="w-full h-full object-contain opacity-80"
                            alt={article.name}
                        />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h3 className="font-medium text-foreground text-sm truncate">{article.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="font-mono tracking-tight">{article.sku}</span>
                            <span className="truncate text-muted-foreground flex items-center gap-1"><MapPin size={10} /> {article.location}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {article.stock < article.targetStock && <span className="text-[10px] bg-rose-500/20 dark:text-rose-300 text-rose-800 px-1.5 py-0.5 rounded">Unter Soll</span>}
                            {!!article.onOrderDate && <span className="text-[10px] bg-blue-500/20 dark:text-blue-300 text-blue-800 px-1.5 py-0.5 rounded">Bestellt</span>}
                            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Soll: {article.targetStock}</span>

                            {article.supplier && (
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (article.productUrl) window.open(article.productUrl, '_blank');
                                    }}
                                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-all ${article.productUrl ? 'cursor-pointer hover:bg-blue-500/20' : ''} bg-blue-500/10 border-blue-500/20 dark:text-blue-200 text-blue-900`}
                                    title={article.productUrl ? "Zum Shop öffnen" : "Lieferant"}
                                >
                                    <Building2 size={10} />
                                    <span className="truncate max-w-[100px]">{article.supplier}</span>
                                    {article.productUrl && <ExternalLink size={8} className="opacity-70" />}
                                </div>
                            )}

                            {article.supplierSku && (
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCopy(article.supplierSku!, `${article.id}-suppSku`);
                                    }}
                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-purple-500/10 border-purple-500/20 dark:text-purple-200 text-purple-800 cursor-pointer hover:bg-purple-500/20 transition-all"
                                    title="Artikelnummer kopieren"
                                >
                                    {copiedField === `${article.id}-suppSku` ? <Check size={10} /> : <Hash size={10} />}
                                    <span className="font-mono">{article.supplierSku}</span>
                                </div>
                            )}

                            {article.onOrderDate && (
                                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-amber-500/10 border-amber-500/20 dark:text-amber-200 text-amber-900">
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
                        <div className={`text-lg font-bold ${article.stock < article.targetStock ? 'dark:text-rose-400 text-rose-800' : 'dark:text-emerald-400 text-emerald-800'}`}>{article.stock}</div>
                    </div>
                </motion.div>
            </motion.div>
        );
    };

    if (hideGroupHeaders) {
        return (
            <Virtuoso
                useWindowScroll={useWindowScroll}
                style={!useWindowScroll ? { height: '100%' } : undefined}
                data={visibleArticles}
                context={{ headerContent }}
                components={virtuosoComponents}
                itemContent={(_, article) => renderArticleItem(article)}
            />
        );
    }

    return (
        <GroupedVirtuoso
            useWindowScroll={useWindowScroll}
            style={!useWindowScroll ? { height: '100%' } : undefined}
            context={{ headerContent }}
            components={virtuosoComponents}
            groupCounts={groupCounts}
            groupContent={(index) => {
                const category = categories[index];
                const grpArticles = groupedArticles[category];
                const isCollapsed = collapsedCategories?.includes(category) || false;
                const isCatSelected = isSelectionMode && grpArticles.length > 0 && grpArticles.every(a => selectedArticleIds.has(a.id));

                return (
                    <div className="flex items-center justify-between px-2 py-3 bg-background/50 backdrop-blur-sm z-10 sticky top-[120px] rounded-lg transition-colors group mb-2 border-b dark:border-white/5 border-border">
                        <div className="flex items-center gap-3 w-full cursor-pointer select-none" onClick={() => toggleCategoryCollapse(category)}>
                            {isSelectionMode && (
                                <div onClick={(e) => { e.stopPropagation(); toggleCategorySelection(grpArticles); }} className="text-muted-foreground hover:text-foreground">
                                    {isCatSelected ? <CheckSquare size={20} className="dark:text-emerald-400 text-emerald-800" /> : <Square size={20} />}
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <ChevronDown size={18} className={`transition-transform duration-300 ${isCollapsed ? '-rotate-90' : ''} text-muted-foreground`} />
                                <h2 className="text-base font-semibold text-muted-foreground">{category}</h2>
                                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md">{grpArticles.length}</span>
                            </div>
                        </div>
                        {!isSelectionMode && (
                            <button
                                onClick={(e) => handleQuickAddToCategory(e, category)}
                                className="p-2 dark:text-emerald-400 text-emerald-800 hover:bg-primary/20 hover:dark:text-emerald-300 text-emerald-800 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                title={`Neu in ${category}`}
                            >
                                <Plus size={20} />
                            </button>
                        )}
                    </div>
                );
            }}
            itemContent={(index) => renderArticleItem(visibleArticles[index])}
        />
    );
};