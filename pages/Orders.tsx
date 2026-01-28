import React, { useEffect, useState, useRef } from 'react';
import { GlassCard, Button, GlassInput, GlassSelect, StatusBadge, GlassModal } from '../components/UIComponents';
import { AddArticleModal } from '../components/AddArticleModal';
import { Article, Order, OrderItem, Supplier, OrderProposal, WarehouseType, Warehouse } from '../types';
import { ShoppingCart, CheckCircle2, Loader2, Send, Copy, FileDown, Check, X, ClipboardList, Truck, Search, Box, Barcode, MapPin, Plus, Minus, PackageCheck, ArrowDownToLine, ChevronDown, ChevronUp, Clock, AlertTriangle, Archive, FileText, Sparkles, Upload, Trash2, Link as LinkIcon, Wand2, Eye, Warehouse as WarehouseIcon, RefreshCw, HardHat } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GoogleGenAI, Type } from "@google/genai";
import { MasterDetailLayout } from '../components/MasterDetailLayout';
import { OrderDetailContent } from '../components/orders/OrderDetailContent';
import { OrderProposalContent } from '../components/orders/OrderProposalContent';
import { OrderImportDetailContent } from '../components/orders/OrderImportDetailContent';

const Orders: React.FC = () => {
    const navigate = useNavigate();
    const { profile, user } = useAuth();
    const [activeTab, setActiveTab] = useState<'proposals' | 'pending' | 'commission' | 'completed' | 'import'>('proposals');

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
    const [manualWarehouseId, setManualWarehouseId] = useState('');
    const [manualSourceType, setManualSourceType] = useState<'primary' | 'secondary' | 'other' | null>(null);
    const [manualCommissionNumber, setManualCommissionNumber] = useState('');
    const [manualSupplierName, setManualSupplierName] = useState('');
    const [manualAiFile, setManualAiFile] = useState<File | null>(null);
    const [manualAiPreview, setManualAiPreview] = useState<string | null>(null);
    const [isManualAnalyzing, setIsManualAnalyzing] = useState(false);
    const [manualScannedItems, setManualScannedItems] = useState<{ sku: string, name: string, quantity: number, foundArticle?: Article, isFound: boolean }[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const manualFileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // --- MANUAL ADD ITEM STATE ---
    const [showAddItemForm, setShowAddItemForm] = useState(false);
    const [manualItemName, setManualItemName] = useState('');
    const [manualItemSku, setManualItemSku] = useState('');
    const [manualItemQuantity, setManualItemQuantity] = useState(1);

    // --- SUCCESS MODAL STATE ---
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
    const [createdOrderCommission, setCreatedOrderCommission] = useState<string | null>(null);
    const [createdOrderSupplierNumber, setCreatedOrderSupplierNumber] = useState('');
    const [supplierNumberSaved, setSupplierNumberSaved] = useState(false);

    // --- IMPORT TAB STATE ---
    const [importCandidates, setImportCandidates] = useState<any[]>([]);
    const [loadingImport, setLoadingImport] = useState(false);
    const [selectedImportItem, setSelectedImportItem] = useState<any | null>(null);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);


    useEffect(() => {
        fetchProposals();
        fetchPendingOrders();
        fetchCompletedOrders();
        fetchManualWarehouses();
        fetchImportCandidates();
        fetchSuppliers();
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

    const fetchSuppliers = async () => {
        const { data } = await supabase.from('suppliers').select('*').order('name');
        if (data) setSuppliers(data as Supplier[]);
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
        setManualWarehouseId('');
        setManualSourceType(null);
        setManualCommissionNumber('');
        setManualAiFile(null);
        setManualAiPreview(null);
        setManualScannedItems([]);
        setManualSupplierName('');
        setShowManualModal(true);

        if (profile?.primary_warehouse_id) {
            handleManualWarehouseSelect(profile.primary_warehouse_id, 'primary');
        }
    };

    const handleManualAddItem = () => {
        if (!manualItemName) return;
        setManualScannedItems(prev => [
            {
                name: manualItemName,
                sku: manualItemSku,
                quantity: manualItemQuantity,
                isFound: false,
                foundArticle: undefined
            },
            ...prev
        ]);
        setManualItemName('');
        setManualItemSku('');
        setManualItemQuantity(1);
        setShowAddItemForm(false);
    };

    const handleRemoveManualItem = (index: number) => {
        setManualScannedItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleManualWarehouseSelect = async (whId: string, type: 'primary' | 'secondary' | 'other') => {
        setManualWarehouseId(whId);
        setManualSourceType(type);

        try {
            const { count } = await supabase.from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('warehouse_id', whId);

            const wh = manualWarehouses.find(w => w.id === whId);
            const safeName = wh?.name.replace(/[^a-zA-Z0-9]/g, '') || 'Lager';
            const nextNum = (count || 0) + 1;
            setManualCommissionNumber(`${safeName}-${nextNum.toString().padStart(4, '0')}`);
        } catch (e) {
            console.error(e);
        }
    };

    const handleManualFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setManualAiFile(file);
            const reader = new FileReader();
            reader.onload = (ev) => setManualAiPreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            const event = {
                target: { files: [file] }
            } as unknown as React.ChangeEvent<HTMLInputElement>;

            handleManualFileSelect(event);
        }
    };

    const getApiKey = () => {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
        try { if (process.env.API_KEY) return process.env.API_KEY; } catch (e) { } return '';
    };

    const analyzeDocument = async () => {
        if (!manualAiFile) return;
        setIsManualAnalyzing(true);
        const apiKey = getApiKey();
        if (!apiKey) { alert("API Key fehlt."); setIsManualAnalyzing(false); return; }

        try {
            const ai = new GoogleGenAI({ apiKey: apiKey });
            const reader = new FileReader();
            await new Promise((resolve) => { reader.onload = resolve; reader.readAsDataURL(manualAiFile); });
            const base64Data = (reader.result as string).split(',')[1];

            const prompt = `
            Extract order items from this document.
            Return a JSON object with:
            - supplier_name: string (if detected)
            - items: array of objects with { sku: string (manufacturer or supplier part number), name: string, quantity: number }
            
            Ignore prices.
          `;

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [
                    { inlineData: { mimeType: manualAiFile.type, data: base64Data } },
                    { text: prompt }
                ],
                config: { responseMimeType: "application/json" }
            });

            if (response.text) {
                let text = response.text.trim();
                if (text.startsWith('```')) {
                    text = text.replace(/^```(json)?\s*/, '').replace(/\s*```$/, '');
                }
                const result = JSON.parse(text);
                if (result.supplier_name) setManualSupplierName(result.supplier_name);

                const scanned = result.items || [];

                const matchedItems = await Promise.all(scanned.map(async (item: any) => {
                    let query = supabase.from('articles')
                        .select('*')
                        .or(`sku.eq.${item.sku},supplier_sku.eq.${item.sku},ean.eq.${item.sku}`)
                        .limit(1);

                    if (manualWarehouseId) {
                        query = query.eq('warehouse_id', manualWarehouseId);
                    }

                    const { data } = await query;

                    return {
                        sku: item.sku,
                        name: item.name,
                        quantity: item.quantity,
                        foundArticle: data && data.length > 0 ? data[0] : undefined,
                        isFound: !!(data && data.length > 0)
                    };
                }));

                setManualScannedItems(matchedItems);
            }
        } catch (e: any) {
            alert("KI Fehler: " + e.message);
        } finally {
            setIsManualAnalyzing(false);
        }
    };

    const handleResetManualScan = () => {
        setManualAiFile(null);
        setManualAiPreview(null);
        setManualScannedItems([]);
        setManualSupplierName('');
    };

    const saveManualOrder = async () => {
        if (!manualWarehouseId || manualScannedItems.length === 0) return;
        setIsSubmitting(true);
        try {
            const { data: orderData, error } = await supabase.from('orders').insert({
                supplier: manualSupplierName || 'Manuell',
                date: new Date().toISOString(),
                status: 'Ordered',
                item_count: manualScannedItems.length,
                total: 0,
                warehouse_id: manualWarehouseId,
                commission_number: manualCommissionNumber
            }).select().single();

            if (error) throw error;

            for (const item of manualScannedItems) {
                const payload: any = {
                    order_id: orderData.id,
                    quantity_ordered: item.quantity
                };

                if (item.isFound && item.foundArticle) {
                    payload.article_id = item.foundArticle.id;
                    await supabase.from('articles').update({ on_order_date: new Date().toISOString() }).eq('id', item.foundArticle.id);
                } else {
                    payload.custom_name = item.name;
                    payload.custom_sku = item.sku;
                }

                await supabase.from('order_items').insert(payload);
            }

            await logOrderEvent(orderData.id, 'Neue Bestellung', `Manuelle Bestellung bei ${manualSupplierName || 'Manuell'}`);

            // Replace Alert with Success Modal
            setCreatedOrderId(orderData.id);
            setCreatedOrderCommission(manualCommissionNumber);
            setCreatedOrderSupplierNumber('');
            setShowManualModal(false);
            setShowSuccessModal(true);

            fetchPendingOrders();
            fetchProposals();
            setActiveTab('pending');

        } catch (e: any) {
            alert("Fehler: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateOrderSupplierNumber = async () => {
        if (!createdOrderId) return;
        try {
            const { error } = await supabase.from('orders').update({ supplier_order_number: createdOrderSupplierNumber }).eq('id', createdOrderId);
            if (error) throw error;

            setSupplierNumberSaved(true);
            setTimeout(() => setSupplierNumberSaved(false), 2000);

            // Refresh logic if needed, but the user might just close the modal
            fetchPendingOrders();
        } catch (e: any) {
            alert("Fehler beim Speichern: " + e.message);
        }
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
    const renderListContent = () => (
        <div className="space-y-6 pb-24">
            <header className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">
                        Bestellwesen
                    </h1>
                    <p className="text-white/50">Automatische Vorschläge & Bestellungen.</p>
                </div>
                <Button icon={<Plus size={18} />} onClick={handleOpenManualOrder}>Manuell</Button>
            </header>

            {/* TABS */}
            <div className="flex gap-2 p-1 bg-black/20 rounded-xl border border-white/5 overflow-x-auto">
                <button onClick={() => setActiveTab('proposals')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'proposals' ? 'bg-white/10 text-white shadow' : 'text-white/50'}`}>
                    <Send size={16} /> Vorschläge
                    {badgeCounts.proposals > 0 && <span className="bg-emerald-500 text-white text-[10px] px-1.5 rounded-full">{badgeCounts.proposals}</span>}
                </button>

                <button onClick={() => setActiveTab('pending')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'pending' ? 'bg-white/10 text-white shadow' : 'text-white/50'}`}>
                    <Clock size={16} /> Offen
                    {badgeCounts.pending > 0 && <span className="bg-blue-500 text-white text-[10px] px-1.5 rounded-full">{badgeCounts.pending}</span>}
                </button>
                <button onClick={() => setActiveTab('commission')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'commission' ? 'bg-white/10 text-white shadow' : 'text-white/50'}`}>
                    <ClipboardList size={16} /> Kom.
                    {badgeCounts.commission > 0 && <span className="bg-amber-500 text-white text-[10px] px-1.5 rounded-full">{badgeCounts.commission}</span>}
                </button>
                <button onClick={() => setActiveTab('completed')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'completed' ? 'bg-white/10 text-white shadow' : 'text-white/50'}`}>
                    <CheckCircle2 size={16} /> Erledigt
                </button>
                <button onClick={() => setActiveTab('import')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'import' ? 'bg-white/10 text-white shadow' : 'text-white/50'}`}>
                    <Plus size={16} className="text-emerald-400" /> Import
                    {importCandidates.length > 0 && <span className="bg-emerald-500 text-white text-[10px] px-1.5 rounded-full">{importCandidates.length}</span>}
                </button>
            </div>

            {/* --- CONTENT: PROPOSALS --- */}
            {activeTab === 'proposals' && (
                <div className="space-y-6">
                    {loadingProposals ? <Loader2 className="animate-spin text-blue-400 mx-auto" /> : (
                        Object.keys(groupedProposals).length === 0 ? (
                            <div className="text-center text-white/30 py-10 border border-dashed border-white/10 rounded-xl">Keine Nachbestellungen nötig.</div>
                        ) : (
                            Object.entries(groupedProposals).map(([supplier, proposals]) => (
                                <div key={supplier} className="space-y-3">
                                    <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider pl-2">{supplier}</h3>
                                    {(proposals as OrderProposal[]).map((prop, idx) => (
                                        <GlassCard
                                            key={idx}
                                            className={`cursor-pointer hover:bg-white/5 transition-colors ${selectedProposal === prop ? 'border-blue-500/50 bg-blue-500/10' : ''}`}
                                            onClick={() => handleOpenProposal(prop)}
                                        >
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-300"><ShoppingCart size={18} /></div>
                                                    <div>
                                                        <div className="font-bold text-white">{prop.warehouseName}</div>
                                                        <div className="text-xs text-white/50">{prop.totalItems} Artikel unter Bestand</div>
                                                    </div>
                                                </div>
                                                <ArrowDownToLine size={18} className="text-white/30" />
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
                <div className="space-y-4">
                    <div className="text-xs text-white/30 text-center mb-4">
                        Artikel aus Bestellungen der letzten 30 Tage, die noch nicht im Lagerbestand sind.
                    </div>
                    {loadingImport ? <Loader2 className="animate-spin text-blue-400 mx-auto" /> : (
                        importCandidates.map((item, idx) => (
                            <GlassCard
                                key={idx}
                                className={`flex flex-col gap-3 group border-emerald-500/20 bg-emerald-500/5 cursor-pointer hover:bg-emerald-500/10 transition-colors ${selectedImportItem?.id === item.id ? 'bg-emerald-500/20 border-emerald-500/40' : ''}`}
                                onClick={() => handleOpenImport(item)}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-white flex items-center gap-2">
                                            {item.name || 'Unbenannt'}
                                        </h3>
                                        <p className="text-xs text-white/50">
                                            {item.sku ? <span className="font-mono bg-white/10 px-1 rounded mr-2">{item.sku}</span> : null}
                                            {item.supplier} • {new Date(item.date).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <Button
                                        onClick={(e) => { e.stopPropagation(); handleOpenImport(item); }}
                                        className="bg-emerald-600 hover:bg-emerald-500 h-8 text-xs"
                                        icon={<Plus size={14} />}
                                    >
                                        Übernehmen
                                    </Button>
                                </div>
                            </GlassCard>
                        ))
                    )}
                    {!loadingImport && importCandidates.length === 0 && (
                        <div className="text-center text-white/30 py-8 border border-dashed border-white/10 rounded-xl">
                            Keine importierbaren Artikel gefunden.
                        </div>
                    )}
                </div>
            )}

            {/* --- CONTENT: PENDING ORDERS --- */}
            {activeTab === 'pending' && (
                <div className="space-y-4">
                    {pendingOrders.map(order => (
                        <GlassCard
                            key={order.id}
                            className={`flex flex-col gap-3 cursor-pointer hover:bg-white/5 transition-colors group ${selectedOrder?.id === order.id ? 'border-blue-500/50 bg-blue-500/10' : ''}`}
                            onClick={() => handleOpenOrder(order)}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-white group-hover:text-blue-300 transition-colors flex items-center gap-2">
                                        {order.supplier}
                                        {order.warehouseType === 'Vehicle' && <Truck size={14} className="text-blue-400" />}
                                    </h3>
                                    <p className="text-xs text-white/50">{new Date(order.date).toLocaleDateString()} • {order.warehouseName}</p>
                                    {order.supplierOrderNumber && <p className="text-xs text-white/30 font-mono mt-1">Auftrag: {order.supplierOrderNumber}</p>}
                                </div>
                                <StatusBadge status={order.status} />
                            </div>

                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {order.items && order.items.slice(0, 8).map((item: any, idx: number) => (
                                    <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 border border-white/10 text-white/60 truncate max-w-[150px]">
                                        {item.articleName}
                                    </span>
                                ))}
                                {order.items && order.items.length > 8 && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 border border-white/10 text-white/40">
                                        +{order.items.length - 8} weitere
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-white/10">
                                <span className="text-sm text-white/70">{order.itemCount} Positionen</span>
                                <div className="flex gap-2">
                                    {order.commissionNumber && (
                                        <span className="flex items-center gap-1 text-[10px] font-mono bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                                            <Box size={10} /> {order.commissionNumber}
                                        </span>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); handleDownloadCsv(order); }} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg flex items-center gap-2 text-xs font-bold transition-colors">
                                        <FileDown size={14} /> CSV
                                    </button>
                                </div>
                            </div>
                        </GlassCard>
                    ))}
                    {pendingOrders.length === 0 && <div className="text-center text-white/30 py-8">Keine offenen Bestellungen.</div>}
                </div>
            )}

            {/* --- CONTENT: COMPLETED ORDERS --- */}
            {activeTab === 'completed' && (
                <div className="space-y-4">
                    <div className="text-xs text-white/30 text-center mb-4">Automatische Löschung nach 60 Tagen.</div>
                    {loadingCompleted ? <Loader2 className="animate-spin text-blue-400 mx-auto" /> : (
                        completedOrders.map(order => (
                            <GlassCard
                                key={order.id}
                                className={`flex flex-col gap-3 cursor-pointer hover:bg-white/5 transition-colors group opacity-70 hover:opacity-100 ${selectedOrder?.id === order.id ? 'border-blue-500/50 bg-blue-500/10' : ''}`}
                                onClick={() => handleOpenOrder(order)}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-white group-hover:text-blue-300 transition-colors flex items-center gap-2">
                                            {order.supplier}
                                        </h3>
                                        <p className="text-xs text-white/50">{new Date(order.date).toLocaleDateString()} • {order.warehouseName}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <StatusBadge status={order.status} />
                                        <button onClick={(e) => handleDeleteOrder(order.id, e)} className="p-1 hover:text-red-400 text-white/30"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                                <div className="text-xs text-white/30">
                                    {order.itemCount} Positionen • Archiviert
                                </div>
                            </GlassCard>
                        ))
                    )}
                    {completedOrders.length === 0 && <div className="text-center text-white/30 py-8">Archiv leer.</div>}
                </div>
            )}

            {/* --- CONTENT: PICKUP ORDERS --- */}
            {activeTab === 'commission' && (
                <div className="space-y-4">
                    <div className="text-xs text-amber-200/60 uppercase tracking-wider font-bold pl-2 mb-2 flex items-center gap-2">
                        <AlertTriangle size={12} /> Ware ist da - wartet auf Abholung / Verladung
                    </div>
                    {pickupOrders.map(order => (
                        <GlassCard
                            key={order.id}
                            className={`flex flex-col gap-3 cursor-pointer hover:bg-white/5 transition-colors group border-amber-500/30 bg-amber-500/5 ${selectedOrder?.id === order.id ? 'border-amber-400/50 bg-amber-500/20' : ''}`}
                            onClick={() => handleOpenOrder(order)}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-white group-hover:text-amber-300 transition-colors flex items-center gap-2">
                                        {order.supplier}
                                        {order.warehouseType === 'Vehicle' && <Truck size={14} className="text-amber-400" />}
                                    </h3>
                                    <p className="text-xs text-white/50">{new Date(order.date).toLocaleDateString()} • {order.warehouseName}</p>
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

                            <div className="flex items-center justify-between pt-2 border-t border-white/10">
                                <span className="text-sm text-white/70">{order.itemCount} Positionen</span>
                                <div className="text-xs text-amber-300 flex items-center gap-1">
                                    <Archive size={14} /> Abholbereit
                                </div>
                            </div>
                        </GlassCard>
                    ))}
                    {pickupOrders.length === 0 && <div className="text-center text-white/30 py-8">Keine Kommissionen zur Abholung bereit.</div>}
                </div>
            )}
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
            {showManualModal && (
                <GlassModal isOpen={showManualModal} onClose={() => setShowManualModal(false)} title="Manuelle Bestellung erfassen / Digitalisieren">
                    <div className="flex flex-col h-[70vh]">

                        <div className="p-6 flex-1 overflow-y-auto space-y-6">

                            {/* SECTION 1: WAREHOUSE SELECTOR */}
                            <div className="space-y-3">
                                <label className="text-xs text-white/50 uppercase font-bold tracking-wider">Ziel-Lager wählen</label>
                                <div className="flex gap-2">
                                    {/* Primary / Secondary Switch */}
                                    {profile?.primary_warehouse_id && (
                                        <div className="flex bg-black/30 p-1 rounded-lg border border-white/10 shrink-0">
                                            <button
                                                onClick={() => handleManualWarehouseSelect(profile.primary_warehouse_id!, 'primary')}
                                                className={`p-2 rounded-md transition-all ${manualSourceType === 'primary' ? 'bg-emerald-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                                                title={manualWarehouses.find(w => w.id === profile.primary_warehouse_id)?.name}
                                            >
                                                <WarehouseIcon size={20} />
                                            </button>
                                            {profile.secondary_warehouse_id && (
                                                <button
                                                    onClick={() => handleManualWarehouseSelect(profile.secondary_warehouse_id!, 'secondary')}
                                                    className={`p-2 rounded-md transition-all ${manualSourceType === 'secondary' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                                                    title={manualWarehouses.find(w => w.id === profile.secondary_warehouse_id)?.name}
                                                >
                                                    <Truck size={20} />
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Dropdown for others */}
                                    <div className="flex-1">
                                        <GlassSelect
                                            value={manualSourceType === 'other' ? manualWarehouseId : ''}
                                            onChange={(e) => {
                                                if (e.target.value) handleManualWarehouseSelect(e.target.value, 'other');
                                            }}
                                            className="py-2.5 text-sm"
                                        >
                                            <option value="" disabled className="bg-gray-900">Anderes Lager...</option>
                                            {manualWarehouses.map(w => (
                                                <option key={w.id} value={w.id} className="bg-gray-900">{w.name}</option>
                                            ))}
                                        </GlassSelect>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2: COMMISSION NUMBER */}
                            {manualCommissionNumber && (
                                <div
                                    className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl cursor-pointer hover:bg-emerald-500/20 transition-colors flex items-center justify-between group"
                                    onClick={() => { navigator.clipboard.writeText(manualCommissionNumber); alert("Kopiert!"); }}
                                >
                                    <div>
                                        <div className="text-[10px] text-emerald-300 uppercase font-bold mb-0.5">Kommission</div>
                                        <div className="text-lg font-mono text-white font-bold">{manualCommissionNumber}</div>
                                    </div>
                                    <Copy size={18} className="text-emerald-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                                </div>
                            )}

                            <div className="h-px bg-white/10 w-full"></div>

                            {/* SECTION 3: CONTENT AREA (Upload OR List) */}
                            {manualScannedItems.length === 0 && !showAddItemForm ? (
                                // STATE A: UPLOAD
                                <div className="space-y-4 animate-in fade-in">
                                    <div className="text-sm text-white/60 text-center">Dokument scannen (Lieferschein / Bestellung)</div>
                                    <div
                                        onClick={() => manualFileInputRef.current?.click()}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        className={`border-2 border-dashed rounded-2xl h-40 flex flex-col items-center justify-center cursor-pointer transition-all ${isDragging
                                            ? 'border-emerald-500 bg-emerald-500/10 scale-[1.02]'
                                            : 'border-white/10 hover:border-emerald-500/50 hover:bg-white/5 bg-black/20'
                                            }`}
                                    >
                                        {manualAiFile ? (
                                            manualAiFile.type.startsWith('image/') && manualAiPreview ? (
                                                <img src={manualAiPreview} className="h-full w-full object-contain rounded-xl p-2" />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-white/80 h-full p-4">
                                                    <FileText size={48} className="text-red-400 mb-2" />
                                                    <span className="text-xs text-center break-all">{manualAiFile.name}</span>
                                                </div>
                                            )
                                        ) : (
                                            <div className="text-white/30 flex flex-col items-center gap-2">
                                                <Upload size={32} />
                                                <span className="text-xs">Bild oder PDF wählen</span>
                                            </div>
                                        )}
                                        <input type="file" ref={manualFileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleManualFileSelect} />
                                    </div>
                                    <Button
                                        onClick={analyzeDocument}
                                        disabled={!manualAiFile || isManualAnalyzing}
                                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 border-none h-12"
                                    >
                                        {isManualAnalyzing ? <Loader2 className="animate-spin" /> : <span className="flex items-center gap-2"><Wand2 size={18} /> Analysieren</span>}
                                    </Button>

                                    <div className="flex items-center gap-3 pt-2">
                                        <div className="h-px bg-white/10 flex-1"></div>
                                        <span className="text-xs text-white/30 uppercase">Oder</span>
                                        <div className="h-px bg-white/10 flex-1"></div>
                                    </div>

                                    <Button
                                        onClick={() => setShowAddItemForm(true)}
                                        variant="secondary"
                                        className="w-full h-12"
                                        icon={<Plus size={18} />}
                                    >
                                        Manuell Position erfassen
                                    </Button>
                                </div>
                            ) : showAddItemForm ? (
                                // STATE C: ADD ITEM FORM
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="text-center mb-4">
                                        <h3 className="text-lg font-bold text-white">Position hinzufügen</h3>
                                        <p className="text-xs text-white/50">Artikel wird als Freiposition (ohne Lagerbestand) erfasst.</p>
                                    </div>

                                    <div className="space-y-3">
                                        {/* OPTIONAL SUPPLIER SELECTION (Global for this order) */}
                                        <div className="bg-white/5 p-3 rounded-xl border border-white/10 mb-4">
                                            <h4 className="text-xs font-bold text-white/70 mb-2 uppercase tracking-wider">Lieferant der Bestellung</h4>
                                            <div className="space-y-2">
                                                <GlassSelect
                                                    value=""
                                                    onChange={(e) => {
                                                        if (e.target.value) setManualSupplierName(e.target.value);
                                                    }}
                                                    className="text-xs py-2"
                                                >
                                                    <option value="">Aus Großhändler-Liste wählen...</option>
                                                    {suppliers.map(s => (
                                                        <option key={s.id} value={s.name}>{s.name}</option>
                                                    ))}
                                                </GlassSelect>

                                                <input
                                                    className="w-full bg-black/20 border-b border-white/20 p-2 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-white/30"
                                                    value={manualSupplierName}
                                                    onChange={e => setManualSupplierName(e.target.value)}
                                                    placeholder="Oder externer Lieferant Name"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs text-white/50 block mb-1">Artikelbezeichnung <span className="text-red-400">*</span></label>
                                            <GlassInput
                                                autoFocus
                                                value={manualItemName}
                                                onChange={e => setManualItemName(e.target.value)}
                                                placeholder="z.B. Schrauben M8x40"
                                                className="w-full"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-white/50 block mb-1">Artikelnummer / SKU (Optional)</label>
                                            <GlassInput
                                                value={manualItemSku}
                                                onChange={e => setManualItemSku(e.target.value)}
                                                placeholder="Optional"
                                                className="w-full"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-white/50 block mb-1">Menge</label>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setManualItemQuantity(Math.max(1, manualItemQuantity - 1))} className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"><Minus size={18} /></button>
                                                <GlassInput
                                                    type="number"
                                                    min={1}
                                                    value={manualItemQuantity}
                                                    onChange={e => setManualItemQuantity(parseInt(e.target.value) || 1)}
                                                    className="w-20 text-center"
                                                />
                                                <button onClick={() => setManualItemQuantity(manualItemQuantity + 1)} className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"><Plus size={18} /></button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <Button onClick={() => setShowAddItemForm(false)} variant="secondary" className="flex-1">Abbrechen</Button>
                                        <Button
                                            onClick={handleManualAddItem}
                                            disabled={!manualItemName}
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                                            icon={<Plus size={18} />}
                                        >
                                            Hinzufügen
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                // STATE B: ITEM LIST
                                <div className="space-y-4 animate-in slide-in-from-right-4">
                                    <div className="flex justify-between items-center">
                                        <div className="text-sm text-white/60">Gefunden: {manualScannedItems.length} Pos.</div>
                                        <div className="flex gap-3">
                                            <button onClick={() => setShowAddItemForm(true)} className="text-xs text-emerald-400 hover:text-white flex items-center gap-1 transition-colors">
                                                <Plus size={12} /> Position hinzufügen
                                            </button>
                                            <button onClick={handleResetManualScan} className="text-xs text-blue-400 hover:text-white flex items-center gap-1 transition-colors">
                                                <RefreshCw size={12} /> Neu scannen
                                            </button>
                                        </div>
                                    </div>

                                    {manualSupplierName && (
                                        <div className="bg-white/5 px-3 py-2 rounded-lg border border-white/10 flex justify-between items-center">
                                            <span className="text-xs text-white/50">Lieferant:</span>
                                            <span className="font-bold text-white text-sm">{manualSupplierName}</span>
                                        </div>
                                    )}

                                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                        {manualScannedItems.map((item, idx) => (
                                            <div key={idx} className={`p-3 rounded-xl border flex justify-between items-center ${item.isFound ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <div className="text-sm font-bold text-white truncate">{item.isFound ? item.foundArticle?.name : item.name}</div>
                                                    <div className="text-xs text-white/50 flex gap-2">
                                                        <span className="font-mono">{item.sku}</span>
                                                        {!item.isFound && <span className="text-amber-400 font-bold text-[9px] uppercase border border-amber-500/30 px-1 rounded">Manuell</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="font-bold text-white text-lg">x{item.quantity}</div>
                                                    <button
                                                        onClick={() => handleRemoveManualItem(idx)}
                                                        className="p-2 text-white/30 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
                                                        title="Entfernen"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <Button onClick={saveManualOrder} disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-500 h-12 mt-4">
                                        {isSubmitting ? <Loader2 className="animate-spin" /> : 'Bestellung anlegen'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </GlassModal>
            )}

            {/* SUCCESS MODAL */}
            {showSuccessModal && (
                <GlassModal
                    isOpen={showSuccessModal}
                    onClose={() => setShowSuccessModal(false)}
                    title="Bestellung erfolgreich angelegt"
                    className="max-w-md"
                >
                    <div className="p-6 space-y-6 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                            <Check size={32} className="text-emerald-400" />
                        </div>

                        <div className="text-center w-full">
                            <div className="text-sm text-white/50 mb-1">Kommissionsnummer</div>
                            <div
                                className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-center gap-3 cursor-pointer hover:bg-white/10 transition-colors group"
                                onClick={() => { if (createdOrderCommission) { navigator.clipboard.writeText(createdOrderCommission); alert("Kopiert!"); } }}
                            >
                                <span className="text-2xl font-mono font-bold text-white tracking-wider">{createdOrderCommission}</span>
                                <Copy size={18} className="text-emerald-400 opacity-50 group-hover:opacity-100" />
                            </div>
                        </div>

                        <div className="w-full bg-white/5 rounded-xl p-4 border border-white/10">
                            <label className="text-xs text-white/50 block mb-2">Bestellnummer vom Lieferanten (falls zur Hand)</label>
                            <div className="flex gap-2">
                                <input
                                    className={`flex-1 bg-black/20 border-b border-white/20 p-2 text-white font-mono focus:outline-none focus:border-emerald-500 ${supplierNumberSaved ? 'border-emerald-500 text-emerald-400' : ''}`}
                                    onChange={e => setCreatedOrderSupplierNumber(e.target.value)}
                                    value={createdOrderSupplierNumber}
                                    placeholder="Nr. eintragen..."
                                />
                                <Button
                                    onClick={updateOrderSupplierNumber}
                                    size="sm"
                                    className={`shrink-0 ${supplierNumberSaved ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
                                >
                                    {supplierNumberSaved ? <Check size={16} /> : 'Speichern'}
                                </Button>
                            </div>
                        </div>

                        <Button onClick={() => setShowSuccessModal(false)} className="w-full" variant="secondary">
                            Schließen
                        </Button>
                    </div>
                </GlassModal>
            )}
        </MasterDetailLayout>
    );
};

export default Orders;