import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Article } from '../../types';
import { X, ChevronDown, Clock, Layers, ExternalLink, Copy, Check, User, Loader2, Printer, Edit } from 'lucide-react';
import { Button } from '../UIComponents';

interface ArticleDetailContentProps {
    article: Article;
    onClose?: () => void;
    onEdit: (article: Article) => void;
    onNavigate?: (direction: 'prev' | 'next') => void;
    hasNavigation?: boolean;
}

export const ArticleDetailContent: React.FC<ArticleDetailContentProps> = ({
    article,
    onClose,
    onEdit,
    onNavigate,
    hasNavigation
}) => {
    const navigate = useNavigate();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const { data } = await supabase
                    .from('stock_movements')
                    .select('*, profiles:user_id (full_name)')
                    .eq('article_id', article.id)
                    .order('created_at', { ascending: false })
                    .limit(5);
                if (data) setHistory(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [article.id]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!onNavigate) return;
            // Only navigate if not editing inputs (though this is a detail view)
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.key === 'ArrowRight') onNavigate('next');
            if (e.key === 'ArrowLeft') onNavigate('prev');
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onNavigate]);

    const handleCopy = (text: string, field: string) => {
        if (!text || text === '-') return;
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    return (
        <div className="flex flex-col h-full bg-transparent text-slate-100">
            {/* Navigation Arrows for Side Panel */}
            {hasNavigation && onNavigate && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); onNavigate('prev'); }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 text-white/30 hover:bg-emerald-500/20 hover:text-emerald-400 transition-all backdrop-blur-sm hidden xl:block -ml-12"
                        title="Vorheriger (Pfeil Links)"
                    >
                        <ChevronDown size={24} className="rotate-90" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onNavigate('next'); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 text-white/30 hover:bg-emerald-500/20 hover:text-emerald-400 transition-all backdrop-blur-sm hidden xl:block -mr-12"
                        title="Nächster (Pfeil Rechts)"
                    >
                        <ChevronDown size={24} className="-rotate-90" />
                    </button>
                </>
            )}

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto space-y-6 min-h-0 pb-4">

                {/* Header Info */}
                <div>
                    <div className="flex items-start justify-between gap-4">
                        <h2 className="text-xl font-bold text-white leading-snug break-words">{article.name}</h2>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${article.stock >= article.targetStock ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'}`}>
                            {article.stock >= article.targetStock ? 'Bestand OK' : 'Unterbestand'}
                        </span>
                        {article.onOrderDate && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-200 border border-amber-500/20">
                                <Clock size={12} />
                                <span>
                                    Bestellt: {new Date(article.onOrderDate).toLocaleDateString()}
                                </span>
                            </span>
                        )}
                    </div>
                </div>

                {/* Image Section */}
                <div className="w-full aspect-[4/3] rounded-2xl bg-black/40 border border-white/10 overflow-hidden relative group">
                    <img
                        src={article.image || `https://picsum.photos/seed/${article.id}/400/300`}
                        className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"
                        alt={article.name}
                    />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                        <div className="text-white/40 text-xs font-medium mb-1">Lagerbestand</div>
                        <div className="flex items-baseline gap-1">
                            <span className={`text-2xl font-bold ${article.stock < article.targetStock ? 'text-rose-400' : 'text-emerald-400'}`}>{article.stock}</span>
                            <span className="text-white/30 text-xs">/ {article.targetStock} Soll</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                            <div className={`h-full rounded-full ${article.stock < article.targetStock ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min((article.stock / (article.targetStock || 1)) * 100, 100)}%` }}></div>
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                        <div className="text-white/40 text-xs font-medium mb-1">Lagerort</div>
                        <div className="text-lg font-bold text-white truncate" title={article.location}>{article.location || '-'}</div>
                        <div className="text-xs text-white/50 mt-1 flex items-center gap-1 truncate" title={article.category}><Layers size={10} /> {article.category}</div>
                    </div>
                </div>

                {/* Detail List */}
                <div className="space-y-2">
                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider px-1">Stammdaten</h3>
                    <div className="bg-white/5 rounded-xl border border-white/10 divide-y divide-white/5">
                        <div className="p-3 flex justify-between text-sm">
                            <span className="text-white/50">Hersteller-Nr.</span>
                            <span className="text-white font-mono select-all text-right ml-4 break-all">{article.sku || '-'}</span>
                        </div>
                        <div className="p-3 flex justify-between text-sm">
                            <span className="text-white/50">EAN / GTIN</span>
                            <span className="text-white font-mono select-all text-right ml-4">{article.ean || '-'}</span>
                        </div>
                        <div className="p-3 flex justify-between text-sm">
                            <span className="text-white/50">Lieferant</span>
                            <span className="text-white text-right ml-4 truncate">{article.supplier || '-'}</span>
                        </div>

                        <div
                            onClick={() => handleCopy(article.supplierSku || '', 'supplierSku')}
                            className={`p-3 flex justify-between text-sm cursor-pointer transition-colors ${copiedField === 'supplierSku' ? 'bg-emerald-500/10' : 'hover:bg-white/5'}`}
                        >
                            <span className="text-white/50">Lieferant Art-Nr.</span>
                            <span className={`font-mono flex items-center gap-2 ${copiedField === 'supplierSku' ? 'text-emerald-400' : 'text-white'}`}>
                                {article.supplierSku || '-'}
                                {article.supplierSku && (
                                    copiedField === 'supplierSku' ? <Check size={14} /> : <Copy size={14} className="opacity-50" />
                                )}
                            </span>
                        </div>

                        {article.productUrl && (
                            <div className="p-3 flex justify-between text-sm">
                                <span className="text-white/50">Produkt-Link</span>
                                <a href={article.productUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                                    Öffnen <ExternalLink size={12} />
                                </a>
                            </div>
                        )}
                    </div>
                </div>

                {/* History Section */}
                <div>
                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider px-1 mb-2 flex justify-between items-center">
                        <span>Verlauf (Letzte 5)</span>
                        {loading && <Loader2 className="animate-spin w-3 h-3" />}
                    </h3>
                    <div className="space-y-2">
                        {history.length === 0 && !loading && <div className="text-center text-white/20 py-4 text-xs italic">Keine Bewegungen.</div>}
                        {history.map(move => (
                            <div key={move.id} className="bg-white/5 p-2.5 rounded-xl border border-white/5 flex justify-between items-center">
                                <div>
                                    <div className="text-[10px] text-white/30 mb-0.5">{new Date(move.created_at).toLocaleDateString()} • {new Date(move.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    <div className="text-sm text-white">{move.reference || 'Manuelle Buchung'}</div>
                                    <div className="text-[10px] text-white/40 flex items-center gap-1"><User size={10} /> {move.profiles?.full_name || 'Unbekannt'}</div>
                                </div>
                                <div className={`font-bold font-mono ${move.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {move.amount > 0 ? '+' : ''}{move.amount}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="shrink-0 pt-4 mt-2 border-t border-white/10 flex gap-2">
                <Button variant="secondary" onClick={() => navigate('/labels')} className="flex-1 text-xs sm:text-sm" icon={<Printer size={16} />}>Etikett</Button>
                <Button variant="secondary" onClick={() => onEdit(article)} className="flex-1 text-xs sm:text-sm" icon={<Edit size={16} />}>Bearbeiten</Button>
            </div>
        </div>
    );
};
