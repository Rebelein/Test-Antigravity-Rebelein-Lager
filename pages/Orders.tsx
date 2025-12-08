import React, { useEffect, useState, useRef } from 'react';
import { GlassCard, Button, GlassInput, GlassSelect, StatusBadge } from '../components/UIComponents';
import { AddArticleModal } from '../components/AddArticleModal';
import { Article, Order, OrderItem, Supplier, OrderProposal, WarehouseType, Warehouse } from '../types';
import { ShoppingCart, CheckCircle2, Loader2, Send, Copy, FileDown, Check, X, ClipboardList, Truck, Search, Box, Barcode, MapPin, Plus, Minus, PackageCheck, ArrowDownToLine, ChevronDown, ChevronUp, Clock, AlertTriangle, Archive, FileText, Sparkles, Upload, Trash2, Link as LinkIcon, Wand2, Eye, Warehouse as WarehouseIcon, RefreshCw, HardHat } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GoogleGenAI, Type } from "@google/genai";

const Orders: React.FC = () => {
    const navigate = useNavigate();
    const { profile, user } = useAuth();
    const [activeTab, setActiveTab] = useState<'proposals' | 'pending' | 'commission' | 'completed' | 'import'>('proposals');

    // Badge Counts State
    const [badgeCounts, setBadgeCounts] = useState({ proposals: 0, pending: 0, commission: 0, completed: 0 });

    // --- PROPOSALS STATE ---
    const [groupedProposals, setGroupedProposals] = useState<Record<string, OrderProposal[]>>({});
    const [loadingProposals, setLoadingProposals] = useState(true);

    // Proposal Modal State
    const [selectedProposal, setSelectedProposal] = useState<OrderProposal | null>(null);
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
    const [proposalQuantities, setProposalQuantities] = useState<Record<string, number>>({}); // Edited quantities
    const [newOrderNumber, setNewOrderNumber] = useState(''); // Supplier Order Number
    const [newCommissionNumber, setNewCommissionNumber] = useState(''); // Internal Commission Number
    const [commissionCopied, setCommissionCopied] = useState(false);

    // --- PENDING ORDERS STATE ---
    const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
    const [pickupOrders, setPickupOrders] = useState<Order[]>([]); // New state for 'ReadyForPickup'
    const [loadingPending, setLoadingPending] = useState(false);

    // --- COMPLETED ORDERS STATE ---
    const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
    const [loadingCompleted, setLoadingCompleted] = useState(false);

    // --- ORDER DETAIL / RECEIVING STATE ---
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [receivingItems, setReceivingItems] = useState<(OrderItem & { currentReceiveAmount: number, articleName?: string, articleSku?: string, maxQty: number, customName?: string, customSku?: string })[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [showVehicleDecision, setShowVehicleDecision] = useState(false); // Modal for Vehicle choice
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- SKU COPY MODAL STATE ---
    const [showSkuCopyModal, setShowSkuCopyModal] = useState(false);
    const [copiedSkuIds, setCopiedSkuIds] = useState<Set<string>>(new Set());

    // --- MANUAL ORDER WIZARD STATE ---
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualWarehouses, setManualWarehouses] = useState<Warehouse[]>([]);

    // Single View State
    const [manualWarehouseId, setManualWarehouseId] = useState('');
    const [manualSourceType, setManualSourceType] = useState<'primary' | 'secondary' | 'other' | null>(null);
    const [manualCommissionNumber, setManualCommissionNumber] = useState('');
    const [manualSupplierName, setManualSupplierName] = useState('');

    // AI States
    const [manualAiFile, setManualAiFile] = useState<File | null>(null);
    const [manualAiPreview, setManualAiPreview] = useState<string | null>(null);
    const [isManualAnalyzing, setIsManualAnalyzing] = useState(false);
    const [manualScannedItems, setManualScannedItems] = useState<{ sku: string, name: string, quantity: number, foundArticle?: Article, isFound: boolean }[]>([]);
    const manualFileInputRef = useRef<HTMLInputElement>(null);

    // --- NEW: DRAG & DROP STATE ---
    const [isDragging, setIsDragging] = useState(false);

    // --- IMPORT TAB STATE ---
    const [importCandidates, setImportCandidates] = useState<any[]>([]);
    const [loadingImport, setLoadingImport] = useState(false);

    // --- ADD ARTICLE MODAL STATE (FOR IMPORT) ---
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [importDataForModal, setImportDataForModal] = useState<Partial<Article> & { orderItemId: string } | null>(null);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]); // Need full supplier list for modal


    useEffect(() => {
        fetchProposals();
        fetchPendingOrders();
        fetchCompletedOrders();
        fetchPendingOrders();
        fetchCompletedOrders();
        fetchManualWarehouses();
        fetchImportCandidates();
        fetchSuppliers();
    }, [profile?.primary_warehouse_id]);

    // Clean up old completed orders on mount
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

    const handleOpenImportModal = (item: any) => {
        setImportDataForModal({
            orderItemId: item.id,
            name: item.name,
            sku: item.sku,
            // Pre-fill supplier if name matches
            supplier: item.supplier,
            // Default location
            location: 'Lager'
        });
        setIsAddModalOpen(true);
    };

    const handleImportSuccess = async (newArticleId: string) => {
        if (!importDataForModal) return;

        // Link the order item to the new article
        // This ensures it doesn't show up in the import list anymore (which filters by article_id IS NULL)
        try {
            await supabase.from('order_items').update({ article_id: newArticleId }).eq('id', importDataForModal.orderItemId);

            // Remove from local list to avoid refetch
            setImportCandidates(prev => prev.filter(c => c.id !== importDataForModal.orderItemId));

            alert("Artikel erfolgreich angelegt und verknüpft!");
        } catch (e: any) {
            alert("Fehler beim Verknüpfen: " + e.message);
        }
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
                    supplierSku: item.supplier_sku, // Ensure we map this for CSV
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

                // Fetch Suppliers to get CSV Format
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

                const uiGrouped: Record<string, OrderProposal[]> = {};
                proposals.forEach(p => {
                    if (!uiGrouped[p.supplier]) uiGrouped[p.supplier] = [];
                    uiGrouped[p.supplier].push(p);
                });

                setGroupedProposals(uiGrouped);
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
        } catch (e: any) {
            alert("Fehler: " + e.message);
        }
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

        // Auto-Select Primary if available
        if (profile?.primary_warehouse_id) {
            handleManualWarehouseSelect(profile.primary_warehouse_id, 'primary');
        }
    };

    const handleManualWarehouseSelect = async (whId: string, type: 'primary' | 'secondary' | 'other') => {
        setManualWarehouseId(whId);
        setManualSourceType(type);

        // Fetch next Commission Number
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

                // MATCHING LOGIC
                const matchedItems = await Promise.all(scanned.map(async (item: any) => {
                    let query = supabase.from('articles')
                        .select('*')
                        .or(`sku.eq.${item.sku},supplier_sku.eq.${item.sku},ean.eq.${item.sku}`)
                        .limit(1);

                    // Filter by selected warehouse if available to avoid cross-warehouse matching
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
                    // Mark article as ordered
                    await supabase.from('articles').update({ on_order_date: new Date().toISOString() }).eq('id', item.foundArticle.id);
                } else {
                    // Custom Item
                    payload.custom_name = item.name;
                    payload.custom_sku = item.sku;
                }

                await supabase.from('order_items').insert(payload);
            }

            await logOrderEvent(orderData.id, 'Neue Bestellung', `Manuelle Bestellung bei ${manualSupplierName || 'Manuell'}`);

            alert("Bestellung erfolgreich angelegt!");
            setShowManualModal(false);
            fetchPendingOrders();
            // Update proposals because items might have been removed from proposal list (on_order_date set)
            fetchProposals();
            setActiveTab('pending');

        } catch (e: any) {
            alert("Fehler: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- CREATE ORDER LOGIC (EXISTING) ---

    const handleOpenProposal = async (proposal: OrderProposal) => {
        setSelectedProposal(proposal);
        setNewOrderNumber('');
        setShowSkuCopyModal(false);
        setCopiedSkuIds(new Set());
        setCommissionCopied(false);
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

        const initialSelected = new Set<string>();
        const initialQuantities: Record<string, number> = {};

        proposal.articles.forEach(a => {
            initialSelected.add(a.article.id);
            initialQuantities[a.article.id] = a.missingAmount;
        });

        setSelectedItemIds(initialSelected);
        setProposalQuantities(initialQuantities);
    };

    const handleCopyCommission = () => {
        if (newCommissionNumber) {
            navigator.clipboard.writeText(newCommissionNumber);
            setCommissionCopied(true);
            setTimeout(() => setCommissionCopied(false), 2000);
        }
    };

    const handleCloseProposal = () => {
        setSelectedProposal(null);
        setShowSkuCopyModal(false);
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

    const handleProposalCsvDownload = () => {
        if (!selectedProposal) return;

        const itemsToExport = selectedProposal.articles.filter(a => selectedItemIds.has(a.article.id));
        if (itemsToExport.length === 0) return;

        const format = selectedProposal.csvFormat || "{{sku}};{{amount}}";
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
        link.setAttribute("download", `Bestellung_${selectedProposal.supplier}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
    };

    const createOrder = async () => {
        if (!selectedProposal || !user) return;
        try {
            if (selectedItemIds.size === 0) return;

            const { data: orderData, error } = await supabase
                .from('orders')
                .insert({
                    supplier: selectedProposal.supplier,
                    date: new Date().toISOString(),
                    status: 'Ordered',
                    item_count: selectedItemIds.size,
                    total: 0,
                    warehouse_id: selectedProposal.warehouseId,
                    supplier_order_number: newOrderNumber,
                    commission_number: newCommissionNumber
                })
                .select().single();

            if (error) throw error;

            const itemsToOrder = selectedProposal.articles.filter(a => selectedItemIds.has(a.article.id));

            for (const item of itemsToOrder) {
                const qty = proposalQuantities[item.article.id] || item.missingAmount;
                await supabase.from('order_items').insert({
                    order_id: orderData.id,
                    article_id: item.article.id,
                    quantity_ordered: qty
                });
                await supabase.from('articles').update({ on_order_date: new Date().toISOString() }).eq('id', item.article.id);
            }

            await logOrderEvent(orderData.id, 'Neue Bestellung', `Bestellung bei ${selectedProposal.supplier}`);

            alert("Bestellung erfolgreich erstellt!");
            handleCloseProposal();
            fetchProposals();
            fetchPendingOrders();
            setActiveTab('pending');
        } catch (e: any) { alert("Fehler: " + e.message); }
    };

    // --- RECEIVING LOGIC (UPDATED) ---

    const handleOpenOrder = async (order: Order) => {
        setSelectedOrder(order);
        setLoadingDetails(true);
        setShowVehicleDecision(false);
        setShowSkuCopyModal(false);

        try {
            const { data } = await supabase
                .from('order_items')
                .select('*, articles(name, sku, supplier_sku, stock)')
                .eq('order_id', order.id);

            if (data) {
                const isPickup = order.status === 'ReadyForPickup';

                const mappedItems = data.map((item: any) => {
                    const remaining = item.quantity_ordered - item.quantity_received;
                    const effectiveMaxQty = isPickup ? item.quantity_received : remaining;
                    const defaultAmount = isPickup ? item.quantity_received : Math.max(0, remaining);

                    return {
                        id: item.id,
                        articleId: item.article_id, // CamelCase
                        quantityOrdered: item.quantity_ordered, // CamelCase
                        quantityReceived: item.quantity_received, // CamelCase
                        articleName: item.articles?.name || item.custom_name, // Fallback to custom name
                        articleSku: item.articles?.supplier_sku || item.articles?.sku || item.custom_sku,
                        customName: item.custom_name, // Store custom properties
                        customSku: item.custom_sku,
                        currentReceiveAmount: defaultAmount,
                        maxQty: effectiveMaxQty
                    };
                });
                setReceivingItems(mappedItems);
            }
        } catch (e) { console.error(e); }
        finally { setLoadingDetails(false); }
    };

    const handleAmountChange = (index: number, val: number) => {
        const newItems = [...receivingItems];
        newItems[index].currentReceiveAmount = val;
        setReceivingItems(newItems);
    };

    const handlePreReceive = () => {
        if (!selectedOrder) return;
        const totalReceiving = receivingItems.reduce((sum, item) => sum + item.currentReceiveAmount, 0);
        if (totalReceiving === 0) {
            alert("Bitte Menge angeben.");
            return;
        }

        if (selectedOrder.warehouseType === 'Vehicle') {
            const isFullReceive = receivingItems.every(i => i.currentReceiveAmount === i.maxQty);
            if (isFullReceive) {
                setShowVehicleDecision(true);
                return;
            }
        }
        executeReceipt('Direct');
    };

    const executeReceipt = async (mode: 'Direct' | 'Commission') => {
        if (!selectedOrder || !user) return;
        setIsSubmitting(true);

        try {
            let allCompleted = true;
            const isPickup = selectedOrder.status === 'ReadyForPickup';

            for (const item of receivingItems) {
                if (item.currentReceiveAmount > 0) {
                    if (!isPickup) {
                        const newReceivedTotal = item.quantityReceived + item.currentReceiveAmount;
                        await supabase.from('order_items').update({
                            quantity_received: newReceivedTotal
                        }).eq('id', item.id);
                    }

                    // Only book stock if it's a real article (not custom) AND mode is Direct
                    if (mode === 'Direct' && item.articleId) {
                        const { data: art } = await supabase.from('articles').select('stock').eq('id', item.articleId).single();
                        if (art) {
                            const newStock = art.stock + item.currentReceiveAmount;
                            const updates: any = { stock: newStock };

                            if (!isPickup && (item.quantityReceived + item.currentReceiveAmount) >= item.quantityOrdered) {
                                updates.on_order_date = null;
                            }

                            await supabase.from('articles').update(updates).eq('id', item.articleId);

                            await supabase.from('stock_movements').insert({
                                article_id: item.articleId,
                                user_id: user.id,
                                amount: item.currentReceiveAmount,
                                type: 'receive_goods',
                                reference: `Bestellung: ${selectedOrder.supplier}`
                            });
                        }
                    } else if (!item.articleId) {
                        // Custom items: Just marked as received in DB (done above), no stock update
                    }
                }

                if (!isPickup) {
                    if ((item.quantityReceived + item.currentReceiveAmount) < item.quantityOrdered) {
                        allCompleted = false;
                    }
                }
            }

            let newStatus = allCompleted ? 'Received' : 'PartiallyReceived';
            if (mode === 'Commission' && allCompleted) {
                newStatus = 'ReadyForPickup';
            }
            if (isPickup) {
                newStatus = 'Received';
            }

            await supabase.from('orders').update({ status: newStatus }).eq('id', selectedOrder.id);

            await logOrderEvent(selectedOrder.id, 'Wareneingang', `Status: ${translateStatus(newStatus)}`);

            setSelectedOrder(null);
            setShowVehicleDecision(false);
            fetchPendingOrders();
            fetchCompletedOrders();

        } catch (e: any) {
            alert("Fehler: " + e.message);
        } finally {
            setIsSubmitting(false);
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

    const handleCopySku = (sku: string, id: string) => {
        if (!sku) return;
        navigator.clipboard.writeText(sku);
        setCopiedSkuIds(prev => new Set(prev).add(id));
    };

    const translateStatus = (status: string) => {
        switch (status) {
            case 'Draft': return 'Entwurf';
            case 'Ordered': return 'Bestellt';
            case 'PartiallyReceived': return 'Teilw. Erhalten';
            case 'Received': return 'Erhalten';
            case 'ReadyForPickup': return 'Abholbereit';
            default: return status;
        }
    };

    // Helper for Warehouse Switch Name
    const getWarehouseName = (id: string | undefined) => {
        if (!id) return '';
        return manualWarehouses.find(w => w.id === id)?.name || 'Lager';
    };

    return (
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
                    {/* Proposals List (Unchanged) */}
                    {loadingProposals ? <Loader2 className="animate-spin text-blue-400 mx-auto" /> : (
                        Object.keys(groupedProposals).length === 0 ? (
                            <div className="text-center text-white/30 py-10 border border-dashed border-white/10 rounded-xl">Keine Nachbestellungen nötig.</div>
                        ) : (
                            Object.entries(groupedProposals).map(([supplier, proposals]) => (
                                <div key={supplier} className="space-y-3">
                                    <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider pl-2">{supplier}</h3>
                                    {(proposals as OrderProposal[]).map((prop, idx) => (
                                        <GlassCard key={idx} className="cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleOpenProposal(prop)}>
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

            {/* --- CONTENT: IMPORT CANDIDATES --- */}
            {activeTab === 'import' && (
                <div className="space-y-4">
                    <div className="text-xs text-white/30 text-center mb-4">
                        Artikel aus Bestellungen der letzten 30 Tage, die noch nicht im Lagerbestand sind.
                    </div>
                    {loadingImport ? <Loader2 className="animate-spin text-blue-400 mx-auto" /> : (
                        importCandidates.map((item, idx) => (
                            <GlassCard
                                key={idx}
                                className="flex flex-col gap-3 group border-emerald-500/20 bg-emerald-500/5"
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
                                        onClick={() => handleOpenImportModal(item)}
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
                            className="flex flex-col gap-3 cursor-pointer hover:bg-white/5 transition-colors group"
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
                                <StatusBadge status={translateStatus(order.status)} type={order.status === 'PartiallyReceived' ? 'warning' : 'neutral'} />
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
                                <button onClick={(e) => { e.stopPropagation(); handleDownloadCsv(order); }} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg flex items-center gap-2 text-xs font-bold transition-colors">
                                    <FileDown size={14} /> CSV
                                </button>
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
                                className="flex flex-col gap-3 cursor-pointer hover:bg-white/5 transition-colors group opacity-70 hover:opacity-100"
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
                                        <StatusBadge status={translateStatus(order.status)} type="success" />
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
                            className="flex flex-col gap-3 cursor-pointer hover:bg-white/5 transition-colors group border-amber-500/30 bg-amber-500/5"
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
                                <StatusBadge status={translateStatus(order.status)} type="info" />
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

            {/* --- MODAL: ORDER DETAILS --- */}
            {selectedOrder && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                    <div className="w-full max-w-lg bg-[#1a1d24] border border-white/10 rounded-2xl shadow-xl flex flex-col max-h-[90vh] relative">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div>
                                <h2 className="text-lg font-bold text-white">Bestellung Details</h2>
                                <p className="text-sm text-white/50">{selectedOrder.supplier} • {new Date(selectedOrder.date).toLocaleDateString()}</p>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="p-2 rounded-full hover:bg-white/10"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {loadingDetails ? <Loader2 className="animate-spin mx-auto text-blue-400" /> :
                                receivingItems.map((item, idx) => (
                                    <div key={item.id} className="p-3 rounded-xl bg-white/5 border border-white/5">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="text-sm font-bold text-white">{item.articleName || item.customName || 'Unbekannt'}</div>
                                                <div className="text-xs text-white/50 flex gap-2">
                                                    <span>Art-Nr: {item.articleSku || item.customSku || '-'}</span>
                                                    {!item.articleId && <span className="text-amber-400 font-bold bg-amber-900/30 px-1 rounded">Manuell</span>}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-white/50">Erhalten / Bestellt</div>
                                                <div className="text-sm font-bold"><span className="text-emerald-400">{item.quantityReceived}</span> / {item.quantityOrdered}</div>
                                            </div>
                                        </div>

                                        {selectedOrder.status !== 'Received' && (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-white/40">{selectedOrder.status === 'ReadyForPickup' ? 'Zu verladen:' : 'Offener Eingang:'}</span>
                                                    <span className={`${item.currentReceiveAmount === item.maxQty ? 'text-emerald-400' : 'text-amber-400'} font-bold`}>
                                                        +{item.currentReceiveAmount}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max={item.maxQty}
                                                        value={item.currentReceiveAmount}
                                                        onChange={(e) => handleAmountChange(idx, parseInt(e.target.value))}
                                                        className="flex-1 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                                        disabled={item.maxQty === 0}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        {selectedOrder.status === 'Received' && (
                                            <div className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-2 py-1 rounded text-center">
                                                Vollständig Erhalten
                                            </div>
                                        )}
                                    </div>
                                ))
                            }
                        </div>

                        <div className="p-4 border-t border-white/10 bg-black/20 flex flex-col gap-3">
                            <div className="flex gap-3">
                                <Button variant="secondary" onClick={() => setSelectedOrder(null)} className="flex-1">Schließen</Button>
                                {selectedOrder.status === 'ReadyForPickup' ? (
                                    <Button onClick={() => executeReceipt('Direct')} icon={<Truck size={16} />} className="flex-1 bg-emerald-600 hover:bg-emerald-500">
                                        Abholen / Verladen
                                    </Button>
                                ) : selectedOrder.status !== 'Received' && (
                                    <Button onClick={handlePreReceive} icon={<PackageCheck size={16} />} className="flex-1 bg-emerald-600 hover:bg-emerald-500">
                                        Alles Erhalten
                                    </Button>
                                )}
                            </div>
                        </div>

                        {showVehicleDecision && (
                            <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 animate-in fade-in rounded-2xl text-center">
                                <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-300 mb-4">
                                    <Truck size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Fahrzeugbestellung</h3>
                                <p className="text-sm text-white/60 mb-8 max-w-xs">
                                    Die Ware ist vollständig da. Soll sie direkt ins Fahrzeug gebucht oder zur Abholung bereitgestellt werden?
                                </p>

                                <div className="flex flex-col gap-3 w-full">
                                    <button
                                        onClick={() => executeReceipt('Direct')}
                                        className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                                    >
                                        <PackageCheck size={20} /> Direkt Verladen (Bestand +)
                                    </button>
                                    <button
                                        onClick={() => executeReceipt('Commission')}
                                        className="w-full py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center gap-2 border border-white/10"
                                    >
                                        <Archive size={20} /> Als Kommission bereitstellen
                                    </button>
                                    <button onClick={() => setShowVehicleDecision(false)} className="mt-4 text-xs text-white/40 hover:text-white">Abbrechen</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ADD ARTICLE MODAL FOR IMPORT */}
            <AddArticleModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSaveSuccess={handleImportSuccess}
                initialData={importDataForModal || undefined}
                mode="add"
                warehouses={manualWarehouses}
                suppliers={suppliers}
                existingCategories={[]}
            />

            {/* --- MODAL: MANUAL ORDER WIZARD (RE-DESIGNED SINGLE PAGE) --- */}
            {showManualModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
                    <div className="w-full max-w-md bg-[#1a1d24] border border-white/10 rounded-2xl shadow-xl flex flex-col max-h-[90vh]">

                        {/* HEADER */}
                        <div className="p-4 border-b border-white/10 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-white">Manuelle Bestellung</h2>
                            <button onClick={() => setShowManualModal(false)}><X className="text-white/50 hover:text-white" size={20} /></button>
                        </div>

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
                                                title={getWarehouseName(profile.primary_warehouse_id)}
                                            >
                                                <WarehouseIcon size={20} />
                                            </button>
                                            {profile.secondary_warehouse_id && (
                                                <button
                                                    onClick={() => handleManualWarehouseSelect(profile.secondary_warehouse_id!, 'secondary')}
                                                    className={`p-2 rounded-md transition-all ${manualSourceType === 'secondary' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                                                    title={getWarehouseName(profile.secondary_warehouse_id)}
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
                            {manualScannedItems.length === 0 ? (
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
                                </div>
                            ) : (
                                // STATE B: ITEM LIST
                                <div className="space-y-4 animate-in slide-in-from-right-4">
                                    <div className="flex justify-between items-center">
                                        <div className="text-sm text-white/60">Gefunden: {manualScannedItems.length} Pos.</div>
                                        <button onClick={handleResetManualScan} className="text-xs text-blue-400 hover:text-white flex items-center gap-1 transition-colors">
                                            <RefreshCw size={12} /> Neu scannen
                                        </button>
                                    </div>

                                    <input
                                        className="w-full bg-black/20 border-b border-white/20 p-2 text-white font-bold focus:outline-none focus:border-emerald-500 placeholder-white/30"
                                        value={manualSupplierName}
                                        onChange={e => setManualSupplierName(e.target.value)}
                                        placeholder="Lieferant Name (Optional)"
                                    />

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
                                                <div className="font-bold text-white text-lg">x{item.quantity}</div>
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
                </div>
            )}

            {/* PROPOSAL MODAL (Existing code...) */}
            {selectedProposal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                    <div className="w-full max-w-lg bg-[#1a1d24] border border-white/10 rounded-2xl shadow-xl flex flex-col max-h-[90vh] relative">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div>
                                <h2 className="text-lg font-bold text-white">Bestellvorschlag</h2>
                                <p className="text-sm text-white/50">{selectedProposal.supplier}</p>
                            </div>
                            <button onClick={handleCloseProposal} className="p-2 rounded-full hover:bg-white/10"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {selectedProposal.articles.map((item) => (
                                <div
                                    key={item.article.id}
                                    className={`flex flex-col p-3 rounded-xl border transition-colors ${selectedItemIds.has(item.article.id) ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-white/5 border-white/5'}`}
                                >
                                    <div className="flex items-start gap-3 mb-2" onClick={() => toggleProposalItem(item.article.id)}>
                                        <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center cursor-pointer ${selectedItemIds.has(item.article.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/30'}`}>
                                            {selectedItemIds.has(item.article.id) && <Check size={12} />}
                                        </div>
                                        <div className="flex-1 cursor-pointer">
                                            <div className="text-sm font-bold text-white line-clamp-2">{item.article.name}</div>
                                            <div className="text-xs text-white/50 flex gap-2">
                                                <span>Lager: {item.article.stock} / Soll: {item.article.targetStock}</span>
                                                <span className="font-mono text-white/30">{item.article.supplierSku}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {selectedItemIds.has(item.article.id) && (
                                        <div className="flex items-center gap-3 pl-8">
                                            <div className="text-xs text-white/40">Menge:</div>
                                            <div className="flex items-center bg-black/30 rounded-lg border border-white/10">
                                                <button onClick={() => updateProposalQuantity(item.article.id, -1)} className="p-2 hover:bg-white/10 rounded-l-lg text-white"><Minus size={14} /></button>
                                                <div className="w-12 text-center font-bold text-white text-sm">
                                                    {proposalQuantities[item.article.id] || item.missingAmount}
                                                </div>
                                                <button onClick={() => updateProposalQuantity(item.article.id, 1)} className="p-2 hover:bg-white/10 rounded-r-lg text-white"><Plus size={14} /></button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t border-white/10 bg-black/20 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-white/50 mb-1 block">Auftrags-Nr. (Lieferant)</label>
                                    <input
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                                        placeholder="z.B. 2024-9988"
                                        value={newOrderNumber}
                                        onChange={e => setNewOrderNumber(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-white/50 mb-1 block flex justify-between">
                                        <span>Kommission (Intern)</span>
                                        {commissionCopied && <span className="text-emerald-400 font-bold">Kopiert!</span>}
                                    </label>
                                    <div className="relative group cursor-pointer" onClick={handleCopyCommission}>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-lg p-2 pr-8 text-sm text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                                            placeholder="Automatisch..."
                                            value={newCommissionNumber}
                                            readOnly
                                        />
                                        <div className="absolute right-2 top-2 text-white/30 group-hover:text-white">
                                            {commissionCopied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setShowSkuCopyModal(true)} className="w-full py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                                <Copy size={14} /> Artikel-Nrn. kopieren
                            </button>
                            <div className="flex gap-3">
                                <Button variant="secondary" onClick={handleProposalCsvDownload} icon={<FileText size={16} />} className="flex-1 bg-white/5 hover:bg-white/10">CSV Export</Button>
                                <Button onClick={createOrder} disabled={selectedItemIds.size === 0} className="flex-[2] bg-emerald-600 hover:bg-emerald-500">Bestellen ({selectedItemIds.size})</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Orders;