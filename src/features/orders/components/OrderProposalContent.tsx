import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/UIComponents';
import { Loader2, X, ShoppingCart, ArrowDownToLine, Check, Minus, Plus, Copy, FileText } from 'lucide-react';
import { supabase } from '../../../../supabaseClient';
import { OrderProposal } from '../../../../types';
import { useAuth } from '../../../../contexts/AuthContext';

interface OrderProposalContentProps {
    proposal: OrderProposal;
    onClose: () => void;
    onOrderCreated: () => void;
}

export const OrderProposalContent: React.FC<OrderProposalContentProps> = ({ proposal, onClose, onOrderCreated }) => {
    const { user } = useAuth();

    // State
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
    const [proposalQuantities, setProposalQuantities] = useState<Record<string, number>>({});
    const [newOrderNumber, setNewOrderNumber] = useState('');
    const [newCommissionNumber, setNewCommissionNumber] = useState('Lade...');
    const [commissionCopied, setCommissionCopied] = useState(false);

    // Copy SKU Modal State (Internal)
    const [showSkuCopyModal, setShowSkuCopyModal] = useState(false);
    const [copiedSkuIds, setCopiedSkuIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        initializeProposal();
    }, [proposal]);

    const initializeProposal = async () => {
        // Reset
        setNewOrderNumber('');
        setShowSkuCopyModal(false);
        setCopiedSkuIds(new Set());
        setCommissionCopied(false);

        // Generate Commission Number
        setNewCommissionNumber('Lade...');
        try {
            const { count } = await supabase.from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('warehouse_id', proposal.warehouseId);

            const nextNum = (count || 0) + 1;
            const safeWhName = proposal.warehouseName.replace(/[^a-zA-Z0-9]/g, '');
            const generated = `${safeWhName}-${nextNum.toString().padStart(4, '0')}`;
            setNewCommissionNumber(generated);
        } catch (e) {
            setNewCommissionNumber('');
        }

        // Initialize Selections
        const initialSelected = new Set<string>();
        const initialQuantities: Record<string, number> = {};

        proposal.articles.forEach(a => {
            initialSelected.add(a.article.id);
            initialQuantities[a.article.id] = a.missingAmount;
        });

        setSelectedItemIds(initialSelected);
        setProposalQuantities(initialQuantities);
    };

    const toggleProposalItem = (articleId: string) => {
        const newSet = new Set(selectedItemIds);
        if (newSet.has(articleId)) newSet.delete(articleId); else newSet.add(articleId);
        setSelectedItemIds(newSet);
    };

    const updateProposalQuantity = (articleId: string, delta: number) => {
        setProposalQuantities(prev => ({
            ...prev,
            [articleId]: Math.max(1, (prev[articleId] || 0) + delta)
        }));
    };

    const handleCopyCommission = () => {
        if (newCommissionNumber) {
            navigator.clipboard.writeText(newCommissionNumber);
            setCommissionCopied(true);
            setTimeout(() => setCommissionCopied(false), 2000);
        }
    };

    const handleProposalCsvDownload = () => {
        const itemsToExport = proposal.articles.filter(a => selectedItemIds.has(a.article.id));
        if (itemsToExport.length === 0) return;

        const format = proposal.csvFormat || "{{sku}};{{amount}}";
        let csvContent = "data:text/csv;charset=utf-8,";
        const rows = itemsToExport.map(item => {
            const amount = proposalQuantities[item.article.id] || item.missingAmount;
            let row = format;
            row = row.replace(/{{sku}}/g, item.article.supplierSku || item.article.sku || '');
            row = row.replace(/{{amount}}/g, amount.toString());
            row = row.replace(/{{name}}/g, item.article.name);
            return row;
        });

        csvContent += rows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Bestellung_${proposal.supplier}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
    };

    const createOrder = async () => {
        if (!user) return;
        try {
            if (selectedItemIds.size === 0) return;

            const { data: orderData, error } = await supabase
                .from('orders')
                .insert({
                    supplier: proposal.supplier,
                    date: new Date().toISOString(),
                    status: 'Ordered',
                    item_count: selectedItemIds.size,
                    total: 0,
                    warehouse_id: proposal.warehouseId,
                    supplier_order_number: newOrderNumber,
                    commission_number: newCommissionNumber
                })
                .select().single();

            if (error) throw error;

            const itemsToOrder = proposal.articles.filter(a => selectedItemIds.has(a.article.id));

            for (const item of itemsToOrder) {
                const qty = proposalQuantities[item.article.id] || item.missingAmount;
                await supabase.from('order_items').insert({
                    order_id: orderData.id,
                    article_id: item.article.id,
                    quantity_ordered: qty
                });
                await supabase.from('articles').update({ on_order_date: new Date().toISOString() }).eq('id', item.article.id);
            }

            await supabase.from('order_events').insert({
                order_id: orderData.id,
                user_id: user.id,
                action: 'Neue Bestellung',
                details: `Bestellung bei ${proposal.supplier}`
            });

            alert("Bestellung erfolgreich erstellt!");
            onOrderCreated();
        } catch (e: any) { alert("Fehler: " + e.message); }
    };

    // Internal Copy SKU helper
    const handleCopySku = (sku: string, id: string) => {
        if (!sku) return;
        navigator.clipboard.writeText(sku);
        setCopiedSkuIds(prev => new Set(prev).add(id));
    };

    return (
        <div className="flex flex-col h-full bg-transparent text-slate-100">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-border flex justify-between items-center bg-white/[0.02] shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-white">Bestellvorschlag</h2>
                    <p className="text-sm text-muted-foreground">{proposal.supplier}</p>
                </div>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-white"><X size={20} /></button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {proposal.articles.map((item) => (
                    <div
                        key={item.article.id}
                        className={`flex flex-col p-3 rounded-xl border transition-colors ${selectedItemIds.has(item.article.id) ? 'bg-primary/5 border-emerald-500/30' : 'bg-muted border-white/5'}`}
                    >
                        <div className="flex items-start gap-3 mb-2" onClick={() => toggleProposalItem(item.article.id)}>
                            <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center cursor-pointer ${selectedItemIds.has(item.article.id) ? 'bg-primary border-emerald-500 text-white' : 'border-border'}`}>
                                {selectedItemIds.has(item.article.id) && <Check size={12} />}
                            </div>
                            <div className="flex-1 cursor-pointer">
                                <div className="text-sm font-bold text-white line-clamp-2">{item.article.name}</div>
                                <div className="text-xs text-muted-foreground flex gap-2">
                                    <span>Lager: {item.article.stock} / Soll: {item.article.targetStock}</span>
                                    <span className="font-mono text-muted-foreground">{item.article.supplierSku}</span>
                                </div>
                            </div>
                        </div>
                        {selectedItemIds.has(item.article.id) && (
                            <div className="flex items-center gap-3 pl-8">
                                <div className="text-xs text-muted-foreground">Menge:</div>
                                <div className="flex items-center bg-black/30 rounded-lg border border-border">
                                    <button onClick={() => updateProposalQuantity(item.article.id, -1)} className="p-2 hover:bg-muted rounded-l-lg text-white"><Minus size={14} /></button>
                                    <div className="w-12 text-center font-bold text-white text-sm">
                                        {proposalQuantities[item.article.id] || item.missingAmount}
                                    </div>
                                    <button onClick={() => updateProposalQuantity(item.article.id, 1)} className="p-2 hover:bg-muted rounded-r-lg text-white"><Plus size={14} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer Form */}
            <div className="p-4 sm:p-6 border-t border-border bg-muted shrink-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Auftrags-Nr. (Lieferant)</label>
                        <input
                            className="w-full bg-black/20 border border-border rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                            placeholder="z.B. 2024-9988"
                            value={newOrderNumber}
                            onChange={e => setNewOrderNumber(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block flex justify-between">
                            <span>Kommission (Intern)</span>
                            {commissionCopied && <span className="text-emerald-400 font-bold">Kopiert!</span>}
                        </label>
                        <div className="relative group cursor-pointer" onClick={handleCopyCommission}>
                            <input
                                className="w-full bg-black/20 border border-border rounded-lg p-2 pr-8 text-sm text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                                placeholder="Automatisch..."
                                value={newCommissionNumber}
                                readOnly
                            />
                            <div className="absolute right-2 top-2 text-muted-foreground group-hover:text-white">
                                {commissionCopied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                            </div>
                        </div>
                    </div>
                </div>

                <button onClick={() => setShowSkuCopyModal(true)} className="w-full py-2.5 rounded-xl border border-border bg-black/20 hover:bg-muted text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                    <Copy size={14} /> Artikel-Nrn. kopieren
                </button>

                <div className="flex gap-3">
                    <Button variant="secondary" onClick={handleProposalCsvDownload} icon={<FileText size={16} />} className="flex-1 bg-muted hover:bg-muted">CSV Export</Button>
                    <Button onClick={createOrder} disabled={selectedItemIds.size === 0} className="flex-[2] bg-primary hover:bg-primary">Bestellen ({selectedItemIds.size})</Button>
                </div>
            </div>

            {/* INLINE MODAL: Copy SKU List */}
            {showSkuCopyModal && (
                <div className="absolute inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-[#1a1d24] border border-border rounded-2xl shadow-xl flex flex-col max-h-[80%]">
                        <div className="p-4 border-b border-border flex justify-between items-center bg-muted">
                            <h3 className="font-bold text-white">Artikel kopieren</h3>
                            <button onClick={() => setShowSkuCopyModal(false)}><X size={18} className="text-muted-foreground hover:text-white" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {proposal.articles
                                .filter(item => selectedItemIds.has(item.article.id))
                                .map(item => {
                                    const isCopied = copiedSkuIds.has(item.article.id);
                                    return (
                                        <div
                                            key={item.article.id}
                                            onClick={() => handleCopySku(item.article.supplierSku || item.article.sku || '', item.article.id)}
                                            className={`p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center group ${isCopied
                                                ? 'bg-primary/20 border-emerald-500/50'
                                                : 'bg-muted border-white/5 hover:bg-muted'
                                                }`}
                                        >
                                            <div className="flex-1 min-w-0 pr-3">
                                                <div className={`text-sm font-bold truncate ${isCopied ? 'text-emerald-400' : 'text-white'}`}>
                                                    {item.article.name}
                                                </div>
                                                <div className="text-xs font-mono text-muted-foreground flex items-center gap-2">
                                                    {item.article.supplierSku || 'Keine Art-Nr.'}
                                                </div>
                                            </div>
                                            <div className={`p-2 rounded-lg ${isCopied ? 'bg-primary text-white' : 'bg-black/20 text-muted-foreground group-hover:text-white'}`}>
                                                {isCopied ? <Check size={16} /> : <Copy size={16} />}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
