import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { GlassCard, Button, GlassInput, GlassSelect, StatusBadge, GlassModal } from '../../components/UIComponents';
import { AddArticleModal } from '../../components/AddArticleModal';
import { Article, Order, OrderItem, Supplier, OrderProposal, WarehouseType, Warehouse } from '../../../types';
import { ShoppingCart, CheckCircle2, Loader2, Send, Copy, FileDown, Check, X, ClipboardList, Truck, Search, Box, Barcode, MapPin, Plus, Minus, PackageCheck, ArrowDownToLine, ChevronDown, ChevronUp, Clock, AlertTriangle, Archive, FileText, Sparkles, Upload, Trash2, Link as LinkIcon, Wand2, Eye, Warehouse as WarehouseIcon, RefreshCw, HardHat, Filter, Menu, ChevronRight } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { Type } from "@google/genai";

import { useSuppliers } from '../../../hooks/queries';
import { MasterDetailLayout } from '../../components/MasterDetailLayout';
import { OrderDetailContent } from '../../features/orders/components/OrderDetailContent';
import { OrderProposalContent } from '../../features/orders/components/OrderProposalContent';
import { OrderImportDetailContent } from '../../features/orders/components/OrderImportDetailContent';
import { ManualOrderWizardModal } from '../../features/orders/components/ManualOrderWizardModal';

const Orders: React.FC = () => {
    const navigate = useNavigate();
    const { profile, user } = useAuth();
    const isMobile = useIsMobile();
    const [isMobileCategoryOpen, setIsMobileCategoryOpen] = useState(false);
    const [availableArticles, setAvailableArticles] = useState<Article[]>([]);
    const { data: suppliers = [] } = useSuppliers();
    const [activeTab, setActiveTab] = useState<'proposals' | 'completed' | 'manual' | 'import' | 'pending' | 'commission'>('proposals');
    const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

    // Badge Counts State
    const [badgeCounts, setBadgeCounts] = useState({ proposals: 0, pending: 0, commission: 0, completed: 0 });

    // --- PROPOSALS STATE ---
    const [proposals, setProposals] = useState<OrderProposal[]>([]);
    const groupedProposals = React.useMemo(() => {
        const grouped: Record<string, OrderProposal[]> = {};
        proposals.forEach(p => {
            if (!grouped[p.supplier]) grouped[p.supplier] = [];
            grouped[p.supplier].push(p);
        });
        return grouped;
    }, [proposals]);
    const [loadingProposals, setLoadingProposals] = useState(true);

    // --- PENDING ORDERS STATE ---
    const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
    const [pickupOrders, setPickupOrders] = useState<Order[]>([]); // New state for 'ReadyForPickup'
    const [loadingPending, setLoadingPending] = useState(false);

    // --- COMPLETED ORDERS STATE ---
    const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
    const [loadingCompleted, setLoadingCompleted] = useState(false);

    // --- DETAIL VIEW STATE ---
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [selectedProposal, setSelectedProposal] = useState<OrderProposal | null>(null);

    // --- MANUAL ORDER WIZARD STATE ---
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualWarehouses, setManualWarehouses] = useState<Warehouse[]>([]);

    // --- IMPORT TAB STATE ---
    const [importCandidates, setImportCandidates] = useState<any[]>([]);
    const [loadingImport, setLoadingImport] = useState(false);
    const [selectedImportItem, setSelectedImportItem] = useState<any | null>(null);


    useEffect(() => {
        fetchProposals();
        fetchPendingOrders();
        fetchCompletedOrders();
        fetchCompletedOrders();
        fetchImportCandidates();
        fetchManualWarehouses();
    }, [profile?.primary_warehouse_id]);

    useEffect(() => {
        cleanupOldOrders();
    }, []);

    // --- LOGGING HELPER ---
    const logOrderEvent = async (orderId: string, action: string, details: string) => {
        if (!user) return;
        try {
            await supabase.from('order_events').insert({
                order_id: orderId,
                user_id: user.id,
                action: action,
                details: details
            });
        } catch (err) {
            console.error("Failed to log order event", err);
        }
    };

    // --- FETCHING ---

    const cleanupOldOrders = async () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 60); // 60 days ago

        try {
            await supabase.from('orders')
                .delete()
                .eq('status', 'Received')
                .lt('created_at', cutoffDate.toISOString());
        } catch (e) {
            console.error("Cleanup failed", e);
        }
    };

    const fetchManualWarehouses = async () => {
        const { data } = await supabase.from('warehouses').select('*').order('name');
        if (data) setManualWarehouses(data as Warehouse[]);
    };

    const fetchImportCandidates = async () => {
        setLoadingImport(true);
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 30);

            // Fetch order items without article_id from the last 30 days
            const { data, error } = await supabase
                .from('order_items')
                .select('id, custom_sku, custom_name, created_at, orders(supplier, date)')
                .is('article_id', null)
                .gte('created_at', cutoffDate.toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                // Deduplicate by custom_sku + custom_name
                const uniqueMap = new Map<string, any>();
                data.forEach((item: any) => {
                    const key = `${item.custom_sku || ''}-${item.custom_name}`;
                    if (!uniqueMap.has(key)) {
                        uniqueMap.set(key, {
                            id: item.id,
                            name: item.custom_name,
                            sku: item.custom_sku,
                            supplier: item.orders?.supplier,
                            date: item.orders?.date,
                            createdAt: item.created_at
                        });
                    }
                });
                setImportCandidates(Array.from(uniqueMap.values()));
            }
        } catch (e) {
            console.error("Error fetching import candidates", e);
        } finally {
            setLoadingImport(false);
        }
    };



    const handleOpenImport = (item: any) => {
        setSelectedOrder(null);
        setSelectedProposal(null);
        setSelectedImportItem(item);
    };

    const handleImportSuccess = async (newArticleId: string) => {
        if (!selectedImportItem) return;
        setImportCandidates(prev => prev.filter(c => c.id !== selectedImportItem.id));
        setSelectedImportItem(null);
        // Optional: Select next item automatically?
        // const currentIdx = importCandidates.findIndex(c => c.id === selectedImportItem.id);
        // if (currentIdx >= 0 && currentIdx < importCandidates.length - 1) {
        //    setSelectedImportItem(importCandidates[currentIdx + 1]);
        // }
    };

    const fetchProposals = async () => {
        setLoadingProposals(true);
        try {
            const { data: rawArticles, error } = await supabase.from('articles').select('*');
            if (error) throw error;

            if (rawArticles) {
                const articles: Article[] = rawArticles.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    sku: item.sku,
                    stock: item.stock,
                    targetStock: item.target_stock || item.min_stock || 0,
                    location: item.location || '',
                    category: item.category || '',
                    price: item.price || 0,
                    warehouseId: item.warehouse_id,
                    supplier: item.supplier,
                    supplierSku: item.supplier_sku,
                    onOrderDate: item.on_order_date,
                }));

                const proposals: OrderProposal[] = [];
                const grouped = new Map<string, {
                    warehouseId: string,
                    warehouseName: string,
                    supplier: string,
                    articles: any[]
                }>();

                const { data: whData } = await supabase.from('warehouses').select('id, name');
                const whMap = new Map<string, string>();
                if (whData) whData.forEach((w: any) => whMap.set(w.id, w.name));

                const { data: supData } = await supabase.from('suppliers').select('name, csv_format');
                const supCsvMap = new Map<string, string>();
                if (supData) supData.forEach((s: any) => supCsvMap.set(s.name, s.csv_format));

                articles.forEach(art => {
                    if (art.stock < art.targetStock && !art.onOrderDate) {
                        const whId = art.warehouseId || 'unknown';
                        const whName = whMap.get(whId) || 'Unbekanntes Lager';
                        const supp = art.supplier || 'Unbekannt';
                        const key = `${whId}::${supp}`;

                        if (!grouped.has(key)) {
                            grouped.set(key, { warehouseId: whId, warehouseName: whName, supplier: supp, articles: [] });
                        }
                        grouped.get(key)?.articles.push({ article: art, missingAmount: art.targetStock - art.stock });
                    }
                });

                grouped.forEach((val) => {
                    proposals.push({
                        warehouseId: val.warehouseId,
                        warehouseName: val.warehouseName,
                        supplier: val.supplier,
                        csvFormat: supCsvMap.get(val.supplier),
                        articles: val.articles,
                        totalItems: val.articles.length
                    });
                });

                setProposals(proposals);
                setBadgeCounts(prev => ({ ...prev, proposals: proposals.length }));
            }
        } catch (e) { console.error(e); } finally { setLoadingProposals(false); }
    };

    const fetchPendingOrders = async () => {
        setLoadingPending(true);

        const { data } = await supabase
            .from('orders')
            .select('*, warehouses(name, type), order_items(quantity_ordered, articles(name), custom_name)')
            .neq('status', 'Received')
            .order('created_at', { ascending: false });

        if (data) {
            const mapped = data.map((o: any) => ({
                ...o,
                commissionNumber: o.commission_number,
                supplierOrderNumber: o.supplier_order_number,
                warehouseName: o.warehouses?.name,
                warehouseType: o.warehouses?.type,
                items: o.order_items?.map((i: any) => ({
                    quantityOrdered: i.quantity_ordered,
                    articleName: i.articles?.name || i.custom_name || 'Unbekannter Artikel'
                }))
            })) as Order[];

            const pending = mapped.filter(o => o.status !== 'ReadyForPickup');
            const pickup = mapped.filter(o => o.status === 'ReadyForPickup');

            setPendingOrders(pending);
            setPickupOrders(pickup);

            setBadgeCounts(prev => ({
                ...prev,
                pending: pending.length,
                commission: pickup.length
            }));

            // Note: If we had a currently selected order, we might want to update it if it changed, 
            // but MasterDetailLayout content components usually handle their own data fetching or we pass fresh data.
            // But here we rely on the list refresh. The detail component fetches its own items.
        }
        setLoadingPending(false);
    };

    const fetchCompletedOrders = async () => {
        setLoadingCompleted(true);
        const { data } = await supabase
            .from('orders')
            .select('*, warehouses(name, type), order_items(quantity_ordered, articles(name), custom_name)')
            .eq('status', 'Received')
            .order('created_at', { ascending: false });

        if (data) {
            const mapped = data.map((o: any) => ({
                ...o,
                commissionNumber: o.commission_number,
                supplierOrderNumber: o.supplier_order_number,
                warehouseName: o.warehouses?.name,
                warehouseType: o.warehouses?.type,
                items: o.order_items?.map((i: any) => ({
                    quantityOrdered: i.quantity_ordered,
                    articleName: i.articles?.name || i.custom_name || 'Unbekannter Artikel'
                }))
            })) as Order[];
            setCompletedOrders(mapped);
            setBadgeCounts(prev => ({ ...prev, completed: mapped.length }));
        }
        setLoadingCompleted(false);
    };

    const handleDeleteOrder = async (orderId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("Bestellung wirklich unwiderruflich löschen?")) return;

        try {
            await supabase.from('orders').delete().eq('id', orderId);
            fetchCompletedOrders();
            fetchPendingOrders();
            if (selectedOrder?.id === orderId) {
                handleCloseDetail();
            }
        } catch (e: any) {
            alert("Fehler: " + e.message);
        }
    };

    const handleDownloadCsv = (order: Order) => {
        supabase.from('order_items').select('*, articles(name, sku, supplier_sku)').eq('order_id', order.id)
            .then(({ data }) => {
                if (!data) return;
                const csvContent = "data:text/csv;charset=utf-8,"
                    + "Artikelnummer;Bezeichnung;Menge\n"
                    + data.map((i: any) => `${i.articles?.supplier_sku || i.articles?.sku || i.custom_sku || ''};${i.articles?.name || i.custom_name};${i.quantity_ordered}`).join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `Bestellung_${order.supplier}_${order.date}.csv`);
                document.body.appendChild(link);
                link.click();
            });
    };

    // --- MANUAL ORDER LOGIC ---
    const handleOpenManualOrder = () => {
        setShowManualModal(true);
    };

    // --- VIEW HANDLERS ---

    // Open Proposal -> Detail Layout
    const handleOpenProposal = (proposal: OrderProposal) => {
        setSelectedOrder(null);
        setSelectedProposal(proposal);
    };

    // Open Order -> Detail Layout
    const handleOpenOrder = (order: Order) => {
        setSelectedProposal(null);
        setSelectedOrder(order);
    };

    const handleCloseDetail = () => {
        setSelectedOrder(null);
        setSelectedProposal(null);
        setSelectedImportItem(null);
    };

    const handleOrderCreated = () => {
        handleCloseDetail();
        fetchProposals();
        fetchPendingOrders();
        setActiveTab('pending');
    }

    const handleOrderUpdate = () => {
        fetchPendingOrders();
        fetchCompletedOrders();
        // Don't close details here, user might want to continue receiving or review status
        if (selectedOrder) {
            // Refresh selected order status if needed (though local update handles items)
            // We can re-fetch just the order status if we want live status update in list
        }
    };


    // --- LIST CONTENT RENDER ---
    const OrderSidebar = () => (
        <div className="flex flex-col gap-1 py-2 h-full overflow-y-auto custom-scrollbar pr-2">
            <button
                onClick={() => { setActiveTab('proposals'); setSelectedSupplier(null); setIsMobileCategoryOpen(false); }}
                className={clsx(
                    "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 text-left group w-full gap-3",
                    activeTab === 'proposals' && !selectedSupplier ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "text-muted-foreground hover:text-white hover:bg-muted"
                )}
            >
                <div className="flex items-center gap-3">
                    <Send size={18} className={clsx(activeTab === 'proposals' && !selectedSupplier ? "text-blue-400" : "text-muted-foreground group-hover:text-muted-foreground")} />
                    <span className="font-medium text-sm">Vorschläge</span>
                </div>
                {badgeCounts.proposals > 0 && <span className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full">{badgeCounts.proposals}</span>}
            </button>

            {activeTab === 'proposals' && Object.keys(groupedProposals).length > 0 && (
                <div className="flex flex-col gap-1 pl-4 mb-2">
                    <div className="w-px h-2 bg-muted ml-4"></div>
                    {Object.keys(groupedProposals).map(supplier => (
                        <button
                            key={supplier}
                            onClick={() => { setSelectedSupplier(supplier); setIsMobileCategoryOpen(false); }}
                            className={clsx(
                                "flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 text-left group w-full gap-2",
                                selectedSupplier === supplier ? "bg-blue-500/10 text-blue-300 border border-blue-500/20" : "text-muted-foreground hover:text-white hover:bg-muted"
                            )}
                        >
                            <span className="text-xs font-medium truncate">{supplier}</span>
                            <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full">{groupedProposals[supplier].length}</span>
                        </button>
                    ))}
                </div>
            )}

            <button
                onClick={() => { setActiveTab('pending'); setSelectedSupplier(null); setIsMobileCategoryOpen(false); }}
                className={clsx(
                    "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 text-left group w-full gap-3",
                    activeTab === 'pending' ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "text-muted-foreground hover:text-white hover:bg-muted"
                )}
            >
                <div className="flex items-center gap-3">
                    <Clock size={18} className={clsx(activeTab === 'pending' ? "text-blue-400" : "text-muted-foreground group-hover:text-muted-foreground")} />
                    <span className="font-medium text-sm">Offen</span>
                </div>
                {badgeCounts.pending > 0 && <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{badgeCounts.pending}</span>}
            </button>

            <button
                onClick={() => { setActiveTab('commission'); setIsMobileCategoryOpen(false); }}
                className={clsx(
                    "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 text-left group w-full gap-3",
                    activeTab === 'commission' ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-muted-foreground hover:text-white hover:bg-muted"
                )}
            >
                <div className="flex items-center gap-3">
                    <ClipboardList size={18} className={clsx(activeTab === 'commission' ? "text-amber-400" : "text-muted-foreground group-hover:text-muted-foreground")} />
                    <span className="font-medium text-sm">Kommissionen</span>
                </div>
                {badgeCounts.commission > 0 && <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{badgeCounts.commission}</span>}
            </button>

            <button
                onClick={() => { setActiveTab('completed'); setIsMobileCategoryOpen(false); }}
                className={clsx(
                    "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 text-left group w-full gap-3",
                    activeTab === 'completed' ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "text-muted-foreground hover:text-white hover:bg-muted"
                )}
            >
                <div className="flex items-center gap-3">
                    <CheckCircle2 size={18} className={clsx(activeTab === 'completed' ? "text-blue-400" : "text-muted-foreground group-hover:text-muted-foreground")} />
                    <span className="font-medium text-sm">Erledigt</span>
                </div>
            </button>

            <div className="h-px bg-muted my-2 mx-4" />

            <button
                onClick={() => { setActiveTab('import'); setIsMobileCategoryOpen(false); }}
                className={clsx(
                    "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 text-left group w-full gap-3",
                    activeTab === 'import' ? "bg-primary/20 text-emerald-400 border border-emerald-500/30" : "text-muted-foreground hover:text-white hover:bg-muted"
                )}
            >
                <div className="flex items-center gap-3">
                    <Plus size={18} className={clsx(activeTab === 'import' ? "text-emerald-400" : "text-muted-foreground group-hover:text-muted-foreground")} />
                    <span className="font-medium text-sm">Neu anlegen</span>
                </div>
                {importCandidates.length > 0 && <span className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full">{importCandidates.length}</span>}
            </button>
        </div>
    );

    const renderListContent = () => (
        <div className="relative h-full flex flex-col overflow-hidden">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1 pt-4 pb-4 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-3">
                    {isMobile && (
                        <button 
                            onClick={() => setIsMobileCategoryOpen(true)}
                            className="p-2.5 rounded-xl bg-muted text-blue-400 border border-border active:scale-95 transition-transform"
                        >
                            <Menu size={20} />
                        </button>
                    )}
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">
                            Bestellwesen
                        </h1>
                        <p className="text-muted-foreground hidden sm:block text-xs mt-1">Automatische Vorschläge & Bestellungen.</p>
                    </div>
                </div>
                <Button icon={<Plus size={18} />} onClick={handleOpenManualOrder}>Manuell</Button>
            </header>

            <div className="flex h-full overflow-hidden mt-2">
                {/* Desktop Sidebar */}
                {!isMobile && (
                    <aside className="w-64 flex-shrink-0 border-r border-white/5 flex flex-col pr-4 animate-in slide-in-from-left duration-500">
                        <div className="px-4 py-2 flex items-center gap-2 text-muted-foreground uppercase tracking-widest text-[10px] font-bold">
                            <Filter size={10} />
                            Ansicht
                        </div>
                        <OrderSidebar />
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
                                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
                            />
                            <motion.aside
                                initial={{ x: '-100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '-100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="fixed inset-y-0 left-0 w-[80%] max-w-sm bg-background border-r border-border shadow-2xl z-50 flex flex-col"
                            >
                                <div className="p-4 border-b border-border flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-blue-400 font-bold uppercase tracking-wider text-sm">
                                        <Filter size={16} /> Ansicht
                                    </div>
                                    <button onClick={() => setIsMobileCategoryOpen(false)} className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-white">
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="p-2 flex-1 overflow-hidden">
                                    <OrderSidebar />
                                </div>
                            </motion.aside>
                        </>
                    )}
                </AnimatePresence>

                {/* Content Area */}
                <div className="flex-1 h-full overflow-hidden flex flex-col lg:pl-4">
                    <div className="flex-1 overflow-y-auto custom-scrollbar pb-24 pr-2">
                        {/* --- CONTENT: PROPOSALS --- */}
                        {activeTab === 'proposals' && (
                            <div className="space-y-6 mt-2">
                                {loadingProposals ? <Loader2 className="animate-spin text-blue-400 mx-auto" /> : (
                                    Object.keys(groupedProposals).length === 0 ? (
                                        <div className="text-center text-muted-foreground py-10 border border-dashed border-border rounded-xl">Keine Nachbestellungen nötig.</div>
                                    ) : (
                                        Object.entries(groupedProposals)
                                            .filter(([supplier, _]) => !selectedSupplier || supplier === selectedSupplier)
                                            .map(([supplier, proposals]) => (
                                            <div key={supplier} className="space-y-3">
                                                <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-wider pl-2">{supplier}</h3>
                                                {(proposals as OrderProposal[]).map((prop, idx) => (
                                                    <GlassCard
                                                        key={idx}
                                                        className={`cursor-pointer hover:bg-muted transition-colors ${selectedProposal === prop ? 'border-blue-500/50 bg-blue-500/10' : ''}`}
                                                        onClick={() => handleOpenProposal(prop)}
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-300"><ShoppingCart size={18} /></div>
                                                                <div>
                                                                    <div className="font-bold text-white">{prop.warehouseName}</div>
                                                                    <div className="text-xs text-muted-foreground">{prop.totalItems} Artikel unter Bestand</div>
                                                                </div>
                                                            </div>
                                                            <ArrowDownToLine size={18} className="text-muted-foreground" />
                                                        </div>
                                                    </GlassCard>
                                                ))}
                                            </div>
                                        ))
                                    )
                                )}
                            </div>
                        )}

                        {activeTab === 'import' && (
                            <div className="space-y-4 mt-2">
                                <div className="text-xs text-muted-foreground text-center mb-4">
                                    Artikel aus Bestellungen der letzten 30 Tage, die noch nicht im Lagerbestand sind.
                                </div>
                                {loadingImport ? <Loader2 className="animate-spin text-blue-400 mx-auto" /> : (
                                    importCandidates.map((item, idx) => (
                                        <GlassCard
                                            key={idx}
                                            className={`flex flex-col gap-3 group border-emerald-500/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors ${selectedImportItem?.id === item.id ? 'bg-primary/20 border-emerald-500/40' : ''}`}
                                            onClick={() => handleOpenImport(item)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-white flex items-center gap-2">
                                                        {item.name || 'Unbenannt'}
                                                    </h3>
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.sku ? <span className="font-mono bg-muted px-1 rounded mr-2">{item.sku}</span> : null}
                                                        {item.supplier} • {new Date(item.date).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <Button
                                                    onClick={(e) => { e.stopPropagation(); handleOpenImport(item); }}
                                                    className="bg-primary hover:bg-primary h-8 text-xs"
                                                    icon={<Plus size={14} />}
                                                >
                                                    Übernehmen
                                                </Button>
                                            </div>
                                        </GlassCard>
                                    ))
                                )}
                                {!loadingImport && importCandidates.length === 0 && (
                                    <div className="text-center text-muted-foreground py-8 border border-dashed border-border rounded-xl">
                                        Keine importierbaren Artikel gefunden.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* --- CONTENT: PENDING ORDERS --- */}
                        {activeTab === 'pending' && (
                            <div className="space-y-4 mt-2">
                                {pendingOrders
                                    .filter(order => !selectedSupplier || order.supplier === selectedSupplier)
                                    .map(order => (
                                    <GlassCard
                                        key={order.id}
                                        className={`flex flex-col gap-3 cursor-pointer hover:bg-muted transition-colors group ${selectedOrder?.id === order.id ? 'border-blue-500/50 bg-blue-500/10' : ''}`}
                                        onClick={() => handleOpenOrder(order)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-white group-hover:text-blue-300 transition-colors flex items-center gap-2">
                                                    {order.supplier}
                                                    {order.warehouseType === 'Vehicle' && <Truck size={14} className="text-blue-400" />}
                                                </h3>
                                                <p className="text-xs text-muted-foreground">{new Date(order.date).toLocaleDateString()} • {order.warehouseName}</p>
                                                {order.supplierOrderNumber && <p className="text-xs text-muted-foreground font-mono mt-1">Auftrag: {order.supplierOrderNumber}</p>}
                                            </div>
                                            <StatusBadge status={order.status} />
                                        </div>

                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {order.items && order.items.slice(0, 8).map((item: any, idx: number) => (
                                                <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted border border-border text-muted-foreground truncate max-w-[150px]">
                                                    {item.articleName}
                                                </span>
                                            ))}
                                            {order.items && order.items.length > 8 && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted border border-border text-muted-foreground">
                                                    +{order.items.length - 8} weitere
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-border">
                                            <span className="text-sm text-muted-foreground">{order.itemCount} Positionen</span>
                                            <div className="flex gap-2">
                                                {order.commissionNumber && (
                                                    <span className="flex items-center gap-1 text-[10px] font-mono bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                                                        <Box size={10} /> {order.commissionNumber}
                                                    </span>
                                                )}
                                                <button onClick={(e) => { e.stopPropagation(); handleDownloadCsv(order); }} className="p-2 text-emerald-400 hover:bg-primary/10 rounded-lg flex items-center gap-2 text-xs font-bold transition-colors">
                                                    <FileDown size={14} /> CSV
                                                </button>
                                            </div>
                                        </div>
                                    </GlassCard>
                                ))}
                                {pendingOrders.length === 0 && <div className="text-center text-muted-foreground py-8">Keine offenen Bestellungen.</div>}
                            </div>
                        )}

                        {/* --- CONTENT: COMPLETED ORDERS --- */}
                        {activeTab === 'completed' && (
                            <div className="space-y-4 mt-2">
                                <div className="text-xs text-muted-foreground text-center mb-4">Automatische Löschung nach 60 Tagen.</div>
                                {loadingCompleted ? <Loader2 className="animate-spin text-blue-400 mx-auto" /> : (
                                    completedOrders.map(order => (
                                        <GlassCard
                                            key={order.id}
                                            className={`flex flex-col gap-3 cursor-pointer hover:bg-muted transition-colors group opacity-70 hover:opacity-100 ${selectedOrder?.id === order.id ? 'border-blue-500/50 bg-blue-500/10' : ''}`}
                                            onClick={() => handleOpenOrder(order)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-white group-hover:text-blue-300 transition-colors flex items-center gap-2">
                                                        {order.supplier}
                                                    </h3>
                                                    <p className="text-xs text-muted-foreground">{new Date(order.date).toLocaleDateString()} • {order.warehouseName}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <StatusBadge status={order.status} />
                                                    <button onClick={(e) => handleDeleteOrder(order.id, e)} className="p-1 hover:text-red-400 text-muted-foreground"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {order.itemCount} Positionen • Archiviert
                                            </div>
                                        </GlassCard>
                                    ))
                                )}
                                {completedOrders.length === 0 && <div className="text-center text-muted-foreground py-8">Archiv leer.</div>}
                            </div>
                        )}

                        {/* --- CONTENT: PICKUP ORDERS --- */}
                        {activeTab === 'commission' && (
                            <div className="space-y-4 mt-2">
                                <div className="text-xs text-amber-200/60 uppercase tracking-wider font-bold pl-2 mb-2 flex items-center gap-2">
                                    <AlertTriangle size={12} /> Ware ist da - wartet auf Abholung / Verladung
                                </div>
                                {pickupOrders.map(order => (
                                    <GlassCard
                                        key={order.id}
                                        className={`flex flex-col gap-3 cursor-pointer hover:bg-muted transition-colors group border-amber-500/30 bg-amber-500/5 ${selectedOrder?.id === order.id ? 'border-amber-400/50 bg-amber-500/20' : ''}`}
                                        onClick={() => handleOpenOrder(order)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-white group-hover:text-amber-300 transition-colors flex items-center gap-2">
                                                    {order.supplier}
                                                    {order.warehouseType === 'Vehicle' && <Truck size={14} className="text-amber-400" />}
                                                </h3>
                                                <p className="text-xs text-muted-foreground">{new Date(order.date).toLocaleDateString()} • {order.warehouseName}</p>
                                            </div>
                                            <StatusBadge status={order.status} />
                                        </div>

                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {order.items && order.items.slice(0, 8).map((item: any, idx: number) => (
                                                <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-100/60 truncate max-w-[150px]">
                                                    {item.articleName}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-border">
                                            <span className="text-sm text-muted-foreground">{order.itemCount} Positionen</span>
                                            <div className="text-xs text-amber-300 flex items-center gap-1">
                                                <Archive size={14} /> Abholbereit
                                            </div>
                                        </div>
                                    </GlassCard>
                                ))}
                                {pickupOrders.length === 0 && <div className="text-center text-muted-foreground py-8">Keine Kommissionen zur Abholung bereit.</div>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    // --- MAIN RENDER ---
    return (
        <MasterDetailLayout
            title="Bestellwesen"
            listContent={renderListContent()}
            detailContent={
                selectedProposal ? (
                    <OrderProposalContent
                        proposal={selectedProposal}
                        onClose={handleCloseDetail}
                        onOrderCreated={handleOrderCreated}
                    />
                ) : selectedOrder ? (
                    <OrderDetailContent
                        order={selectedOrder}
                        onClose={handleCloseDetail}
                        onUpdate={handleOrderUpdate}
                    />
                ) : selectedImportItem ? (
                    <OrderImportDetailContent
                        importItem={selectedImportItem}
                        warehouses={manualWarehouses}
                        suppliers={suppliers}
                        onClose={handleCloseDetail}
                        onSuccess={handleImportSuccess}
                    />
                ) : null
            }
            isOpen={!!selectedOrder || !!selectedProposal || !!selectedImportItem}
            onClose={handleCloseDetail}
            hideHeader={!!selectedImportItem}
        >
            {/* --- MANUAL ORDER MODAL (WIZARD) --- */}
            <ManualOrderWizardModal
                isOpen={showManualModal}
                onClose={() => setShowManualModal(false)}
                warehouses={manualWarehouses}
                suppliers={suppliers}
                onOrderCreated={() => {
                    fetchPendingOrders();
                    fetchProposals();
                    setActiveTab('pending');
                }}
            />

        </MasterDetailLayout>
    );
};

export default Orders;