
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, Button, GlassInput, GlassSelect, StatusBadge, GlassModal } from '../components/UIComponents';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Commission, CommissionItem, Article, Supplier, CommissionEvent } from '../types';
import { ClipboardCheck, Plus, Search, Package, Truck, CheckCircle2, Printer, X, Loader2, History, Trash2, Box, ExternalLink, Check, ShoppingCart, Minus, ChevronDown, Edit2, Save, AlertTriangle, RotateCcw, Tag, Clock, Undo2, MapPin, PenTool, Layers, ArrowRight, Paperclip, Eye, FileText, Clipboard, MessageSquare } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

type CommissionTab = 'active' | 'returns' | 'withdrawn' | 'trash';
type PrintTab = 'queue' | 'history';

// Extended type for UI
type ExtendedCommission = Commission & {
    commission_items?: any[];
    suppliers?: { name: string };
};

// Interface for local items before saving to DB
interface TempCommissionItem {
    uniqueId: string; // Local temp ID
    type: 'Stock' | 'External';
    amount: number;
    article?: Article; // If stock
    customName?: string; // If external (Supplier Name)
    externalReference?: string; // The "Vorgangsnummer"
    attachmentData?: string; // Base64 data
    isBackorder?: boolean; // NEW
    notes?: string; // NEW
    supplierId?: string;
    isPicked?: boolean; // Keep track of picked state even during edit
    isDragging?: boolean; // UI State for Drag & Drop
}

const Commissions: React.FC = () => {
    const { user, profile } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<CommissionTab>('active');
    const [loading, setLoading] = useState(true);

    const [commissions, setCommissions] = useState<ExtendedCommission[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]); // Available suppliers

    // --- MODAL STATES ---
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showPrepareModal, setShowPrepareModal] = useState(false);
    const [showConfirmReadyModal, setShowConfirmReadyModal] = useState(false);
    const [showConfirmWithdrawModal, setShowConfirmWithdrawModal] = useState(false);
    const [showLabelOptionsModal, setShowLabelOptionsModal] = useState<string | null>(null);
    const [showLabelUpdateModal, setShowLabelUpdateModal] = useState(false); // NEW

    // --- SEARCH MODAL STATE ---
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [globalSearchTerm, setGlobalSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<ExtendedCommission[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // --- DELETE CONFIRMATION STATE ---
    const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string, mode: 'trash' | 'permanent' } | null>(null);

    // --- HISTORY MODAL STATE ---
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyLogs, setHistoryLogs] = useState<CommissionEvent[]>([]);
    const [localHistoryLogs, setLocalHistoryLogs] = useState<CommissionEvent[]>([]); // NEW: Local history for modal
    const [historySearch, setHistorySearch] = useState('');
    const [loadingHistory, setLoadingHistory] = useState(false);

    // --- ATTACHMENT VIEW MODAL ---
    const [viewingAttachment, setViewingAttachment] = useState<string | null>(null);

    // --- ITEM NOTE MODAL ---
    const [editingItemNote, setEditingItemNote] = useState<{ itemId: string, note: string } | null>(null);

    const [activeCommission, setActiveCommission] = useState<Commission | null>(null);

    // Track if label-critical data changed
    const [labelDataChanged, setLabelDataChanged] = useState(false);

    // --- CATEGORY COLLAPSE STATES ---
    const [collapsedCategories, setCollapsedCategories] = useState({
        ready: false,
        preparing: false,
        draft: false,
        returnReady: false,
        returnPending: false
    });

    // --- PRINT QUEUE & HISTORY STATE ---
    const [showPrintArea, setShowPrintArea] = useState(false); // Default: Collapsed
    const [printTab, setPrintTab] = useState<PrintTab>('queue');
    const [selectedPrintIds, setSelectedPrintIds] = useState<Set<string>>(new Set());
    const [recentPrintLogs, setRecentPrintLogs] = useState<(CommissionEvent & { commission?: Commission })[]>([]);
    const [loadingPrintHistory, setLoadingPrintHistory] = useState(false);

    // --- CREATE/EDIT FORM STATES ---
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingCommissionId, setEditingCommissionId] = useState<string | null>(null);
    const [newComm, setNewComm] = useState({ order_number: '', name: '', notes: '' });
    const [tempItems, setTempItems] = useState<TempCommissionItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- ITEMS STATE (For Prepare View) ---
    const [commItems, setCommItems] = useState<CommissionItem[]>([]); // Real DB items
    const [availableArticles, setAvailableArticles] = useState<Article[]>([]);

    // NEW: Category Selection State
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Navigation State
    const [returnPath, setReturnPath] = useState<string | null>(null);

    // Collapsible sections in Create Modal
    const [expandStockSearch, setExpandStockSearch] = useState(false); // DEFAULT COLLAPSED
    const [expandSupplierList, setExpandSupplierList] = useState(false);

    // Search States within Modal
    const [stockSearchTerm, setStockSearchTerm] = useState('');
    const [supplierSearchTerm, setSupplierSearchTerm] = useState('');

    const isMounted = useRef(true);

    // Helper for Categories
    const distinctCategories = useMemo(() => {
        const cats = new Set(availableArticles.map(a => a.category || 'Sonstiges'));
        return Array.from(cats).sort();
    }, [availableArticles]);

    // Derived Queue Items (Memoized for performance and Effect dependency)
    const queueItems = useMemo(() => {
        return commissions.filter(c => c.needs_label && !c.deleted_at && c.status !== 'Withdrawn');
    }, [commissions]);

    // --- EFFECT: Auto-Toggle Print Area based on Queue ---
    useEffect(() => {
        if (queueItems.length > 0) {
            setShowPrintArea(true);
        } else {
            // If queue is empty, auto-collapse (unless user manually opens it later, which this effect won't block)
            setShowPrintArea(false);
        }
    }, [queueItems.length]);

    // Handle edit/create redirect from dashboard
    useEffect(() => {
        const state = location.state as { editCommissionId?: string; openCreateModal?: boolean; returnTo?: string } | null;

        if (state) {
            // 1. Edit Mode
            if (state.editCommissionId) {
                window.history.replaceState({}, document.title); // Cleanup

                const loadAndEdit = async () => {
                    let comm = commissions.find(c => c.id === state.editCommissionId);
                    if (!comm) {
                        const { data } = await supabase.from('commissions').select('*, suppliers(name)').eq('id', state.editCommissionId).single();
                        if (data) comm = data as ExtendedCommission;
                    }
                    if (comm) {
                        handleEditCommission(comm);
                    }
                };
                loadAndEdit();
            }
            // 2. Create Mode (New Feature)
            else if (state.openCreateModal) {
                if (state.returnTo) setReturnPath(state.returnTo);
                window.history.replaceState({}, document.title); // Cleanup
                openCreateModal();
            }
        }
    }, [location, commissions]);

    useEffect(() => {
        isMounted.current = true;
        fetchCommissions();
        fetchSuppliers();
        fetchArticles();
        return () => { isMounted.current = false; };
    }, [activeTab, profile?.primary_warehouse_id]);

    // --- REALTIME SUBSCRIPTION ---
    useEffect(() => {
        const channel = supabase
            .channel('commissions-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'commissions' },
                (payload) => {
                    fetchCommissions(); // Refresh list

                    // If detail modal is open and this specific commission changed, refresh local details
                    if (activeCommission && (payload.new as any)?.id === activeCommission.id) {
                        // Reload full active commission to get updated status/notes
                        supabase.from('commissions').select('*, suppliers(name)').eq('id', activeCommission.id).single()
                            .then(({ data }) => {
                                if (data) setActiveCommission(data as ExtendedCommission);
                            });
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'commission_items' },
                (payload) => {
                    fetchCommissions(); // Refresh list (badges might change)

                    // If detail modal is open, check if this item belongs to it
                    if (activeCommission) {
                        const newItem = payload.new as CommissionItem;
                        const oldItem = payload.old as CommissionItem;
                        const relevantId = newItem?.commission_id || oldItem?.commission_id;

                        if (relevantId === activeCommission.id) {
                            fetchCommissionItems(activeCommission.id);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeCommission, activeTab]); // Re-sub if activeCommission changes to have correct ID in closure

    // Fetch print history when tab changes
    useEffect(() => {
        if (printTab === 'history') {
            fetchPrintHistory();
        }
    }, [printTab]);

    useEffect(() => {
        const state = location.state as { openCommissionId?: string } | null;
        if (state && state.openCommissionId) {
            const loadScannerTarget = async (id: string) => {
                let comm = commissions.find(c => c.id === id);
                if (!comm) {
                    const { data } = await supabase.from('commissions').select('*, suppliers(name)').eq('id', id).single();
                    if (data) comm = data as ExtendedCommission;
                }

                if (comm) {
                    handleOpenPrepare(comm);
                    window.history.replaceState({}, document.title);
                }
            };
            loadScannerTarget(state.openCommissionId);
        }
    }, [location, commissions]);

    // --- SEARCH LOGIC ---
    const performGlobalSearch = async (term: string) => {
        setGlobalSearchTerm(term);
        if (term.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const { data, error } = await supabase
                .from('commissions')
                .select('*, suppliers(name), commission_items(*, article:articles(name))')
                .or(`name.ilike.%${term}%,order_number.ilike.%${term}%,notes.ilike.%${term}%`)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            setSearchResults((data as ExtendedCommission[]) || []);
        } catch (err) {
            console.error("Search failed", err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchResultClick = (comm: ExtendedCommission) => {
        setShowSearchModal(false);
        handleOpenPrepare(comm);
    };

    const translateStatus = (status: string) => {
        switch (status) {
            case 'Draft': return 'Entwurf';
            case 'Preparing': return 'In Vorbereitung';
            case 'Ready': return 'Bereit';
            case 'Withdrawn': return 'Abgeschlossen';
            case 'ReturnPending': return 'Retoure (Angemeldet)';
            case 'ReturnReady': return 'Retoure (Abholbereit)';
            case 'ReturnComplete': return 'Retoure (Erledigt)';
            default: return status;
        }
    };

    // --- LOGGING HELPER ---
    const logCommissionEvent = async (commId: string, commName: string, action: string, details: string) => {
        if (!user) return;
        try {
            await supabase.from('commission_events').insert({
                commission_id: commId,
                commission_name: commName,
                user_id: user.id,
                action: action,
                details: details
            });
        } catch (err) {
            console.error("Failed to log event", err);
        }
    };

    const fetchCommissions = async () => {
        if (commissions.length === 0) setLoading(true);

        try {
            // IMPORTANT: Include commission_items to check backorder status locally
            let query = supabase
                .from('commissions')
                .select('*, suppliers(name), commission_items(*, article:articles(name))')
                .order('name', { ascending: true });

            if (activeTab === 'active') {
                query = query.is('deleted_at', null);
            } else if (activeTab === 'returns') {
                query = query.is('deleted_at', null);
            } else if (activeTab === 'withdrawn') {
                query = query.is('deleted_at', null);
            } else if (activeTab === 'trash') {
                query = query.not('deleted_at', 'is', null);
            }

            if (profile?.primary_warehouse_id) {
                query = query.eq('warehouse_id', profile.primary_warehouse_id);
            }

            const { data, error } = await query;
            if (error) throw error;

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const filteredData = (data as ExtendedCommission[]).filter(c => {
                if (activeTab === 'trash' && c.deleted_at) {
                    return new Date(c.deleted_at) > sevenDaysAgo;
                }
                return true;
            });

            setCommissions(filteredData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('commission_events')
                .select('*, profiles(full_name)')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            setHistoryLogs(data || []);
        } catch (err) {
            console.error("History fetch failed", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    // NEW: Fetch history for a specific commission
    const fetchCommissionSpecificHistory = async (commissionId: string) => {
        try {
            const { data, error } = await supabase
                .from('commission_events')
                .select('*, profiles(full_name)')
                .eq('commission_id', commissionId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLocalHistoryLogs(data || []);
        } catch (err) {
            console.error("Local history fetch failed", err);
        }
    };

    const fetchPrintHistory = async () => {
        setLoadingPrintHistory(true);
        try {
            const { data, error } = await supabase
                .from('commission_events')
                .select('*, commission:commissions(*), profiles(full_name)')
                .eq('action', 'labels_printed')
                .order('created_at', { ascending: false })
                .limit(15);

            if (error) throw error;
            setRecentPrintLogs(data || []);
        } catch (err) {
            console.error("Print History fetch failed", err);
        } finally {
            setLoadingPrintHistory(false);
        }
    };

    const handleOpenHistory = () => {
        setShowHistoryModal(true);
        fetchHistory();
    };

    const fetchSuppliers = async () => {
        // Fetch Suppliers AND check usage frequency for sorting
        try {
            const { data: sups } = await supabase.from('suppliers').select('*');

            // Get basic usage count from commission history (supplier_id field)
            const { data: usage } = await supabase.from('commissions').select('supplier_id');

            if (sups && usage) {
                const counts: Record<string, number> = {};
                usage.forEach((c: any) => {
                    if (c.supplier_id) counts[c.supplier_id] = (counts[c.supplier_id] || 0) + 1;
                });

                // Sort: Most used first, then alphabetical
                const sorted = sups.sort((a, b) => {
                    const countA = counts[a.id] || 0;
                    const countB = counts[b.id] || 0;
                    if (countA !== countB) return countB - countA; // Descending count
                    return a.name.localeCompare(b.name);
                });
                setSuppliers(sorted);
            } else if (sups) {
                // Fallback to alphabetical
                setSuppliers(sups.sort((a, b) => a.name.localeCompare(b.name)));
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchArticles = async () => {
        if (!profile?.primary_warehouse_id) return;
        const { data } = await supabase
            .from('articles')
            .select('*')
            .eq('warehouse_id', profile.primary_warehouse_id);

        if (data) {
            // Fix: Map DB column image_url to image property so UI displays thumbnail correctly
            const mapped = data.map((item: any) => ({
                ...item,
                image: item.image_url
            }));
            setAvailableArticles(mapped);
        }
    };

    const fetchCommissionItems = async (commissionId: string) => {
        const { data } = await supabase
            .from('commission_items')
            .select('*, article:articles(*)')
            .eq('commission_id', commissionId);

        if (data) {
            setCommItems(data.map((item: any) => ({
                ...item,
                article: item.article
            })));
        }
        return data;
    };

    // --- TRASH / DELETE LOGIC ---
    const requestDelete = (id: string, name: string, mode: 'trash' | 'permanent', e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setDeleteTarget({ id, name, mode });
    };

    const executeDelete = async () => {
        if (!deleteTarget) return;
        setIsSubmitting(true);

        try {
            if (deleteTarget.mode === 'trash') {
                await supabase.from('commissions').update({ deleted_at: new Date().toISOString() }).eq('id', deleteTarget.id);
                await logCommissionEvent(deleteTarget.id, deleteTarget.name, 'deleted', 'In Papierkorb verschoben');
                setShowPrepareModal(false);
            } else {
                await supabase.from('commissions').delete().eq('id', deleteTarget.id);
                await logCommissionEvent(deleteTarget.id, deleteTarget.name, 'permanently_deleted', 'Endgültig gelöscht');
            }

            fetchCommissions();
            setDeleteTarget(null);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const restoreFromTrash = async (id: string, name: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        try {
            await supabase.from('commissions').update({ deleted_at: null }).eq('id', id);
            await logCommissionEvent(id, name, 'restored', 'Aus Papierkorb wiederhergestellt');
            fetchCommissions();
        } catch (e: any) {
            alert(e.message);
        }
    };

    // --- PRINT QUEUE LOGIC ---

    const toggleQueueSelection = (id: string) => {
        const newSet = new Set(selectedPrintIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedPrintIds(newSet);
    };

    const markLabelsAsPrinted = async () => {
        if (selectedPrintIds.size === 0) return;
        const ids = Array.from(selectedPrintIds);

        const commissionsToPrint = commissions.filter(c => selectedPrintIds.has(c.id));

        const printData: { comm: Commission, items: CommissionItem[] }[] = [];

        setIsSubmitting(true);
        try {
            for (const comm of commissionsToPrint) {
                const { data } = await supabase.from('commission_items').select('*, article:articles(*)').eq('commission_id', comm.id);
                const items = data ? data.map((i: any) => ({ ...i, article: i.article })) : [];
                printData.push({ comm, items });

                await logCommissionEvent(comm.id, comm.name, 'labels_printed', 'Etiketten aus Warteschlange gedruckt');
            }

            generateBatchPDF(printData);

            await supabase.from('commissions').update({ needs_label: false }).in('id', ids);

            setSelectedPrintIds(new Set());
            fetchCommissions();

            setPrintTab('history');
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddToQueue = async (id: string, name: string) => {
        await supabase.from('commissions').update({ needs_label: true }).eq('id', id);
        await logCommissionEvent(id, name, 'queued', 'Zur Druckwarteschlange hinzugefügt');
        setShowLabelOptionsModal(null);
        setShowLabelUpdateModal(false);
        fetchCommissions();

        // If we are supposed to return to Dashboard, do it now
        if (returnPath) {
            navigate(returnPath);
            setReturnPath(null);
        }
    };


    // --- CREATE / EDIT MODAL LOGIC ---

    const resetCreateForm = () => {
        setNewComm({ order_number: '', name: '', notes: '' });
        setTempItems([]);
        setSelectedCategory(null);
        setIsEditMode(false);
        setEditingCommissionId(null);
        // Reset expansions and search
        setExpandStockSearch(false);
        setExpandSupplierList(false);
        setStockSearchTerm('');
        setSupplierSearchTerm('');
    };

    const openCreateModal = () => {
        resetCreateForm();
        setShowCreateModal(true);
    };

    const handleCloseCreateModal = () => {
        setShowCreateModal(false);
        if (returnPath) {
            navigate(returnPath);
            setReturnPath(null);
        }
    };

    const handleEditCommission = async (comm: Commission, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        resetCreateForm();

        setIsEditMode(true);
        setEditingCommissionId(comm.id);
        setNewComm({
            order_number: comm.order_number || '',
            name: comm.name,
            notes: comm.notes || ''
        });

        const itemsData = await fetchCommissionItems(comm.id);
        if (itemsData) {
            const mappedTempItems: TempCommissionItem[] = itemsData.map((item: any) => ({
                uniqueId: Math.random().toString(36).substr(2, 9), // New temp ID
                type: item.type,
                amount: item.amount,
                article: item.article,
                customName: item.custom_name,
                externalReference: item.external_reference,
                attachmentData: item.attachment_data,
                isBackorder: item.is_backorder,
                notes: item.notes,
                isPicked: item.is_picked
            }));
            setTempItems(mappedTempItems);
        }

        setShowCreateModal(true);
        setShowPrepareModal(false);
    };

    const addTempStockItem = (article: Article) => {
        setTempItems(prev => {
            const existing = prev.find(i => i.type === 'Stock' && i.article?.id === article.id);
            if (existing) {
                return prev.map(i => i.uniqueId === existing.uniqueId ? { ...i, amount: i.amount + 1 } : i);
            }
            return [...prev, {
                uniqueId: Math.random().toString(36).substr(2, 9),
                type: 'Stock',
                amount: 1,
                article: article,
                isPicked: false
            }];
        });
    };

    const addManualItem = () => {
        setTempItems(prev => [...prev, {
            uniqueId: Math.random().toString(36).substr(2, 9),
            type: 'External',
            amount: 1,
            customName: 'Freitext Position', // Default
            externalReference: '',
            isPicked: false
        }]);
    };

    const addTempExternalItem = (supplier: Supplier) => {
        setTempItems(prev => [...prev, {
            uniqueId: Math.random().toString(36).substr(2, 9),
            type: 'External',
            amount: 1,
            customName: supplier.name,
            supplierId: supplier.id,
            externalReference: '',
            isPicked: false
        }]);
    };

    const updateTempItem = (uniqueId: string, field: keyof TempCommissionItem, value: any) => {
        setTempItems(prev => prev.map(i => i.uniqueId === uniqueId ? { ...i, [field]: value } : i));
    };

    const removeTempItem = (uniqueId: string) => {
        setTempItems(prev => prev.filter(i => i.uniqueId !== uniqueId));
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handlePasteAttachment = async (uniqueId: string) => {
        try {
            const clipboardItems = await navigator.clipboard.read();
            let foundImage = false;
            for (const item of clipboardItems) {
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    const file = new File([blob], `pasted_${Date.now()}.png`, { type: imageType });

                    if (file.size > 3 * 1024 * 1024) {
                        alert("Bild zu groß! Max 3MB.");
                        return;
                    }

                    const base64 = await fileToBase64(file);
                    updateTempItem(uniqueId, 'attachmentData', base64);
                    foundImage = true;
                    break;
                }
            }
            if (!foundImage) {
                alert("Kein Bild in der Zwischenablage.");
            }
        } catch (err) {
            console.error(err);
            alert("Zugriff verweigert oder nicht unterstützt. Bitte Datei-Upload nutzen.");
        }
    };

    const handleFileUpload = async (uniqueId: string, files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];

        // Limit file size to 3MB
        if (file.size > 3 * 1024 * 1024) {
            alert("Datei zu groß! Max 3MB erlaubt.");
            return;
        }

        try {
            const base64 = await fileToBase64(file);
            updateTempItem(uniqueId, 'attachmentData', base64);
        } catch (e) {
            alert("Fehler beim Lesen der Datei.");
        }
    };

    // --- DRAG AND DROP HANDLERS ---
    const handleDragEnter = (e: React.DragEvent, uniqueId: string) => {
        e.preventDefault();
        e.stopPropagation();
        updateTempItem(uniqueId, 'isDragging', true);
    };

    const handleDragOver = (e: React.DragEvent, uniqueId: string) => {
        e.preventDefault();
        e.stopPropagation();
        // Necessary to allow dropping
    };

    const handleDragLeave = (e: React.DragEvent, uniqueId: string) => {
        e.preventDefault();
        e.stopPropagation();

        // Prevent flicker when dragging over child elements
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;

        updateTempItem(uniqueId, 'isDragging', false);
    };

    const handleDrop = async (e: React.DragEvent, uniqueId: string) => {
        e.preventDefault();
        e.stopPropagation();
        updateTempItem(uniqueId, 'isDragging', false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            await handleFileUpload(uniqueId, e.dataTransfer.files);
        }
    };

    const handleFinalizeCreate = async () => {
        if (!profile?.primary_warehouse_id) {
            alert("Bitte wähle zuerst ein Hauptlager im Dashboard.");
            return;
        }
        if (!newComm.name) return;

        setIsSubmitting(true);
        try {
            let commId = editingCommissionId;

            const payload: any = {
                order_number: newComm.order_number,
                name: newComm.name,
                notes: newComm.notes,
                warehouse_id: profile.primary_warehouse_id,
            };

            if (!isEditMode) {
                payload.status = 'Draft';
            }

            Object.keys(payload).forEach(key => (payload as any)[key] === undefined && delete (payload as any)[key]);

            if (isEditMode && commId) {
                const currentComm = commissions.find(c => c.id === commId);
                if (currentComm && currentComm.status === 'Ready') {
                    payload.status = 'Preparing';
                    await logCommissionEvent(commId, newComm.name, 'status_change', 'Automatisch zurückgestellt auf "In Vorbereitung" wegen Bearbeitung');
                }

                await supabase.from('commissions').update(payload).eq('id', commId);
                await logCommissionEvent(commId, newComm.name, 'updated', 'Kommission bearbeitet');
            } else {
                const { data: commData, error: commError } = await supabase.from('commissions').insert(payload).select().single();
                if (commError) throw commError;
                commId = commData.id;
                await logCommissionEvent(commId, newComm.name, 'created', 'Neue Kommission erstellt');
            }

            if (!commId) throw new Error("Commission ID missing");

            if (isEditMode) {
                await supabase.from('commission_items').delete().eq('commission_id', commId);
            }

            if (tempItems.length > 0) {
                const itemsPayload = tempItems.map(item => ({
                    commission_id: commId,
                    type: item.type,
                    amount: item.amount,
                    article_id: item.type === 'Stock' ? item.article?.id : null,
                    custom_name: item.type === 'External' ? item.customName : null,
                    external_reference: item.type === 'External' ? item.externalReference : null,
                    attachment_data: item.attachmentData || null,
                    is_backorder: item.isBackorder || false,
                    notes: item.notes || null,
                    is_picked: item.isPicked || false
                }));

                const { error: itemsError } = await supabase.from('commission_items').insert(itemsPayload);
                if (itemsError) throw itemsError;
            }

            setShowCreateModal(false);
            fetchCommissions();

            if (!isEditMode) {
                setShowLabelOptionsModal(commId);
            } else {
                // If edit mode, handle navigation back immediately
                handleCloseCreateModal();
            }

        } catch (err: any) {
            alert("Fehler: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- PREPARE MODAL LOGIC ---

    const handleOpenPrepare = async (comm: Commission) => {
        setActiveCommission(comm);
        setLabelDataChanged(false); // Reset tracking
        await fetchCommissionItems(comm.id);
        fetchCommissionSpecificHistory(comm.id); // NEW: Load history
        setShowPrepareModal(true);
    };

    const handleClosePrepare = () => {
        if (labelDataChanged && activeCommission) {
            // If critical data changed (notes/backorder), ask for label reprint
            setShowLabelUpdateModal(true);
        }
        setShowPrepareModal(false);
    };

    const handleSetReadyTrigger = () => {
        if (!activeCommission || !user) return;
        const allDone = commItems.length === 0 || commItems.every(i => i.is_picked);
        if (!allDone) return;

        const hasBackorders = commItems.some(i => i.is_backorder);
        if (hasBackorders) {
            // This should ideally be blocked by UI state, but double check here
            return;
        }

        setShowConfirmReadyModal(true);
    };

    const executeSetReady = async () => {
        if (!activeCommission || !user) return;

        setIsSubmitting(true);
        try {
            const stockItems = commItems.filter(i => i.type === 'Stock');

            if (activeCommission.status !== 'Ready' && activeCommission.status !== 'Withdrawn') {
                for (const item of stockItems) {
                    if (item.article && item.article.stock >= item.amount) {
                        await supabase.from('articles').update({ stock: item.article.stock - item.amount }).eq('id', item.article.id);
                        await supabase.from('stock_movements').insert({
                            article_id: item.article.id,
                            user_id: user.id,
                            amount: -item.amount,
                            type: 'commission_pick',
                            reference: `Komm. ${activeCommission.order_number}`
                        });
                    }
                }
            }

            const { error } = await supabase.from('commissions').update({ status: 'Ready' }).eq('id', activeCommission.id);
            if (error) throw error;

            await logCommissionEvent(activeCommission.id, activeCommission.name, 'status_change', 'Status auf BEREIT gesetzt. Bestand gebucht.');

            setActiveCommission(prev => prev ? { ...prev, status: 'Ready' } : null);
            fetchCommissions();
            setShowConfirmReadyModal(false);
        } catch (err: any) {
            alert("Fehler: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleWithdrawTrigger = () => {
        if (!activeCommission) return;
        setShowConfirmWithdrawModal(true);
    };

    const executeWithdraw = async () => {
        if (!activeCommission) return;
        setIsSubmitting(true);
        try {
            await supabase.from('commissions').update({ status: 'Withdrawn', withdrawn_at: new Date().toISOString() }).eq('id', activeCommission.id);
            await logCommissionEvent(activeCommission.id, activeCommission.name, 'status_change', 'Kommission entnommen (Abgeschlossen)');

            setShowConfirmWithdrawModal(false);
            setShowPrepareModal(false);
            fetchCommissions();
        } catch (err: any) { alert("Fehler: " + err.message); } finally { setIsSubmitting(false); }
    };

    // --- RESET STATUS LOGIC (Manual) ---
    const executeResetStatus = async () => {
        if (!activeCommission) return;
        if (!window.confirm("Status wirklich auf 'In Vorbereitung' zurücksetzen?")) return;

        setIsSubmitting(true);
        try {
            await supabase.from('commissions').update({ status: 'Preparing' }).eq('id', activeCommission.id);
            await logCommissionEvent(activeCommission.id, activeCommission.name, 'status_change', 'Status manuell zurückgestellt');

            setActiveCommission(prev => prev ? { ...prev, status: 'Preparing' } : null);
            fetchCommissions();
        } catch (err: any) {
            alert("Fehler: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const executeRevertWithdrawal = async () => {
        if (!activeCommission) return;
        if (!window.confirm("Möchtest du diese Kommission wieder auf 'Bereit' setzen?")) return;

        setIsSubmitting(true);
        try {
            await supabase.from('commissions').update({
                status: 'Ready',
                withdrawn_at: null
            }).eq('id', activeCommission.id);

            await logCommissionEvent(activeCommission.id, activeCommission.name, 'status_change', 'Entnahme widerrufen (Status: Bereit)');

            setShowPrepareModal(false);
            fetchCommissions();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- RETURN FLOW ACTIONS ---

    const handleInitReturn = async () => {
        if (!activeCommission) return;
        if (!window.confirm("Kommission als 'Zurückschreiben' (Retoure) markieren?")) return;

        setIsSubmitting(true);
        try {
            await supabase.from('commissions').update({
                status: 'ReturnPending',
                is_processed: false
            }).eq('id', activeCommission.id);

            await logCommissionEvent(activeCommission.id, activeCommission.name, 'status_change', 'Als Retoure markiert');

            setShowPrepareModal(false);
            setActiveTab('returns');
            fetchCommissions();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReturnToReady = async () => {
        if (!activeCommission) return;

        setIsSubmitting(true);
        try {
            await supabase.from('commissions').update({ status: 'ReturnReady' }).eq('id', activeCommission.id);

            printReturnLabel(activeCommission);
            await logCommissionEvent(activeCommission.id, activeCommission.name, 'status_change', 'Retoure ins Abholregal gelegt');

            setActiveCommission(prev => prev ? { ...prev, status: 'ReturnReady' } : null);
            fetchCommissions();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCompleteReturn = async () => {
        if (!activeCommission) return;

        setIsSubmitting(true);
        try {
            await supabase.from('commissions').update({ status: 'ReturnComplete' }).eq('id', activeCommission.id);
            await logCommissionEvent(activeCommission.id, activeCommission.name, 'status_change', 'Retoure abgeholt (Abgeschlossen)');

            setShowPrepareModal(false);
            fetchCommissions();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const printReturnLabel = (comm: Commission) => {
        const printWindow = window.open('', 'PRINT_RET', 'height=400,width=600');
        if (!printWindow) return;

        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`COMM:${comm.id}`)}`;
        const dateStr = new Date().toLocaleDateString('de-DE');

        printWindow.document.write(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 20px; border: 5px solid black; box-sizing: border-box; height: 100vh; display: flex; flex-direction: column; justify-content: center;">
             <h1 style="font-size: 3em; margin: 0 0 20px 0; font-weight: 900;">RÜCKSENDUNG</h1>
             <h2 style="margin:0; font-size: 1.5em;">${comm.name}</h2>
             <p style="margin: 10px 0; font-size: 1.2em;">Auftrag: ${comm.order_number || '-'}</p>
             <div style="margin: 20px 0;">
                <img src="${qrUrl}" style="width: 150px; height: 150px;" />
             </div>
             <p style="font-weight:bold; font-size: 1.2em;">Datum: ${dateStr}</p>
          </body>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </html>
      `);
        printWindow.document.close();
    };

    // --- PRINTING ---

    const handleSinglePrint = async (commId?: string) => {
        const id = commId || activeCommission?.id;
        if (!id) return;

        let comm = activeCommission;
        let items = commItems;

        if (!comm || comm.id !== id) {
            const { data: c } = await supabase.from('commissions').select('*').eq('id', id).single();
            const { data: i } = await supabase.from('commission_items').select('*, article:articles(*)').eq('commission_id', id);
            comm = c;
            items = i ? i.map((x: any) => ({ ...x, article: x.article })) : [];
        }

        if (comm) {
            generateBatchPDF([{ comm, items }]);
            await logCommissionEvent(comm.id, comm.name, 'labels_printed', 'Etikett einzeln gedruckt');
        }
        setShowLabelOptionsModal(null);
        setShowLabelUpdateModal(false);

        if (printTab === 'history') {
            fetchPrintHistory();
        }

        // Check return path after printing and closing the modal
        if (returnPath) {
            navigate(returnPath);
            setReturnPath(null);
        }
    };

    const generateBatchPDF = (data: { comm: Commission, items: CommissionItem[] }[]) => {
        const printWindow = window.open('', 'PRINT_COMM', 'height=800,width=600');
        if (!printWindow) return;

        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        let docTitle = `Kommissionen_Batch_${timestamp}`;

        if (data.length === 1) {
            const cleanName = data[0].comm.name.replace(/[^a-zA-Z0-9-_]/g, '_');
            docTitle = `Kommission_${cleanName}_${timestamp}`;
        }

        const pagesHtml = data.map(({ comm, items }) => {
            const stockItems = items.filter(i => i.type === 'Stock');
            const extItems = items.filter(i => i.type === 'External');
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`COMM:${comm.id}`)}`;

            const notesHtml = comm.notes ? `<div class="notes" style="font-size: 10pt; margin-top: 2mm; font-style: italic; color: #000; border-top: 1px dotted #aaa; padding-top: 1mm; line-height: 1.2;">${comm.notes}</div>` : '';

            const renderLocation = (article: Article) => {
                if (!article.category && !article.location) return '-';
                return `${article.category || ''} / ${article.location || ''}`;
            };

            return `
            <div class="page">
                <div class="label-area">
                    <div class="header-text">
                        <div class="commission-title">${comm.name}</div>
                        <div class="order-id">Auftrag: ${comm.order_number || '-'}</div>
                        ${notesHtml}
                    </div>
                    <div class="qr-container"><img src="${qrUrl}" class="qr-code" /></div>
                </div>
                <div class="fold-line"><span class="fold-text">Hier falten / knicken</span></div>
                <div class="list-area">
                    ${extItems.length > 0 ? `<div class="list-title">Erwartete externe Bestellungen:</div><ul>${extItems.map(i => `<li><div class="checkbox"></div><div class="item-text"><strong>Externe Bestellung:</strong> ${i.custom_name}${i.is_backorder ? ' <b>[RÜCKSTAND]</b>' : ''}<br><span style="font-size: 8pt; color: #555;">(Vorgang: ${i.external_reference || 'N/A'})</span>${i.notes ? `<br><span style="font-style: italic; font-size: 8pt;">Note: ${i.notes}</span>` : ''}</div></li>`).join('')}</ul><br>` : ''}
                    ${stockItems.length > 0 ? `<div class="list-title">Material aus Lager:</div><ul>${stockItems.map(i => {
                return `<li><div class="checkbox"></div><div class="item-text"><strong>${i.amount}x</strong> ${i.article?.name}${i.is_backorder ? ' <b>[RÜCKSTAND]</b>' : ''}<br><span style="font-size: 8pt; color: #555;">Lagerort: ${i.article ? renderLocation(i.article) : '-'}</span>${i.notes ? `<br><span style="font-style: italic; font-size: 8pt;">Note: ${i.notes}</span>` : ''}</div></li>`;
            }).join('')}</ul>` : ''}
                </div>
            </div>
          `;
        }).join('');

        printWindow.document.write(`
        <html>
        <head>
            <title>${docTitle}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');
                body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background: white; }
                @page { size: 105mm 148mm; margin: 0; }
                .page { width: 105mm; height: 147mm; margin: 0 auto; position: relative; box-sizing: border-box; overflow: hidden; page-break-after: always; }
                .page:last-child { page-break-after: auto; }
                .label-area { position: absolute; top: 8mm; left: 50%; transform: translateX(-50%); width: 90mm; height: 50mm; border: 1px solid #ddd; padding: 4mm; box-sizing: border-box; display: grid; grid-template-columns: 1fr 30mm; grid-template-rows: auto 1fr auto; }
                .header-text { grid-column: 1 / 2; display: flex; flex-direction: column; justify-content: center; }
                .commission-title { font-size: 16pt; font-weight: 800; color: black; line-height: 1.1; max-height: 3em; overflow: hidden; }
                .order-id { font-size: 11pt; font-weight: 500; color: #444; margin-top: 2mm; }
                .qr-container { grid-column: 2 / 3; grid-row: 1 / 4; display: flex; justify-content: flex-end; align-items: flex-start; }
                .qr-code { width: 28mm; height: 28mm; }
                .fold-line { position: absolute; top: 62mm; left: 5mm; right: 5mm; border-top: 1px dashed #999; text-align: center; font-size: 8pt; color: #999; }
                .fold-text { background: white; padding: 0 2mm; position: relative; top: -0.7em; }
                .list-area { position: absolute; top: 68mm; left: 7.5mm; right: 7.5mm; bottom: 5mm; font-size: 9pt; }
                .list-title { font-weight: 700; margin-bottom: 2mm; font-size: 10pt; border-bottom: 1px solid black; padding-bottom: 1mm; }
                ul { padding-left: 0; margin: 0; list-style: none; }
                li { margin-bottom: 2mm; display: flex; align-items: flex-start; gap: 2mm; }
                .checkbox { width: 3mm; height: 3mm; border: 1px solid #333; margin-top: 1mm; flex-shrink: 0; }
                @media print { body { background: none; } .label-area { border: none; } }
            </style>
        </head>
        <body>
            ${pagesHtml}
            <script>window.onload = function() { setTimeout(() => { window.print(); }, 800); }</script>
        </body>
        </html>
      `);
        printWindow.document.close();
    };

    const toggleActiveItemPicked = async (itemId: string, currentVal: boolean) => {
        const item = commItems.find(i => i.id === itemId);
        // LOCK: If backorder, cannot toggle pick
        if (item && item.is_backorder) return;

        const newVal = !currentVal;
        const { error } = await supabase.from('commission_items').update({ is_picked: newVal }).eq('id', itemId);

        if (!error) {
            setCommItems(prev => prev.map(i => i.id === itemId ? { ...i, is_picked: newVal } : i));

            // NEW: Auto-switch from Draft to Preparing on first pick
            if (newVal === true && activeCommission?.status === 'Draft') {
                await supabase.from('commissions').update({ status: 'Preparing' }).eq('id', activeCommission.id);

                setActiveCommission(prev => prev ? { ...prev, status: 'Preparing' } : null);
                setCommissions(prev => prev.map(c => c.id === activeCommission.id ? { ...c, status: 'Preparing' } : c));

                await logCommissionEvent(activeCommission.id, activeCommission.name, 'status_change', 'Status automatisch auf "In Vorbereitung" gesetzt (Erster Artikel gepickt)');
            }

            if (newVal === false && activeCommission?.status === 'Ready') {
                await supabase.from('commissions').update({ status: 'Preparing' }).eq('id', activeCommission.id);

                setActiveCommission(prev => prev ? { ...prev, status: 'Preparing' } : null);
                setCommissions(prev => prev.map(c => c.id === activeCommission.id ? { ...c, status: 'Preparing' } : c));

                await logCommissionEvent(activeCommission.id, activeCommission.name, 'status_change', 'Automatisch zurückgestellt auf "In Vorbereitung" (Artikel abgewählt)');
            }
        }
    };

    const toggleBackorder = async (itemId: string, currentVal: boolean) => {
        const newVal = !currentVal;
        const { error } = await supabase.from('commission_items').update({ is_backorder: newVal }).eq('id', itemId);
        if (!error) {
            setCommItems(prev => prev.map(i => i.id === itemId ? { ...i, is_backorder: newVal } : i));
            setLabelDataChanged(true);
        }
    };

    const saveItemNote = async (itemId: string, note: string) => {
        const { error } = await supabase.from('commission_items').update({ notes: note }).eq('id', itemId);
        if (!error) {
            setCommItems(prev => prev.map(i => i.id === itemId ? { ...i, notes: note } : i));
            setEditingItemNote(null);
            setLabelDataChanged(true);
        }
    };

    const allItemsPicked = commItems.length === 0 || commItems.every(i => i.is_picked);
    const hasBackorders = commItems.some(i => i.is_backorder);

    // --- CATEGORIZATION HELPER ---
    const renderCategory = (title: string, statusKey: 'ready' | 'preparing' | 'draft' | 'returnReady' | 'returnPending', items: ExtendedCommission[], colorClass: string) => {
        const isCollapsed = collapsedCategories[statusKey];
        if (items.length === 0) return null;

        return (
            <div className="mb-4">
                <div
                    className="flex items-center justify-between mb-2 px-2 cursor-pointer select-none"
                    onClick={() => setCollapsedCategories(prev => ({ ...prev, [statusKey]: !prev[statusKey] }))}
                >
                    <div className="flex items-center gap-2">
                        <ChevronDown size={18} className={`text-white/50 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                        <h3 className={`font-bold uppercase tracking-wider text-xs ${colorClass}`}>{title} ({items.length})</h3>
                    </div>
                    <div className="h-px bg-white/10 flex-1 ml-4"></div>
                </div>

                {!isCollapsed && (
                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                        initial="hidden"
                        animate="visible"
                        variants={{
                            hidden: { opacity: 0 },
                            visible: {
                                opacity: 1,
                                transition: {
                                    staggerChildren: 0.05
                                }
                            }
                        }}
                    >
                        <AnimatePresence mode='popLayout'>
                            {items.map(comm => {
                                const hasItemBackorder = comm.commission_items?.some((i: any) => i.is_backorder);

                                return (
                                    <motion.div
                                        key={comm.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        onClick={() => handleOpenPrepare(comm)}
                                        className={`cursor-pointer group relative h-full flex flex-col rounded-3xl overflow-hidden border backdrop-blur-lg shadow-lg transition-all ${hasItemBackorder ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/50' :
                                            statusKey === 'preparing' ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/50' : // NEW YELLOW STYLE
                                                'bg-white/10 hover:bg-white/20 border-white/20 hover:border-white/30'
                                            }`}
                                    >
                                        <div className={`absolute top-0 left-0 w-1 h-full ${hasItemBackorder ? 'bg-red-500' :
                                            (statusKey === 'ready' ? 'bg-emerald-400' :
                                                statusKey === 'preparing' ? 'bg-amber-400' : // NEW YELLOW BAR
                                                    statusKey === 'returnReady' ? 'bg-purple-400' :
                                                        statusKey === 'returnPending' ? 'bg-orange-400' : 'bg-white/60')}`}
                                        />
                                        <div className="flex justify-between items-start p-4 pl-5 flex-1">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between">
                                                    <h3 className={`text-lg font-bold truncate pr-2 ${hasItemBackorder ? 'text-white' : 'text-white'}`}>{comm.name}</h3>
                                                    {hasItemBackorder && <AlertTriangle size={16} className="text-red-500 shrink-0" />}
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                                    {comm.order_number && (
                                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-blue-500/20 text-blue-300 border-blue-500/30">
                                                            {comm.order_number}
                                                        </span>
                                                    )}
                                                    {comm.notes && (
                                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-white/10 text-white/70 border-white/10 max-w-[150px] truncate">
                                                            {comm.notes}
                                                        </span>
                                                    )}
                                                    {comm.commission_items?.map((item: any) => {
                                                        // Visual indicator for item backorder directly on tile
                                                        const isBo = item.is_backorder;

                                                        if (item.type === 'Stock' && item.article) {
                                                            return (
                                                                <span key={item.id} className={`px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1 max-w-[200px] truncate ${isBo ? 'bg-red-500/20 text-red-200 border-red-500/40' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'}`}>
                                                                    {item.amount > 1 && <span className="opacity-70 text-[10px]">{item.amount}x</span>}
                                                                    {item.article.name}
                                                                    {isBo && item.notes && <span className="text-[9px] opacity-70 ml-1 italic">{item.notes}</span>}
                                                                </span>
                                                            );
                                                        }
                                                        if (item.type === 'External') {
                                                            return (
                                                                <span key={item.id} className={`px-2.5 py-0.5 rounded-full text-xs font-medium border max-w-[200px] truncate ${isBo ? 'bg-red-500/20 text-red-200 border-red-500/40' : 'bg-purple-500/10 text-purple-300 border-purple-500/20'}`}>
                                                                    {item.custom_name}{item.external_reference ? `: ${item.external_reference}` : ''}
                                                                    {isBo && item.notes && <span className="text-[9px] opacity-70 ml-1 italic">{item.notes}</span>}
                                                                </span>
                                                            );
                                                        }
                                                        return null;
                                                    })}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <div className="flex gap-2">
                                                    <button onClick={(e) => handleEditCommission(comm, e)} className="p-2 bg-white/5 hover:bg-white/20 rounded-full text-white/60 hover:text-white transition-colors"><Edit2 size={16} /></button>
                                                    <button onClick={(e) => requestDelete(comm.id, comm.name, 'trash', e)} className="p-2 bg-white/5 hover:bg-white/20 rounded-full text-white/60 hover:text-rose-400 transition-colors"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </motion.div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-24">
            <header className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-200">Komm.</h1>
                    <div className="flex gap-2">
                        <Button icon={<Search size={18} />} variant="secondary" onClick={() => setShowSearchModal(true)} className="px-4" />
                        <Button icon={<History size={18} />} variant="secondary" onClick={handleOpenHistory} className="px-4" />
                        <Button icon={<Plus size={18} />} onClick={openCreateModal}>Neu</Button>
                    </div>
                </div>
                <div className="flex gap-2 p-1 bg-black/20 rounded-xl w-full sm:w-fit border border-white/5 overflow-x-auto">
                    <button onClick={() => setActiveTab('active')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'active' ? 'bg-white/10 text-white shadow' : 'text-white/50'}`}>Aktive</button>
                    <button onClick={() => setActiveTab('withdrawn')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'withdrawn' ? 'bg-white/10 text-white shadow' : 'text-white/50'}`}>Entnommen</button>
                    <button onClick={() => setActiveTab('trash')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'trash' ? 'bg-white/10 text-white shadow' : 'text-white/50'}`}>
                        <Trash2 size={14} /> Papierkorb
                    </button>
                    <button onClick={() => setActiveTab('returns')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'returns' ? 'bg-white/10 text-white shadow' : 'text-white/50'}`}>Retouren</button>
                </div>
            </header>

            {/* --- PERMANENT PRINT AREA (Queue & History) - Only in Active Tab --- */}
            {activeTab === 'active' && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6 animate-in fade-in">
                    <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setShowPrintArea(!showPrintArea)}>
                        <div className="flex items-center gap-2 text-blue-300">
                            <Printer size={20} />
                            <span className="font-bold">Etikettendruck</span>
                        </div>
                        <ChevronDown size={18} className={`text-blue-300/50 transition-transform ${showPrintArea ? 'rotate-180' : ''}`} />
                    </div>

                    {showPrintArea && (
                        <div className="mt-4">
                            {/* Tabs */}
                            <div className="flex gap-2 mb-4 border-b border-white/10 pb-1">
                                <button
                                    onClick={() => setPrintTab('queue')}
                                    className={`text-xs font-medium px-3 py-2 rounded-t-lg transition-colors ${printTab === 'queue' ? 'bg-blue-600 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
                                >
                                    Warteschlange ({queueItems.length})
                                </button>
                                <button
                                    onClick={() => setPrintTab('history')}
                                    className={`text-xs font-medium px-3 py-2 rounded-t-lg transition-colors ${printTab === 'history' ? 'bg-blue-600 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
                                >
                                    Zuletzt gedruckt
                                </button>
                            </div>

                            {/* Content */}
                            {printTab === 'queue' ? (
                                <div className="space-y-3 animate-in fade-in">
                                    {queueItems.length > 0 ? (
                                        <>
                                            <div className="flex gap-2">
                                                <Button
                                                    className="text-xs h-8 bg-blue-600 hover:bg-blue-500 border-none"
                                                    onClick={markLabelsAsPrinted}
                                                    disabled={selectedPrintIds.size === 0 || isSubmitting}
                                                >
                                                    {isSubmitting ? <Loader2 className="animate-spin" /> : `Ausgewählte Drucken (${selectedPrintIds.size})`}
                                                </Button>
                                                <button onClick={() => setSelectedPrintIds(new Set(queueItems.map(c => c.id)))} className="text-xs text-white/50 hover:text-white px-2">Alle wählen</button>
                                                <button onClick={() => setSelectedPrintIds(new Set())} className="text-xs text-white/50 hover:text-white px-2">Keine</button>
                                            </div>
                                            <div className="max-h-40 overflow-y-auto border-t border-white/5 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {queueItems.map(c => (
                                                    <div key={c.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border ${selectedPrintIds.has(c.id) ? 'bg-blue-500/20 border-blue-500/40' : 'bg-white/5 border-transparent hover:bg-white/10'}`} onClick={() => toggleQueueSelection(c.id)}>
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedPrintIds.has(c.id) ? 'bg-blue-500 border-blue-500 text-white' : 'border-white/30'}`}>
                                                            {selectedPrintIds.has(c.id) && <Check size={10} />}
                                                        </div>
                                                        <span className="text-sm text-white truncate">{c.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center py-4 text-white/40 text-xs">Keine ausstehenden Druckaufträge.</div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2 animate-in fade-in max-h-60 overflow-y-auto">
                                    {loadingPrintHistory ? (
                                        <div className="text-center py-4"><Loader2 className="animate-spin text-blue-400 mx-auto" /></div>
                                    ) : recentPrintLogs.length === 0 ? (
                                        <div className="text-center py-4 text-white/40 text-xs">Keine Historie vorhanden.</div>
                                    ) : (
                                        recentPrintLogs.map(log => {
                                            const commExists = !!log.commission;
                                            return (
                                                <div key={log.id} className={`flex items-center justify-between p-2 rounded-lg border border-white/5 ${commExists ? 'bg-white/5' : 'bg-white/5 opacity-50'}`}>
                                                    <div className="min-w-0 flex-1 pr-2">
                                                        <div className="text-sm font-bold text-white truncate">{log.commission_name}</div>
                                                        <div className="text-xs text-white/50 flex gap-2">
                                                            <span>{new Date(log.created_at).toLocaleString()}</span>
                                                            <span>• {log.profiles?.full_name?.split(' ')[0]}</span>
                                                        </div>
                                                    </div>
                                                    {commExists ? (
                                                        <button
                                                            onClick={() => handleSinglePrint(log.commission_id)}
                                                            className="p-2 bg-blue-500/20 text-blue-300 hover:bg-blue-500 hover:text-white rounded-lg transition-colors"
                                                            title="Erneut drucken"
                                                        >
                                                            <Printer size={16} />
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] text-rose-400 italic">Gelöscht</span>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-emerald-400" /></div> : (
                <div className="grid grid-cols-1 gap-4">
                    {commissions.length === 0 && <div className="text-white/40 text-center py-10">Keine Einträge vorhanden.</div>}

                    {/* ACTIVE TAB */}
                    {activeTab === 'active' && (
                        <>
                            {renderCategory("Bereitgestellt", 'ready', commissions.filter(c => c.status === 'Ready'), 'text-emerald-400')}
                            {renderCategory("In Vorbereitung", 'preparing', commissions.filter(c => c.status === 'Preparing'), 'text-amber-400')}
                            {renderCategory("Entwürfe", 'draft', commissions.filter(c => c.status === 'Draft'), 'text-white/60')}
                        </>
                    )}

                    {/* RETURNS TAB */}
                    {activeTab === 'returns' && (
                        <>
                            {renderCategory("Abholbereit (Warten auf Großhändler)", 'returnReady', commissions.filter(c => c.status === 'ReturnReady'), 'text-purple-400')}
                            {renderCategory("Angemeldet (Muss ins Regal)", 'returnPending', commissions.filter(c => c.status === 'ReturnPending'), 'text-orange-400')}
                        </>
                    )}

                    {/* WITHDRAWN TAB */}
                    {activeTab === 'withdrawn' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
                            {commissions.filter(c => ['Withdrawn', 'ReturnComplete'].includes(c.status)).map(comm => (
                                <GlassCard key={comm.id} onClick={() => handleOpenPrepare(comm)} className="cursor-pointer hover:bg-white/10 group opacity-80 hover:opacity-100 h-full flex flex-col">
                                    <div className="flex justify-between items-start pl-3 flex-1">
                                        <div className="flex-1 min-w-0">
                                            <h3 className={`text-lg font-bold ${comm.status === 'ReturnComplete' ? 'text-purple-300' : 'text-white line-through'}`}>{comm.name}</h3>
                                            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-white/10 text-white/50 border-white/10">
                                                {comm.order_number || '---'}
                                            </span>
                                            <div className="text-xs text-purple-300 mt-1">
                                                {comm.status === 'ReturnComplete' ? 'Rücksendung erledigt' : `Entnommen: ${comm.withdrawn_at ? new Date(comm.withdrawn_at).toLocaleDateString() : '-'}`}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {comm.status === 'Withdrawn' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setActiveCommission(comm); handleInitReturn(); }}
                                                    className="px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500 text-orange-200 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                                >
                                                    <Undo2 size={14} /> Retoure
                                                </button>
                                            )}
                                            <button onClick={(e) => requestDelete(comm.id, comm.name, 'trash', e)} className="p-2 text-white/30 hover:text-rose-400"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                </GlassCard>
                            ))}
                        </div>
                    )}

                    {/* TRASH TAB */}
                    {activeTab === 'trash' && (
                        <>
                            <div className="text-xs text-white/30 text-center mb-4">Elemente werden nach 7 Tagen automatisch endgültig gelöscht.</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
                                {commissions.map(comm => (
                                    <GlassCard key={comm.id} className="opacity-60 border-rose-500/20 h-full flex flex-col">
                                        <div className="flex justify-between items-center pl-3 h-full">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-lg font-bold text-white/70 truncate">{comm.name}</h3>
                                                <div className="text-xs text-rose-400">Gelöscht am: {comm.deleted_at ? new Date(comm.deleted_at).toLocaleDateString() : '-'}</div>
                                            </div>
                                            <div className="flex gap-2 pl-2">
                                                <button
                                                    onClick={(e) => restoreFromTrash(comm.id, comm.name, e)}
                                                    className="p-2 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 rounded-lg transition-colors"
                                                    title="Wiederherstellen"
                                                >
                                                    <RotateCcw size={16} />
                                                </button>
                                                <button onClick={(e) => requestDelete(comm.id, comm.name, 'permanent', e)} className="p-2 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 rounded-lg"><X size={16} /></button>
                                            </div>
                                        </div>
                                    </GlassCard>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* --- MODALS --- */}

            {/* GLOBAL SEARCH MODAL */}
            <GlassModal isOpen={showSearchModal} onClose={() => setShowSearchModal(false)} className="max-w-lg">
                <div className="p-4 border-b border-gray-200 dark:border-white/10 flex gap-3 items-center">
                    <Search className="text-gray-400 dark:text-white/50" size={20} />
                    <input
                        autoFocus
                        className="bg-transparent border-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 text-lg flex-1 focus:outline-none"
                        placeholder="Global suchen (Name, Nr, Notiz)..."
                        value={globalSearchTerm}
                        onChange={(e) => performGlobalSearch(e.target.value)}
                    />
                    <button onClick={() => setShowSearchModal(false)} className="text-gray-400 dark:text-white/50 hover:text-gray-900 dark:hover:text-white"><X size={24} /></button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-2 space-y-2">
                    {isSearching && <div className="text-center py-4"><Loader2 className="animate-spin text-emerald-400 mx-auto" /></div>}
                    {!isSearching && globalSearchTerm && searchResults.length === 0 && (
                        <div className="text-center py-8 text-gray-400 dark:text-white/30">Keine Ergebnisse gefunden.</div>
                    )}
                    {searchResults.map(comm => (
                        <div
                            key={comm.id}
                            onClick={() => handleSearchResultClick(comm)}
                            className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/5 cursor-pointer transition-all flex justify-between items-center group"
                        >
                            <div>
                                <div className="font-bold text-gray-900 dark:text-white">{comm.name}</div>
                                <div className="flex gap-2 text-xs text-gray-500 dark:text-white/50 mt-1">
                                    <span className="font-mono bg-gray-200 dark:bg-white/10 px-1.5 rounded">{comm.order_number || '-'}</span>
                                    <span>• {translateStatus(comm.status)}</span>
                                </div>
                            </div>
                            <ArrowRight size={18} className="text-gray-400 dark:text-white/20 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
                        </div>
                    ))}
                </div>
            </GlassModal>

            {/* HISTORY MODAL */}
            <GlassModal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} className="max-w-2xl h-[85vh]">
                <div className="p-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-black/20">
                    <div className="flex items-center gap-2">
                        <History size={20} className="text-blue-500 dark:text-blue-400" />
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Verlauf / Logbuch</h2>
                    </div>
                    <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-white/5 rounded-full text-gray-500 dark:text-white/60 hover:text-gray-900 dark:hover:text-white"><X size={20} /></button>
                </div>

                <div className="p-4 border-b border-gray-200 dark:border-white/5">
                    <GlassInput
                        icon={<Search size={16} />}
                        placeholder="Nach Name oder Aktion suchen..."
                        value={historySearch}
                        onChange={e => setHistorySearch(e.target.value)}
                        className="text-sm py-2"
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loadingHistory ? (
                        <div className="text-center py-10"><Loader2 className="animate-spin text-blue-400 mx-auto" /></div>
                    ) : (
                        (() => {
                            const filteredHistory = historyLogs.filter(log =>
                                (log.commission_name || '').toLowerCase().includes(historySearch.toLowerCase()) ||
                                (log.action || '').toLowerCase().includes(historySearch.toLowerCase()) ||
                                (log.details || '').toLowerCase().includes(historySearch.toLowerCase())
                            );

                            if (filteredHistory.length === 0) return <div className="text-center text-gray-400 dark:text-white/30 py-10">Keine Einträge gefunden.</div>;

                            return filteredHistory.map(log => (
                                <div key={log.id} className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 border border-gray-200 dark:border-white/5 flex gap-3 items-start">
                                    <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 
                                  ${log.action === 'labels_printed' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300' :
                                            log.action === 'created' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300' :
                                                log.action === 'deleted' ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300' :
                                                    'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50'}`}
                                    >
                                        {log.action === 'labels_printed' ? <Printer size={14} /> :
                                            log.action === 'created' ? <Plus size={14} /> :
                                                log.action === 'deleted' ? <Trash2 size={14} /> :
                                                    <Clock size={14} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between">
                                            <span className="font-bold text-gray-900 dark:text-white truncate">{log.commission_name || 'Unbekannt'}</span>
                                            <span className="text-xs text-gray-500 dark:text-white/30 whitespace-nowrap ml-2">{new Date(log.created_at).toLocaleString()}</span>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-white/70">{log.details}</p>
                                        <div className="text-xs text-gray-400 dark:text-white/30 mt-1 flex items-center gap-1">
                                            Von: {log.profiles?.full_name || 'System'}
                                        </div>
                                    </div>
                                </div>
                            ));
                        })()
                    )}
                </div>
            </GlassModal>

            {/* CREATE / EDIT MODAL */}
            <GlassModal isOpen={showCreateModal} onClose={handleCloseCreateModal} className="max-w-5xl h-[90vh]">
                <div className="flex flex-col sm:flex-row h-auto sm:h-full sm:overflow-hidden">
                    <div className="shrink-0 sm:flex-1 flex flex-col border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-white/10 min-w-0">
                        <div className="p-6 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{isEditMode ? 'Kommission bearbeiten' : 'Neue Kommission erstellen'}</h2>
                            <p className="text-sm text-gray-500 dark:text-white/50">Details und Material erfassen.</p>
                        </div>
                        <div className="h-auto sm:flex-1 sm:overflow-y-auto p-6 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-white/50 mb-1 block">Auftrags-Nr.</label>
                                    <GlassInput
                                        value={newComm.order_number}
                                        onChange={e => setNewComm({ ...newComm, order_number: e.target.value })}
                                        autoFocus={!isEditMode}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-white/50 mb-1 block">Name</label>
                                    <GlassInput
                                        value={newComm.name}
                                        onChange={e => setNewComm({ ...newComm, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-white/50 mb-1 block">Notizen</label>
                                    <textarea
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-transparent transition-all duration-300"
                                        rows={3}
                                        value={newComm.notes}
                                        onChange={e => setNewComm({ ...newComm, notes: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="h-px bg-gray-200 dark:bg-white/5 w-full" />

                            {/* MATERIAL SELECTION */}
                            <div className="bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden">
                                <div className="flex items-center justify-between p-2 gap-2">
                                    <button onClick={() => setExpandStockSearch(!expandStockSearch)} className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-white/80 py-2 px-1 flex-shrink-0">
                                        <Package size={16} /> Material aus Hauptlager
                                    </button>

                                    {/* Inline Search Box */}
                                    <div className="flex-1 flex items-center bg-gray-200 dark:bg-black/20 rounded-lg px-2 border border-transparent dark:border-white/5 focus-within:border-emerald-500/50 transition-colors">
                                        <Search size={14} className="text-gray-400 dark:text-white/40" />
                                        <input
                                            className="w-full bg-transparent border-none text-xs text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-white/30 focus:ring-0 px-2 py-2 focus:outline-none"
                                            placeholder="Suchen..."
                                            value={stockSearchTerm}
                                            onChange={(e) => {
                                                setStockSearchTerm(e.target.value);
                                                if (!expandStockSearch && e.target.value.length > 0) setExpandStockSearch(true);
                                            }}
                                            onClick={(e) => e.stopPropagation()} // Prevent accordion toggle
                                        />
                                    </div>

                                    <button onClick={() => setExpandStockSearch(!expandStockSearch)} className="p-2 text-gray-400 dark:text-white/50 hover:text-gray-900 dark:hover:text-white">
                                        <ChevronDown size={16} className={`transition-transform ${!expandStockSearch ? '-rotate-90' : ''}`} />
                                    </button>
                                </div>

                                {expandStockSearch && (
                                    <div className="space-y-3 p-3 pt-0 animate-in slide-in-from-top-2">

                                        {/* Category Chips */}
                                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-gray-200 dark:border-white/5 mb-2">
                                            {distinctCategories.map(cat => (
                                                <button
                                                    key={cat}
                                                    onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                                                    className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selectedCategory === cat ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white'}`}
                                                >
                                                    {cat}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Article List */}
                                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                                            {availableArticles
                                                .filter(a => {
                                                    const matchesCat = !selectedCategory || (a.category || 'Sonstiges') === selectedCategory;
                                                    const matchesSearch = !stockSearchTerm || a.name.toLowerCase().includes(stockSearchTerm.toLowerCase()) || a.sku.toLowerCase().includes(stockSearchTerm.toLowerCase());
                                                    return matchesCat && matchesSearch;
                                                })
                                                .map(art => (
                                                    <button key={art.id} onClick={() => addTempStockItem(art)} className="w-full text-left px-3 py-2 bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl border border-gray-200 dark:border-white/5 flex items-center gap-3 group transition-colors">
                                                        {/* Image Thumbnail */}
                                                        <div className="w-9 h-9 shrink-0 rounded-lg bg-gray-100 dark:bg-black/30 overflow-hidden border border-gray-200 dark:border-white/10">
                                                            <img
                                                                src={art.image || `https://picsum.photos/seed/${art.id}/200`}
                                                                alt={art.name}
                                                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                                loading="lazy"
                                                            />
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{art.name}</div>
                                                            <div className="text-[10px] text-gray-500 dark:text-white/40 flex items-center gap-2">
                                                                <span>{art.sku}</span>
                                                                {art.stock > 0 ? <span className="text-emerald-600 dark:text-emerald-400">Bestand: {art.stock}</span> : <span className="text-rose-500 dark:text-rose-400">Leer</span>}
                                                            </div>
                                                        </div>
                                                        <div className="w-6 h-6 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-400 dark:text-white/30 group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-500 transition-colors shrink-0">
                                                            <Plus size={14} />
                                                        </div>
                                                    </button>
                                                ))
                                            }
                                            {availableArticles.length === 0 && <div className="text-center text-xs text-gray-400 dark:text-white/30 py-4">Kein Material im Lager.</div>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* EXTERNAL / MANUAL SELECTION */}
                            <div className="bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden">
                                <div className="flex items-center justify-between p-2 gap-2">
                                    <button onClick={() => setExpandSupplierList(!expandSupplierList)} className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-white/80 py-2 px-1 flex-shrink-0">
                                        <ShoppingCart size={16} /> Lieferant wählen
                                    </button>

                                    {/* Inline Search Box */}
                                    <div className="flex-1 flex items-center bg-gray-200 dark:bg-black/20 rounded-lg px-2 border border-transparent dark:border-white/5 focus-within:border-purple-500/50 transition-colors">
                                        <Search size={14} className="text-gray-400 dark:text-white/40" />
                                        <input
                                            className="w-full bg-transparent border-none text-xs text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-white/30 focus:ring-0 px-2 py-2 focus:outline-none"
                                            placeholder="Suche..."
                                            value={supplierSearchTerm}
                                            onChange={(e) => {
                                                setSupplierSearchTerm(e.target.value);
                                                if (!expandSupplierList && e.target.value.length > 0) setExpandSupplierList(true);
                                            }}
                                            onClick={(e) => e.stopPropagation()} // Prevent accordion toggle
                                        />
                                    </div>

                                    <div className="flex gap-1">
                                        <button onClick={() => setExpandSupplierList(!expandSupplierList)} className="p-2 text-gray-400 dark:text-white/50 hover:text-gray-900 dark:hover:text-white">
                                            <ChevronDown size={16} className={`transition-transform ${!expandSupplierList ? '-rotate-90' : ''}`} />
                                        </button>
                                        <button onClick={addManualItem} className="p-2 bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 rounded-lg text-gray-700 dark:text-white/80 flex items-center justify-center ml-1" title="Freitext Position hinzufügen">
                                            <PenTool size={16} />
                                        </button>
                                    </div>
                                </div>

                                {expandSupplierList && (
                                    <div className="bg-gray-100 dark:bg-black/20 p-1 animate-in slide-in-from-top-2 border-t border-gray-200 dark:border-white/5 max-h-40 overflow-y-auto">
                                        {suppliers
                                            .filter(s => !supplierSearchTerm || s.name.toLowerCase().includes(supplierSearchTerm.toLowerCase()))
                                            .map(s => (
                                                <button key={s.id} onClick={() => addTempExternalItem(s)} className="w-full flex items-center gap-3 p-3 hover:bg-white dark:hover:bg-white/5 transition-colors text-left border-b last:border-b-0 border-gray-200 dark:border-white/5">
                                                    <Plus size={16} className="text-gray-400 dark:text-white/50" /> <span className="font-medium text-gray-700 dark:text-white/80">{s.name}</span>
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: SELECTED ITEMS */}
                    <div className="shrink-0 sm:flex-[0.8] bg-gray-100 dark:bg-black/20 border-l border-gray-200 dark:border-white/10 flex flex-col min-w-0">
                        <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 dark:text-white">Material ({tempItems.length})</h3>
                            <button onClick={handleCloseCreateModal} className="text-gray-400 dark:text-white/50 hover:text-gray-900 dark:hover:text-white p-2 bg-white dark:bg-white/5 rounded-full"><X size={18} /></button>
                        </div>
                        <div className="h-auto sm:flex-1 sm:overflow-y-auto p-6 space-y-3">
                            {tempItems.length === 0 && <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-white/30"><Box size={40} className="mb-3 opacity-50" /><p>Leer.</p></div>}
                            {tempItems.map((item) => (
                                <div key={item.uniqueId} className="bg-white dark:bg-white/5 rounded-xl p-4 shadow-sm dark:shadow-lg border border-gray-200 dark:border-white/10">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1 min-w-0 pr-3">
                                            {item.type === 'Stock' ? (
                                                <>
                                                    <div className="font-bold text-gray-900 dark:text-white truncate">{item.article?.name}</div>
                                                    <div className="text-xs text-gray-500 dark:text-white/50 flex items-center gap-1 mt-1">
                                                        <MapPin size={10} /> {item.article?.category || 'Regal?'} / {item.article?.location || 'Fach?'}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="text-[10px] text-purple-500 dark:text-purple-300 uppercase font-bold mb-1">Manuell / Extern</div>
                                                    <input
                                                        className="w-full bg-transparent border-b border-gray-300 dark:border-white/20 text-gray-900 dark:text-white font-bold focus:outline-none focus:border-purple-500 pb-1"
                                                        value={item.customName}
                                                        onChange={(e) => updateTempItem(item.uniqueId, 'customName', e.target.value)}
                                                        placeholder="Bezeichnung..."
                                                    />
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button onClick={() => updateTempItem(item.uniqueId, 'amount', Math.max(1, item.amount - 1))} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 flex items-center justify-center text-gray-700 dark:text-white"><Minus size={14} /></button>
                                            <span className="w-8 text-center font-bold text-gray-900 dark:text-white">{item.amount}</span>
                                            <button onClick={() => updateTempItem(item.uniqueId, 'amount', item.amount + 1)} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 flex items-center justify-center text-gray-700 dark:text-white"><Plus size={14} /></button>
                                            <button onClick={() => removeTempItem(item.uniqueId)} className="ml-2 text-gray-400 dark:text-white/30 hover:text-rose-500 dark:hover:text-rose-400"><X size={18} /></button>
                                        </div>
                                    </div>

                                    {/* NOTES for temp item */}
                                    {item.type === 'External' && (
                                        <div className="mb-2">
                                            <label className="text-[10px] text-gray-400 dark:text-white/40 uppercase font-bold whitespace-nowrap block mb-1">Notiz an Lieferant / Lager:</label>
                                            <input
                                                className="w-full bg-gray-50 dark:bg-black/30 text-gray-900 dark:text-white text-xs p-2 rounded-lg border border-gray-200 dark:border-white/10 focus:outline-none focus:border-gray-300 dark:focus:border-white/30"
                                                placeholder="z.B. Nur Originalteile..."
                                                value={item.notes || ''}
                                                onChange={(e) => updateTempItem(item.uniqueId, 'notes', e.target.value)}
                                            />
                                        </div>
                                    )}

                                    {item.type === 'External' && (
                                        <div
                                            className={`flex gap-2 items-center mt-2 p-1 rounded-lg border border-transparent transition-all ${item.isDragging ? 'bg-emerald-500/10 border-emerald-500 border-dashed' : ''}`}
                                            onDragEnter={(e) => handleDragEnter(e, item.uniqueId)}
                                            onDragOver={(e) => handleDragOver(e, item.uniqueId)}
                                            onDragLeave={(e) => handleDragLeave(e, item.uniqueId)}
                                            onDrop={(e) => handleDrop(e, item.uniqueId)}
                                        >
                                            <div className="bg-gray-50 dark:bg-black/30 rounded-lg p-2 border border-gray-200 dark:border-white/10 flex-1 flex items-center gap-2">
                                                <label className="text-[10px] text-gray-400 dark:text-white/40 uppercase font-bold whitespace-nowrap">Vorgang:</label>
                                                <input className="w-full bg-transparent text-gray-900 dark:text-white text-sm focus:outline-none font-mono" placeholder="Optional..." value={item.externalReference || ''} onChange={(e) => updateTempItem(item.uniqueId, 'externalReference', e.target.value)} />
                                            </div>

                                            {/* PASTE BUTTON */}
                                            <button
                                                onClick={() => handlePasteAttachment(item.uniqueId)}
                                                className="h-10 w-10 rounded-lg flex items-center justify-center border bg-white dark:bg-white/10 text-gray-400 dark:text-white/40 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/20 hover:text-gray-900 dark:hover:text-white transition-all shrink-0"
                                                title="Bild aus Zwischenablage einfügen"
                                                type="button"
                                            >
                                                <Clipboard size={18} />
                                            </button>

                                            {/* ATTACHMENT BUTTON */}
                                            <div>
                                                <input
                                                    id={'file-upload-' + item.uniqueId}
                                                    type="file"
                                                    accept="image/*,application/pdf"
                                                    className="hidden"
                                                    onChange={(e) => handleFileUpload(item.uniqueId, e.target.files)}
                                                />
                                                <button
                                                    onClick={() => document.getElementById('file-upload-' + item.uniqueId)?.click()}
                                                    className={`h-10 w-10 rounded-lg flex items-center justify-center border transition-all shrink-0 ${item.attachmentData ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/50' : 'bg-white dark:bg-white/10 text-gray-400 dark:text-white/40 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/20 hover:text-gray-900 dark:hover:text-white'}`}
                                                    title={item.attachmentData ? "Datei angehängt (Klicken zum Ändern)" : "Lieferschein anhängen (Drag & Drop)"}
                                                >
                                                    <Paperclip size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="p-6 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 flex justify-end gap-3">
                            <Button variant="secondary" onClick={handleCloseCreateModal}>Abbrechen</Button>
                            <Button onClick={handleFinalizeCreate} disabled={isSubmitting || !newComm.name} className="bg-emerald-600 hover:bg-emerald-500" icon={isSubmitting ? <Loader2 className="animate-spin" /> : isEditMode ? <Save size={18} /> : <Plus size={18} />}>{isEditMode ? 'Speichern' : 'Anlegen'}</Button>
                        </div>
                    </div>
                </div>
            </GlassModal>

            {/* POST CREATE LABEL OPTION MODAL */}
            <GlassModal isOpen={!!showLabelOptionsModal} onClose={() => { setShowLabelOptionsModal(null); handleCloseCreateModal(); }} className="max-w-md text-center">
                <div className="p-6">
                    <Tag size={48} className="mx-auto text-blue-500 dark:text-blue-400 mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Kommission erstellt!</h2>
                    <p className="text-gray-600 dark:text-white/60 mb-6">Möchtest du direkt ein Etikett für das Regal/die Box drucken?</p>

                    <div className="space-y-3">
                        <Button onClick={() => handleSinglePrint(showLabelOptionsModal!)} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500" icon={<Printer size={18} />}>Sofort drucken</Button>
                        <Button onClick={() => handleAddToQueue(showLabelOptionsModal!, newComm.name)} className="w-full py-3 bg-blue-600 hover:bg-blue-500" icon={<Layers size={18} />}>Später drucken (Warteschlange)</Button>
                        <Button onClick={() => { setShowLabelOptionsModal(null); handleCloseCreateModal(); }} variant="secondary" className="w-full">Schließen</Button>
                    </div>
                </div>
            </GlassModal>

            {/* UPDATE LABEL CONFIRM MODAL */}
            <GlassModal isOpen={showLabelUpdateModal && !!activeCommission} onClose={() => setShowLabelUpdateModal(false)} className="max-w-md text-center">
                <div className="p-6">
                    <AlertTriangle size={48} className="mx-auto text-amber-500 dark:text-amber-400 mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Etikett aktualisieren?</h2>
                    <p className="text-gray-600 dark:text-white/60 mb-6">
                        Du hast Änderungen an Rückständen oder Notizen vorgenommen. Das Etikett ist nicht mehr aktuell.
                    </p>

                    <div className="space-y-3">
                        <Button onClick={() => activeCommission && handleSinglePrint(activeCommission.id)} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500" icon={<Printer size={18} />}>Neues Etikett drucken</Button>
                        <Button onClick={() => activeCommission && handleAddToQueue(activeCommission.id, activeCommission.name)} className="w-full py-3 bg-blue-600 hover:bg-blue-500" icon={<Layers size={18} />}>Zur Druckwarteschlange</Button>
                        <Button onClick={() => setShowLabelUpdateModal(false)} variant="secondary" className="w-full">Nein, danke</Button>
                    </div>
                </div>
            </GlassModal>

            {/* ITEM NOTE EDIT MODAL */}
            <GlassModal isOpen={!!editingItemNote} onClose={() => setEditingItemNote(null)} className="max-w-sm">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-900 dark:text-white">Notiz zur Position</h3>
                        <button onClick={() => setEditingItemNote(null)} className="text-gray-400 dark:text-white/50 hover:text-gray-900 dark:hover:text-white"><X size={20} /></button>
                    </div>
                    <textarea
                        className="w-full h-32 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="Notiz eingeben..."
                        defaultValue={editingItemNote?.note}
                        autoFocus
                        id="item-note-input"
                    />
                    <div className="flex justify-end gap-3 mt-4">
                        <Button variant="secondary" onClick={() => setEditingItemNote(null)}>Abbrechen</Button>
                        <Button onClick={() => {
                            const val = (document.getElementById('item-note-input') as HTMLTextAreaElement).value;
                            if (editingItemNote) saveItemNote(editingItemNote.itemId, val);
                        }}>Speichern</Button>
                    </div>
                </div>
            </GlassModal>



            {/* DETAIL MODAL */}
            <GlassModal isOpen={showPrepareModal && !!activeCommission} onClose={handleClosePrepare} className="max-w-3xl h-[90vh]">
                {activeCommission && (
                    <div className="flex flex-col h-full overflow-hidden">
                        <div className="p-4 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{activeCommission.name}</h2>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-500/30">
                                            {activeCommission.order_number}
                                        </span>
                                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-white/30" />
                                        <StatusBadge status={translateStatus(activeCommission.status)} type="neutral" />
                                    </div>
                                    {/* FULL NOTES DISPLAY */}
                                    {activeCommission.notes && (
                                        <div className="text-sm text-gray-600 dark:text-white/70 mt-3 bg-white dark:bg-white/5 p-3 rounded-lg whitespace-pre-wrap border border-gray-200 dark:border-white/5">
                                            {activeCommission.notes}
                                        </div>
                                    )}
                                </div>
                                <button onClick={handleClosePrepare} className="p-2 bg-gray-100 dark:bg-white/5 rounded-full text-gray-500 dark:text-white/60 hover:text-gray-900 dark:hover:text-white ml-3"><X size={20} /></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {/* ACTIVE WORKFLOW ACTIONS */}
                            {!activeCommission.status.startsWith('Return') && activeCommission.status !== 'Withdrawn' && activeCommission.deleted_at === null && (
                                <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-200 dark:border-white/5 mb-4">
                                    {activeCommission.status !== 'Ready' && (
                                        <div className="relative group">
                                            <Button
                                                onClick={handleSetReadyTrigger}
                                                className={`whitespace-nowrap ${(!allItemsPicked || hasBackorders) ? 'bg-gray-400 dark:bg-gray-600 opacity-50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                                                icon={<CheckCircle2 size={18} />}
                                                disabled={isSubmitting || !allItemsPicked || hasBackorders}
                                            >
                                                Jetzt bereitstellen
                                            </Button>
                                            {hasBackorders && (
                                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-red-900 text-red-100 text-xs rounded shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 text-center border border-red-500/50">
                                                    Rückstände vorhanden! <br />Nicht bereitstellbar.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {activeCommission.status === 'Ready' && (
                                        <>
                                            <Button onClick={handleWithdrawTrigger} className="bg-purple-600 hover:bg-purple-500 whitespace-nowrap" icon={<Truck size={18} />} disabled={isSubmitting}>Entnehmen (Abschluss)</Button>
                                            <Button onClick={executeResetStatus} className="bg-amber-600 hover:bg-amber-500 whitespace-nowrap" icon={<RotateCcw size={18} />} disabled={isSubmitting}>Zurückstellen</Button>
                                        </>
                                    )}
                                    <Button variant="secondary" onClick={(e) => handleEditCommission(activeCommission!, e)} icon={<Edit2 size={18} />}></Button>
                                    <Button variant="secondary" onClick={() => handleSinglePrint()} icon={<Printer size={18} />}></Button>
                                </div>
                            )}

                            {/* RETURN WORKFLOW ACTIONS */}
                            {activeCommission.status.startsWith('Return') && activeCommission.status !== 'ReturnComplete' && activeCommission.deleted_at === null && (
                                <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-200 dark:border-white/5 mb-4">
                                    {activeCommission.status === 'ReturnPending' && (
                                        <Button onClick={handleReturnToReady} className="bg-purple-600 hover:bg-purple-500 whitespace-nowrap" icon={<Printer size={18} />} disabled={isSubmitting}>
                                            Ins Abholregal (Label)
                                        </Button>
                                    )}
                                    {activeCommission.status === 'ReturnReady' && (
                                        <Button onClick={handleCompleteReturn} className="bg-emerald-600 hover:bg-emerald-500 whitespace-nowrap" icon={<Check size={18} />} disabled={isSubmitting}>
                                            Wurde abgeholt
                                        </Button>
                                    )}
                                </div>
                            )}

                            {/* WITHDRAWN ACTIONS */}
                            {activeCommission.status === 'Withdrawn' && activeCommission.deleted_at === null && (
                                <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-200 dark:border-white/5 mb-4">
                                    <Button
                                        onClick={executeRevertWithdrawal}
                                        className="bg-amber-600 hover:bg-amber-500 whitespace-nowrap"
                                        icon={<RotateCcw size={18} />}
                                        disabled={isSubmitting}
                                    >
                                        Wiederherstellen (Bereit)
                                    </Button>
                                    <Button
                                        onClick={handleInitReturn}
                                        className="bg-orange-600 hover:bg-orange-500 whitespace-nowrap"
                                        icon={<Undo2 size={18} />}
                                        disabled={isSubmitting}
                                    >
                                        Retoure / Zurückschreiben
                                    </Button>
                                </div>
                            )}

                            {/* ITEMS LIST */}
                            <div className="space-y-2">
                                {commItems.length === 0 && <div className="text-center text-gray-400 dark:text-white/30 py-4">Keine Positionen.</div>}
                                {commItems.map(item => (
                                    <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${item.is_backorder ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/50' : item.is_picked ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 opacity-70' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/5'}`}>
                                        {/* Disabled button if backorder */}
                                        <button
                                            onClick={() => toggleActiveItemPicked(item.id, item.is_picked)}
                                            disabled={item.is_backorder || false}
                                            className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${item.is_backorder ? 'bg-white/50 dark:bg-white/5 border-gray-200 dark:border-white/10 cursor-not-allowed opacity-50' : item.is_picked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 dark:border-white/30 hover:border-emerald-400'}`}
                                        >
                                            {item.is_picked && <Check size={14} />}
                                        </button>

                                        <div className={`flex-1 ${item.is_backorder ? 'cursor-default' : 'cursor-pointer'}`} onClick={() => !item.is_backorder && toggleActiveItemPicked(item.id, item.is_picked)}>
                                            <div className="font-medium text-gray-900 dark:text-white">{item.type === 'Stock' ? item.article?.name : item.custom_name}</div>
                                            <div className="text-xs text-gray-500 dark:text-white/50 flex flex-wrap items-center gap-2">
                                                {item.type === 'Stock' ? <><Package size={12} /> Lager: {item.article?.location}</> : <><ExternalLink size={12} /> Extern • Ref: {item.external_reference || '-'}</>}
                                                {item.notes && <span className="flex items-center gap-1 text-amber-500 dark:text-amber-300"><MessageSquare size={10} /> {item.notes}</span>}
                                            </div>
                                        </div>

                                        {/* Right Actions */}
                                        <div className="flex items-center gap-2">
                                            {/* Note Button */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingItemNote({ itemId: item.id, note: item.notes || '' }); }}
                                                className={`p-1.5 rounded transition-colors ${item.notes ? 'text-amber-500 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20' : 'text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white'}`}
                                                title="Notiz hinzufügen"
                                            >
                                                <MessageSquare size={16} />
                                            </button>

                                            {/* Backorder Toggle */}
                                            {item.type === 'External' && (
                                                <div className="flex items-center gap-2 bg-gray-100 dark:bg-black/20 p-1 rounded-lg border border-gray-200 dark:border-white/5" title="Rückstand umschalten">
                                                    <span className={`text-[9px] uppercase font-bold px-1 ${item.is_backorder ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-white/30'}`}>Rückstd.</span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleBackorder(item.id, item.is_backorder || false); }}
                                                        className={`w-8 h-4 rounded-full relative transition-colors ${item.is_backorder ? 'bg-red-500' : 'bg-gray-300 dark:bg-white/20'}`}
                                                    >
                                                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${item.is_backorder ? 'translate-x-4' : ''}`} />
                                                    </button>
                                                </div>
                                            )}

                                            {/* Attachment View Button */}
                                            {item.attachment_data && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setViewingAttachment(item.attachment_data!); }}
                                                    className="p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 hover:bg-blue-500 hover:text-white rounded-lg transition-colors"
                                                    title="Anhang ansehen"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            )}

                                            <div className="font-bold text-gray-900 dark:text-white text-lg px-2">{item.amount}x</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* --- HISTORY SECTION --- */}
                            <div className="mt-8 border-t border-gray-200 dark:border-white/10 pt-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <History size={18} className="text-gray-400 dark:text-white/50" />
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Verlauf</h3>
                                </div>

                                <div className="bg-gray-50 dark:bg-black/20 rounded-xl p-4 max-h-60 overflow-y-auto space-y-3">
                                    {localHistoryLogs.length === 0 ? (
                                        <div className="text-center text-sm text-gray-400 dark:text-white/30 italic py-2">Noch keine Einträge vorhanden.</div>
                                    ) : (
                                        localHistoryLogs.map((log) => (
                                            <div key={log.id} className="flex gap-3 text-sm">
                                                <div className="min-w-[120px] text-gray-500 dark:text-white/40 text-xs mt-0.5">
                                                    {new Date(log.created_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-gray-700 dark:text-white/90">
                                                            {log.profiles?.full_name?.split(' ')[0] || 'Unbekannt'}
                                                        </span>
                                                        <span className="text-gray-400 dark:text-white/30 text-xs">•</span>
                                                        <span className="text-gray-600 dark:text-white/70">{log.details}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </GlassModal>

            {/* CONFIRM READY MODAL */}
            <GlassModal isOpen={showConfirmReadyModal} onClose={() => setShowConfirmReadyModal(false)} className="max-w-sm">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-3 text-emerald-500 dark:text-emerald-400"><AlertTriangle size={24} /><h3 className="text-lg font-bold text-gray-900 dark:text-white">Bereitstellen bestätigen?</h3></div>
                    <p className="text-sm text-gray-600 dark:text-white/70 mb-6">Bestand für {commItems.filter(i => i.type === 'Stock').length} Artikel wird abgebucht.</p>
                    <div className="flex gap-3 justify-end">
                        <Button variant="secondary" onClick={() => setShowConfirmReadyModal(false)}>Abbrechen</Button>
                        <Button onClick={executeSetReady} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-500">{isSubmitting ? <Loader2 className="animate-spin" /> : 'Ja, Buchen'}</Button>
                    </div>
                </div>
            </GlassModal>

            {/* CONFIRM WITHDRAW MODAL */}
            <GlassModal isOpen={showConfirmWithdrawModal} onClose={() => setShowConfirmWithdrawModal(false)} className="max-w-sm">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-3 text-purple-500 dark:text-purple-400"><Truck size={24} /><h3 className="text-lg font-bold text-gray-900 dark:text-white">Entnahme bestätigen?</h3></div>
                    <p className="text-sm text-gray-600 dark:text-white/70 mb-6">Kommission wird als "Entnommen" markiert und archiviert.</p>
                    <div className="flex gap-3 justify-end">
                        <Button variant="secondary" onClick={() => setShowConfirmWithdrawModal(false)}>Abbrechen</Button>
                        <Button onClick={executeWithdraw} disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-500">{isSubmitting ? <Loader2 className="animate-spin" /> : 'Ja, Entnehmen'}</Button>
                    </div>
                </div>
            </GlassModal>

            {/* DELETE CONFIRMATION MODAL */}
            <GlassModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} className="max-w-sm text-center">
                {deleteTarget && (
                    <div className="p-6">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${deleteTarget.mode === 'trash' ? 'bg-rose-100 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400' : 'bg-red-100 dark:bg-red-600/20 text-red-500'}`}>
                            <Trash2 size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            {deleteTarget.mode === 'trash' ? 'In Papierkorb verschieben?' : 'Endgültig löschen?'}
                        </h3>
                        <p className="text-gray-600 dark:text-white/60 mb-6">
                            {deleteTarget.mode === 'trash'
                                ? `Die Kommission "${deleteTarget.name}" wird in den Papierkorb verschoben.`
                                : `WARNUNG: "${deleteTarget.name}" wird unwiderruflich gelöscht. Dies kann nicht rückgängig gemacht werden.`}
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Abbrechen</Button>
                            <Button
                                onClick={executeDelete}
                                disabled={isSubmitting}
                                className={deleteTarget.mode === 'trash' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-red-600 hover:bg-red-500'}
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" /> : (deleteTarget.mode === 'trash' ? 'Verschieben' : 'Löschen')}
                            </Button>
                        </div>
                    </div>
                )}
            </GlassModal>

            {/* ATTACHMENT VIEWER MODAL (Moved to end for Z-Index) */}
            <GlassModal isOpen={!!viewingAttachment} onClose={() => setViewingAttachment(null)} className="max-w-[95vw] h-[95vh] max-h-[95vh]">
                <div className="flex flex-col h-full bg-gray-900 rounded-2xl overflow-hidden">
                    <div className="p-3 border-b border-white/10 flex justify-between items-center bg-white/5">
                        <h3 className="text-white font-bold flex items-center gap-2"><FileText size={18} /> Anhang Vorschau</h3>
                        <button onClick={() => setViewingAttachment(null)} className="p-2 hover:bg-white/10 rounded-full text-white"><X size={20} /></button>
                    </div>
                    <div className="flex-1 overflow-auto bg-black p-4 flex items-center justify-center">
                        {viewingAttachment?.startsWith('data:application/pdf') ? (
                            <iframe src={viewingAttachment} className="w-full h-full border-none rounded-lg" title="PDF Vorschau" />
                        ) : (
                            <img src={viewingAttachment || ''} className="max-w-full max-h-full object-contain rounded-lg" alt="Anhang" />
                        )}
                    </div>
                </div>
            </GlassModal>

        </div>
    );
};

export default Commissions;
