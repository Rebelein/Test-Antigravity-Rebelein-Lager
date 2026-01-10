
import { useState, useMemo } from 'react';
import { Article } from '../types';

interface SortConfig {
    key: 'location' | 'name';
    direction: 'asc' | 'desc';
}

export const useInventoryFilters = (articles: Article[]) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('Alle');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'location', direction: 'asc' });

    const sortArticles = (a: Article, b: Article) => {
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        if (sortConfig.key === 'location') {
            const locA = a.location || '';
            const locB = b.location || '';
            return locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' }) * dir;
        } else {
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) * dir;
        }
    };

    const groupedArticles = useMemo(() => {
        return articles
            .filter(a => {
                if (activeFilter === 'Unter Soll') return a.stock < a.targetStock;
                if (activeFilter === 'Bestellt') return !!a.onOrderDate;
                return true;
            })
            .filter(article =>
                article.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                article.sku.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort(sortArticles)
            .reduce((acc, article) => {
                const cat = article.category || 'Sonstiges';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(article);
                return acc;
            }, {} as Record<string, Article[]>);
    }, [articles, activeFilter, searchTerm, sortConfig]);

    return {
        searchTerm,
        setSearchTerm,
        activeFilter,
        setActiveFilter,
        sortConfig,
        setSortConfig,
        groupedArticles
    };
};
