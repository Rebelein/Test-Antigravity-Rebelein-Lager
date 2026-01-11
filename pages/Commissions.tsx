import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, Button, GlassInput, GlassModal, StatusBadge } from '../components/UIComponents';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Commission, CommissionItem, Article, Supplier } from '../types';
import { Plus, Search, CheckCircle2, Printer, X, Loader2, History, Trash2, BoxSelect, ArrowRight, Clock, LogOut, Undo2, RotateCcw, AlertTriangle, Layers, Tag } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CommissionCleanupModal } from '../components/CommissionCleanupModal';
import { CommissionCard } from '../components/CommissionCard';
import { PrintingSection } from '../components/PrintingSection';
import { useCommissionData } from '../hooks/useCommissionData';
import { MasterDetailLayout } from '../components/MasterDetailLayout';
import { CommissionDetailContent } from '../components/commissions/CommissionDetailContent';
import { CommissionEditContent, ExtendedCommission } from '../components/commissions/CommissionEditContent';
import { useIsMobile } from '../hooks/useIsMobile';

// --- TYPES ---
type CommissionTab = 'active' | 'returns' | 'withdrawn' | 'trash' | 'missing';
type PrintTab = 'queue' | 'history';
type SidePanelMode = 'none' | 'detail' | 'create' | 'edit' | 'search' | 'history';

const Commissions: React.FC = () => {
    const { user, profile } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<CommissionTab>('active');

    // --- CUSTOM HOOK ---
    const {
        commissions,
        setCommissions,
        suppliers,
        availableArticles,
        loading,
        historyLogs,
        loadingHistory,
        fetchHistory,
        localHistoryLogs,
        fetchCommissionSpecificHistory,
        recentPrintLogs,
        loadingPrintHistory,
        fetchPrintHistory,
        fetchCommissionItems,
        logCommissionEvent,
        refreshCommissions,
        tabCounts
    } = useCommissionData(activeTab);

    // --- MASTER-DETAIL STATE ---
    const [sidePanelMode, setSidePanelMode] = useState<SidePanelMode>('none');
    const [activeCommission, setActiveCommission] = useState<ExtendedCommission | null>(null);
    const [commItems, setCommItems] = useState<CommissionItem[]>([]);

    // --- EDIT / CREATE STATE ---
    const [editingCommissionId, setEditingCommissionId] = useState<string | null>(null);
    const [editingInitialCommission, setEditingInitialCommission] = useState<ExtendedCommission | null>(null);
    const [editingInitialItems, setEditingInitialItems] = useState<any[]>([]);

    // --- SEARCH STATE ---
    const [globalSearchTerm, setGlobalSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<ExtendedCommission[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // --- OTHER MODALS ---
    const [showConfirmReadyModal, setShowConfirmReadyModal] = useState(false);
    const [showConfirmWithdrawModal, setShowConfirmWithdrawModal] = useState(false);
    const [showLabelOptionsModal, setShowLabelOptionsModal] = useState<string | null>(null);
    const [showLabelUpdateModal, setShowLabelUpdateModal] = useState(false);
    const [showCleanupModal, setShowCleanupModal] = useState(false);

    // Printing
    const [showPrintArea, setShowPrintArea] = useState(false);
    const [printTab, setPrintTab] = useState<PrintTab>('queue');
    const [selectedPrintIds, setSelectedPrintIds] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [labelDataChanged, setLabelDataChanged] = useState(false);

    // Collapsed Categories
    const [collapsedCategories, setCollapsedCategories] = useState<{ [key: string]: boolean }>({
        ready: false, preparing: false, draft: false, returnReady: false, returnPending: false
    });

    // Navigation
    const [returnPath, setReturnPath] = useState<string | null>(null);

    // Derived Queue Items
    const queueItems = useMemo(() => {
        return commissions.filter(c => c.needs_label && !c.deleted_at && c.status !== 'Withdrawn');
    }, [commissions]);

    // Auto-Open Queue
    useEffect(() => {
        if (queueItems.length > 0) setShowPrintArea(true);
        else setShowPrintArea(false);
    }, [queueItems.length]);

    // Handle deep links / navigation state
    useEffect(() => {
        const state = location.state as { editCommissionId?: string; openCreateModal?: boolean; returnTo?: string; openCommissionId?: string } | null;

        if (state) {
            if (state.editCommissionId) {
                window.history.replaceState({}, document.title);
                const loadAndEdit = async () => {
                    let comm = commissions.find(c => c.id === state.editCommissionId) as ExtendedCommission;
                    if (!comm) {
                        const { data } = await supabase.from('commissions').select('*, suppliers(name)').eq('id', state.editCommissionId).single();
                        if (data) comm = data as ExtendedCommission;
                    }
                    if (comm) handleEditCommission(comm);
                };
                loadAndEdit();
            } else if (state.openCreateModal) {
                if (state.returnTo) setReturnPath(state.returnTo);
                window.history.replaceState({}, document.title);
                handleOpenCreate();
            } else if (state.openCommissionId) {
                const loadScannerTarget = async (id: string) => {
                    let comm = commissions.find(c => c.id === id) as ExtendedCommission;
                    if (!comm) {
                        const { data } = await supabase.from('commissions').select('*, suppliers(name)').eq('id', id).single();
                        if (data) comm = data as ExtendedCommission;
                    }
                    if (comm) {
                        handleOpenDetail(comm);
                        window.history.replaceState({}, document.title);
                    }
                };
                loadScannerTarget(state.openCommissionId);
            }
        }
    }, [location, commissions]);

    // Realtime Subscriptions for Active Commission Details
    useEffect(() => {
        if (!activeCommission || sidePanelMode !== 'detail') return;

        const channel = supabase.channel('commissions-detail-ui')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'commissions', filter: `id=eq.${activeCommission.id}` },
                (payload) => {
                    const newComm = payload.new as ExtendedCommission;
                    if (newComm) setActiveCommission(newComm);
                }
            )
            .on('postgres_changes', { event: '*', schema: 'public', table: 'commission_items', filter: `commission_id=eq.${activeCommission.id}` },
                () => {
                    fetchCommissionItems(activeCommission.id).then(items => setCommItems(items || []));
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [activeCommission?.id, sidePanelMode]);


    // --- HANDLERS ---

    const handleOpenDetail = async (comm: ExtendedCommission) => {
        setActiveCommission(comm);
        setSidePanelMode('detail');
        setLabelDataChanged(false);
        const items = await fetchCommissionItems(comm.id);
        setCommItems(items || []);
        fetchCommissionSpecificHistory(comm.id);
    };

    const handleCloseSidePanel = () => {
        if (sidePanelMode === 'detail' && labelDataChanged && activeCommission) {
            setShowLabelUpdateModal(true);
        }
        setSidePanelMode('none');
        // Check if we need to clear activeCommission immediately? 
        // Better to keep it until mode changes back or something else is selected, 
        // but 'none' implies closed. UseState updates are batched.
        if (sidePanelMode !== 'detail') setActiveCommission(null); // Clear only if not detail
        else setActiveCommission(null);
    };

    const handleOpenCreate = () => {
        setEditingCommissionId(null);
        setEditingInitialCommission(null);
        setEditingInitialItems([]);
        setSidePanelMode('create');
    };

    const handleEditCommission = async (comm: ExtendedCommission, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setEditingCommissionId(comm.id);
        setEditingInitialCommission(comm);
        const items = await fetchCommissionItems(comm.id);
        setEditingInitialItems(items || []);
        setSidePanelMode('edit');
    };

    const handleSaveCommission = (id?: string, isNew?: boolean) => {
        refreshCommissions();
        if (sidePanelMode === 'edit' && editingCommissionId) {
            // If we were editing, restore detail view for that commission
            if (activeCommission && activeCommission.id === editingCommissionId) {
                handleOpenDetail(activeCommission);
            } else {
                setSidePanelMode('none');
            }
        } else {
            // Created new
            setSidePanelMode('none');
            if (isNew && id) {
                // Short timeout to ensure modal transition feels smooth
                setTimeout(() => setShowLabelOptionsModal(id), 300);
            }
        }
    };

    // Search Logic
    const performGlobalSearch = async (term: string) => {
        setGlobalSearchTerm(term);
        if (term.trim().length < 2) { setSearchResults([]); return; }
        setIsSearching(true);
        try {
            const { data, error } = await supabase.from('commissions')
                .select('*, suppliers(name), commission_items(*, article:articles(name))')
                .or(`name.ilike.%${term}%,order_number.ilike.%${term}%,notes.ilike.%${term}%`)
                .order('created_at', { ascending: false }).limit(20);
            if (error) throw error;
            setSearchResults((data as ExtendedCommission[]) || []);
        } catch (err) { console.error(err); } finally { setIsSearching(false); }
    };

    // --- SIDE PANEL CONTENT MAP ---
    const getSidePanelTitle = () => {
        switch (sidePanelMode) {
            case 'create': return 'Neue Kommission';
            case 'edit': return 'Kommission bearbeiten';
            case 'search': return 'Suche';
            case 'history': return 'Verlauf';
            case 'detail': return activeCommission?.name || 'Details';
            default: return 'Details';
        }
    };

    const renderSidePanelContent = () => {
        switch (sidePanelMode) {
            case 'create':
            case 'edit':
                return (
                    <CommissionEditContent
                        isEditMode={sidePanelMode === 'edit'}
                        initialCommission={editingInitialCommission}
                        initialItems={editingInitialItems}
                        primaryWarehouseId={profile?.primary_warehouse_id || null}
                        availableArticles={availableArticles}
                        suppliers={suppliers}
                        onSave={handleSaveCommission}
                        onClose={handleCloseSidePanel}
                    />
                );
            case 'search':
                return (
                    <div className="flex flex-col h-full bg-[#1a1d24]">
                        <div className="p-4 border-b border-white/10 flex gap-2 shrink-0 bg-white/5">
                            <Search className="text-white/50" />
                            <input autoFocus className="bg-transparent border-none text-white flex-1 focus:outline-none" placeholder="Suchen..." value={globalSearchTerm} onChange={e => performGlobalSearch(e.target.value)} />
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                            {isSearching && <div className="p-4 text-center text-white/50"><Loader2 className="animate-spin inline mr-2" />Suchen...</div>}
                            {!isSearching && searchResults.length === 0 && globalSearchTerm.length >= 2 && <div className="p-4 text-center text-white/50">Keine Ergebnisse</div>}
                            {searchResults.map(c => (
                                <div key={c.id} onClick={() => handleOpenDetail(c)} className="p-3 hover:bg-white/10 rounded cursor-pointer border-b border-white/5 last:border-0">
                                    <div className="font-bold text-white">{c.name}</div>
                                    <div className="text-xs text-white/50">{c.order_number} • {c.status}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'history':
                return (
                    <div className="flex flex-col h-full bg-[#1a1d24]">
                        <div className="p-4 overflow-y-auto h-full space-y-2 custom-scrollbar">
                            {loadingHistory && <div className="text-center p-4"><Loader2 className="animate-spin text-emerald-400 mx-auto" /></div>}
                            {!loadingHistory && historyLogs.map(log => (
                                <div key={log.id} className="bg-white/5 p-2 rounded text-sm border border-white/5">
                                    <div className="font-bold text-white">{log.commission_name}</div>
                                    <div className="text-white/70">{log.details}</div>
                                    <div className="text-xs text-white/30">{new Date(log.created_at).toLocaleString()}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'detail':
                return activeCommission ? (
                    <CommissionDetailContent
                        commission={activeCommission}
                        items={commItems}
                        localHistoryLogs={localHistoryLogs}
                        allItemsPicked={activeCommission ? (commItems.length === 0 || commItems.every(i => i.is_picked)) : true}
                        hasBackorders={commItems.some(i => i.is_backorder)}
                        isSubmitting={isSubmitting}
                        onSetReady={handleSetReadyTrigger}
                        onWithdraw={handleWithdrawTrigger}
                        onResetStatus={executeResetStatus}
                        onRevertWithdraw={executeRevertWithdrawal}
                        onInitReturn={handleInitReturn}
                        onReturnToReady={handleReturnToReady}
                        onCompleteReturn={handleCompleteReturn}
                        onEdit={(e) => handleEditCommission(activeCommission, e)}
                        onPrint={() => handleSinglePrint()}
                        onTogglePicked={toggleActiveItemPicked}
                        onToggleBackorder={toggleBackorder}
                        onSaveNote={saveItemNote}
                    />
                ) : null;
            default:
                return null;
        }
    };


    // Printing Logic (Preserved)
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
        if (printTab === 'history') fetchPrintHistory();
        if (returnPath) { navigate(returnPath); setReturnPath(null); }
    };

    const markLabelsAsPrinted = async () => {
        if (selectedPrintIds.size === 0) return;
        const ids = Array.from(selectedPrintIds);
        setIsSubmitting(true);
        try {
            const printData: { comm: Commission, items: CommissionItem[] }[] = [];
            const commissionsToPrint = commissions.filter(c => selectedPrintIds.has(c.id));

            for (const comm of commissionsToPrint) {
                const { data } = await supabase.from('commission_items').select('*, article:articles(*)').eq('commission_id', comm.id);
                const items = data ? data.map((i: any) => ({ ...i, article: i.article })) : [];
                printData.push({ comm, items });
                await logCommissionEvent(comm.id, comm.name, 'labels_printed', 'Etiketten aus Warteschlange gedruckt');
            }
            generateBatchPDF(printData);
            await supabase.from('commissions').update({ needs_label: false }).in('id', ids);
            setSelectedPrintIds(new Set());
            refreshCommissions();
            fetchPrintHistory();
            setPrintTab('history');
        } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
    };

    // Copy-pasted PDF Generation (Crucial to preserve)
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
            const renderLocation = (article: Article) => (!article.category && !article.location) ? '-' : `${article.category || ''} / ${article.location || ''}`;

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

    // --- WORKFLOW ACTIONS ---
    const allItemsPicked = commItems.length === 0 || commItems.every(i => i.is_picked);
    const hasBackorders = commItems.some(i => i.is_backorder);

    const handleSetReadyTrigger = () => {
        if (!activeCommission || !allItemsPicked || hasBackorders) return;
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
            await supabase.from('commissions').update({ status: 'Ready' }).eq('id', activeCommission.id);
            await logCommissionEvent(activeCommission.id, activeCommission.name, 'status_change', 'Status auf BEREIT gesetzt.');
            setActiveCommission(prev => prev ? { ...prev, status: 'Ready' } : null);
            refreshCommissions();
            setShowConfirmReadyModal(false);
        } catch (err: any) { alert("Fehler: " + err.message); } finally { setIsSubmitting(false); }
    };

    const handleWithdrawTrigger = () => setShowConfirmWithdrawModal(true);
    const executeWithdraw = async () => {
        if (!activeCommission) return;
        setIsSubmitting(true);
        try {
            await supabase.from('commissions').update({ status: 'Withdrawn', withdrawn_at: new Date().toISOString() }).eq('id', activeCommission.id);
            await logCommissionEvent(activeCommission.id, activeCommission.name, 'status_change', 'Kommission entnommen (Abgeschlossen)');
            setShowConfirmWithdrawModal(false);
            setActiveCommission(null);
            refreshCommissions();
        } catch (err: any) { alert(err.message); } finally { setIsSubmitting(false); }
    };

    // Other Status Updates
    const executeResetStatus = async () => {
        if (!activeCommission || !window.confirm("Status zurücksetzen?")) return;
        setIsSubmitting(true);
        try {
            await supabase.from('commissions').update({ status: 'Preparing' }).eq('id', activeCommission.id);
            await logCommissionEvent(activeCommission.id, activeCommission.name, 'status_change', 'Status manuell zurückgestellt');
            setActiveCommission(prev => prev ? { ...prev, status: 'Preparing' } : null);
            refreshCommissions();
        } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
    };

    const executeRevertWithdrawal = async () => {
        if (!activeCommission || !window.confirm("Wieder auf Bereit setzen?")) return;
        setIsSubmitting(true);
        try {
            await supabase.from('commissions').update({ status: 'Ready', withdrawn_at: null }).eq('id', activeCommission.id);
            await logCommissionEvent(activeCommission.id, activeCommission.name, 'status_change', 'Entnahme widerrufen');
            setActiveCommission(prev => prev ? { ...prev, status: 'Ready', withdrawn_at: undefined } : null);
            refreshCommissions();
        } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
    };

    const handleInitReturn = async () => {
        if (!activeCommission || !window.confirm("Als Retoure markieren?")) return;
        setIsSubmitting(true);
        try {
            await supabase.from('commissions').update({ status: 'ReturnPending', is_processed: false }).eq('id', activeCommission.id);
            await logCommissionEvent(activeCommission.id, activeCommission.name, 'status_change', 'Als Retoure markiert');
            setActiveCommission(null);
            setActiveTab('returns');
            refreshCommissions();
        } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
    };

    const handleReturnToReady = async () => {
        if (!activeCommission) return;
        setIsSubmitting(true);
        try {
            await supabase.from('commissions').update({ status: 'ReturnReady' }).eq('id', activeCommission.id);
            printReturnLabel(activeCommission);
            await logCommissionEvent(activeCommission.id, activeCommission.name, 'status_change', 'Retoure ins Abholregal gelegt');
            setActiveCommission(prev => prev ? { ...prev, status: 'ReturnReady' } : null);
            refreshCommissions();
        } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
    };

    const handleCompleteReturn = async () => {
        if (!activeCommission) return;
        setIsSubmitting(true);
        try {
            await supabase.from('commissions').update({ status: 'ReturnComplete' }).eq('id', activeCommission.id);
            await logCommissionEvent(activeCommission.id, activeCommission.name, 'status_change', 'Retoure abgeholt');
            setActiveCommission(null);
            refreshCommissions();
        } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
    };

    // Toggle Picked/Backorder
    const toggleActiveItemPicked = async (itemId: string, currentVal: boolean) => {
        const item = commItems.find(i => i.id === itemId);
        if (item && item.is_backorder) return;
        const newVal = !currentVal;
        await supabase.from('commission_items').update({ is_picked: newVal }).eq('id', itemId);
        setCommItems(prev => prev.map(i => i.id === itemId ? { ...i, is_picked: newVal } : i));

        // Auto status
        if (newVal === true && activeCommission?.status === 'Draft') {
            await supabase.from('commissions').update({ status: 'Preparing' }).eq('id', activeCommission.id);
            setActiveCommission(prev => prev ? { ...prev, status: 'Preparing' } : null);
            refreshCommissions();
        }
    };

    const toggleBackorder = async (itemId: string, currentVal: boolean) => {
        const newVal = !currentVal;
        await supabase.from('commission_items').update({ is_backorder: newVal }).eq('id', itemId);
        setCommItems(prev => prev.map(i => i.id === itemId ? { ...i, is_backorder: newVal } : i));
        setLabelDataChanged(true);
    };

    const saveItemNote = async (itemId: string, note: string) => {
        await supabase.from('commission_items').update({ notes: note }).eq('id', itemId);
        setCommItems(prev => prev.map(i => i.id === itemId ? { ...i, notes: note } : i));
        setLabelDataChanged(true);
    };

    // --- LIST CONTENT ---

    const filteredGroups = useMemo(() => {
        const groups = { ready: [] as ExtendedCommission[], preparing: [] as ExtendedCommission[], draft: [] as ExtendedCommission[], returnReady: [] as ExtendedCommission[], returnPending: [] as ExtendedCommission[] };
        commissions.forEach(c => {
            if (c.status === 'Ready') groups.ready.push(c);
            else if (c.status === 'Preparing') groups.preparing.push(c);
            else if (c.status === 'Draft') groups.draft.push(c);
            else if (c.status === 'ReturnReady') groups.returnReady.push(c);
            else if (c.status === 'ReturnPending') groups.returnPending.push(c);
        });
        return groups;
    }, [commissions]);

    const renderCategory = (title: string, statusKey: 'ready' | 'preparing' | 'draft' | 'returnReady' | 'returnPending', items: ExtendedCommission[], colorClass: string) => {
        const isCollapsed = collapsedCategories[statusKey];
        if (items.length === 0) return null;
        return (
            <div className="mb-4">
                <div onClick={() => setCollapsedCategories(prev => ({ ...prev, [statusKey]: !prev[statusKey] }))} className="flex items-center justify-between mb-2 px-2 cursor-pointer select-none">
                    <div className="flex items-center gap-2"><div className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}>▼</div><h3 className={`font-bold uppercase tracking-wider text-xs ${colorClass}`}>{title} ({items.length})</h3></div>
                    <div className="h-px bg-white/10 flex-1 ml-4"></div>
                </div>
                {!isCollapsed && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {items.map(comm => (
                            <CommissionCard key={comm.id} commission={comm} colorClass={colorClass} statusKey={statusKey} onClick={handleOpenDetail} onEdit={handleEditCommission} onDelete={(id, name, mode, e) => { handleDelete(id, name, mode, e); }} onPrintLabel={undefined} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Deletion Logic
    const handleDelete = async (id: string, name: string, mode: 'trash' | 'permanent', e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!confirm(`${mode === 'trash' ? 'In Papierkorb?' : 'Endgültig löschen?'} (${name})`)) return;
        try {
            if (mode === 'trash') await supabase.from('commissions').update({ deleted_at: new Date().toISOString() }).eq('id', id);
            else await supabase.from('commissions').delete().eq('id', id);
            refreshCommissions();
        } catch (err) { console.error(err); }
    };

    const handleRestore = async (id: string, name: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        try {
            await supabase.from('commissions').update({ deleted_at: null }).eq('id', id);
            refreshCommissions();
        } catch (err) { console.error(err); }
    };

    const isMobile = useIsMobile();

    const listContent = (
        <div className="space-y-6 pb-24 h-full overflow-y-auto pr-2">
            <header className="flex flex-col gap-4">
                <div className={`flex ${isMobile ? 'flex-col items-start gap-3' : 'justify-between items-center'}`}>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-200">Komm.</h1>
                    <div className={`flex gap-2 ${isMobile ? 'w-full overflow-x-auto pb-1 no-scrollbar' : ''}`}>
                        <Button icon={<Search size={18} />} variant="secondary" onClick={() => setSidePanelMode('search')} />
                        <Button icon={<History size={18} />} variant="secondary" onClick={() => { setSidePanelMode('history'); fetchHistory(); }} />
                        <Button icon={<BoxSelect size={18} />} variant="secondary" onClick={() => setShowCleanupModal(true)} className="bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-white" />
                        <Button icon={<Plus size={18} />} onClick={handleOpenCreate}>Neu</Button>
                    </div>
                </div>
                <div className="flex gap-2 p-1 bg-black/20 rounded-xl w-full sm:w-fit border border-white/5 overflow-x-auto">
                    <button onClick={() => setActiveTab('active')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${activeTab === 'active' ? 'bg-white/10 text-white' : 'text-white/50'}`}>Aktive</button>
                    <button onClick={() => setActiveTab('missing')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex gap-2 ${activeTab === 'missing' ? 'bg-white/10 text-white' : 'text-white/50'}`}>Vermisst {tabCounts.missing > 0 && <span className="bg-rose-500 text-white text-[10px] px-1.5 rounded-full">{tabCounts.missing}</span>}</button>
                    <button onClick={() => setActiveTab('withdrawn')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${activeTab === 'withdrawn' ? 'bg-white/10 text-white' : 'text-white/50'}`}>Entnommen</button>
                    <button onClick={() => setActiveTab('trash')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex gap-2 ${activeTab === 'trash' ? 'bg-white/10 text-white' : 'text-white/50'}`}>Papierkorb</button>
                    <button onClick={() => setActiveTab('returns')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex gap-2 ${activeTab === 'returns' ? 'bg-white/10 text-white' : 'text-white/50'}`}>Retouren {tabCounts.returns > 0 && <span className="bg-purple-500 text-white text-[10px] px-1.5 rounded-full">{tabCounts.returns}</span>}</button>
                </div>
            </header>

            {activeTab === 'active' && <PrintingSection showPrintArea={showPrintArea} setShowPrintArea={setShowPrintArea} printTab={printTab} setPrintTab={setPrintTab} queueItems={queueItems} selectedPrintIds={selectedPrintIds} setSelectedPrintIds={setSelectedPrintIds} onMarkAsPrinted={markLabelsAsPrinted} isSubmitting={isSubmitting} loadingHistory={loadingPrintHistory} printLogs={recentPrintLogs} onReprint={handleSinglePrint} />}

            {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-emerald-400" /></div> : (
                <div className="grid grid-cols-1 gap-4">
                    {commissions.length === 0 && <div className="text-white/40 text-center py-10">Keine Einträge.</div>}

                    {activeTab === 'active' && (
                        <>
                            {renderCategory("Bereitgestellt", 'ready', filteredGroups.ready, 'text-emerald-400')}
                            {renderCategory("In Vorbereitung", 'preparing', filteredGroups.preparing, 'text-blue-400')}
                            {renderCategory("Entwürfe", 'draft', filteredGroups.draft, 'text-white/60')}
                        </>
                    )}

                    {activeTab === 'returns' && (
                        <>
                            {renderCategory("Abholbereit", 'returnReady', filteredGroups.returnReady, 'text-purple-400')}
                            {renderCategory("Angemeldet", 'returnPending', filteredGroups.returnPending, 'text-orange-400')}
                        </>
                    )}

                    {activeTab === 'withdrawn' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {commissions.filter(c => ['Withdrawn', 'ReturnComplete'].includes(c.status)).map(c => <CommissionCard key={c.id} commission={c} onClick={handleOpenDetail} onEdit={handleEditCommission} onDelete={handleDelete} className="opacity-80 hover:opacity-100" colorClass="border-blue-500/20" statusKey="withdrawn" />)}
                        </div>
                    )}

                    {activeTab === 'missing' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {commissions.map(c => <GlassCard key={c.id} className="border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10"><div className="p-3">
                                <h3 className="text-lg font-bold text-rose-200">{c.name}</h3>
                                <div className="mt-2 flex gap-2">
                                    <button onClick={() => handleDelete(c.id, c.name, 'trash')} className="p-2 bg-rose-500/20 text-rose-300 rounded hover:text-white"><Trash2 size={16} /></button>
                                </div>
                            </div></GlassCard>)}
                        </div>
                    )}

                    {activeTab === 'trash' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {commissions.map(c => <GlassCard key={c.id} className="opacity-60 border-rose-500/20"><div className="p-3 flex justify-between items-center">
                                <div><h3 className="font-bold text-white/70">{c.name}</h3><span className="text-xs text-rose-400">Gelöscht: {c.deleted_at}</span></div>
                                <div className="flex gap-2"><button onClick={(e) => handleRestore(c.id, c.name, e)} className="p-2 bg-emerald-500/20 text-emerald-300 rounded"><RotateCcw size={16} /></button><button onClick={(e) => handleDelete(c.id, c.name, 'permanent', e)} className="p-2 bg-rose-500/20 text-rose-300 rounded"><X size={16} /></button></div>
                            </div></GlassCard>)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    const isWidePanel = sidePanelMode === 'create' || sidePanelMode === 'edit';

    return (
        <MasterDetailLayout
            isOpen={sidePanelMode !== 'none'}
            onClose={handleCloseSidePanel}
            title={getSidePanelTitle()}
            listContent={listContent}
            detailContent={renderSidePanelContent()}
            panelWidth={'35%'}
            hideHeader={isWidePanel}
            contentClassName={isWidePanel ? 'p-0 overflow-hidden' : 'p-6 overflow-y-auto custom-scrollbar'}
        >
            <GlassModal isOpen={showConfirmReadyModal} onClose={() => setShowConfirmReadyModal(false)} className="max-w-sm">
                <div className="p-6 text-center">
                    <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Bereitstellen?</h3>
                    <p className="text-white/60 mb-6">Lagerbestände werden gebucht.</p>
                    <div className="flex gap-3"><Button variant="secondary" onClick={() => setShowConfirmReadyModal(false)} className="flex-1">Abbrechen</Button><Button onClick={executeSetReady} className="flex-1 bg-emerald-600 hover:bg-emerald-500">OK</Button></div>
                </div>
            </GlassModal>

            <GlassModal isOpen={showConfirmWithdrawModal} onClose={() => setShowConfirmWithdrawModal(false)} className="max-w-sm">
                <div className="p-6 text-center">
                    <LogOut size={48} className="mx-auto text-purple-400 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Entnehmen & Abschließen?</h3>
                    <div className="flex gap-3 mt-6"><Button variant="secondary" onClick={() => setShowConfirmWithdrawModal(false)} className="flex-1">Abbrechen</Button><Button onClick={executeWithdraw} className="flex-1 bg-purple-600 hover:bg-purple-500">OK</Button></div>
                </div>
            </GlassModal>

            {showLabelUpdateModal && activeCommission && (
                <GlassModal isOpen={true} onClose={() => setShowLabelUpdateModal(false)} className="max-w-sm text-center">
                    <div className="p-6">
                        <AlertTriangle size={48} className="mx-auto text-amber-500 mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">Etikett aktualisieren?</h3>
                        <p className="text-white/60 mb-4">Daten geändert.</p>
                        <div className="space-y-2">
                            <Button onClick={() => handleSinglePrint(activeCommission!.id)} className="w-full">Drucken</Button>
                            <Button onClick={() => setShowLabelUpdateModal(false)} variant="secondary" className="w-full">Nein</Button>
                        </div>
                    </div>
                </GlassModal>
            )}

            <GlassModal isOpen={!!showLabelOptionsModal} onClose={() => setShowLabelOptionsModal(null)} className="max-w-md text-center">
                <div className="p-6">
                    <Tag size={48} className="mx-auto text-blue-500 mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Kommission erstellt!</h2>
                    <p className="text-white/60 mb-6">Möchtest du direkt ein Etikett drucken?</p>

                    <div className="space-y-3">
                        <Button onClick={() => handleSinglePrint(showLabelOptionsModal!)} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500" icon={<Printer size={18} />}>Sofort drucken</Button>
                        <Button onClick={() => {
                            // Find commission name for the log/queue
                            const comm = commissions.find(c => c.id === showLabelOptionsModal); // Might need refresh?
                            // Actually handleQueue requires finding it. 
                            // Since we just refreshed, it should be in commissions list soon or we fetch it.
                            // For now, let's just trigger queue logic which handles update.
                            // But handleAddToQueue helper function is missing in this version of code?!
                            // Let's implement queue logic inline or verify if handleAddToQueue exists.
                            // Checking previous view_file of Commissions.tsx... handleAddToQueue was NOT in the file viewing (Step 236). 
                            // I need to implement the queue action logic here or add the helper.
                            // Let's use supabase directly for queueing to be safe and simple.
                            const addToQueue = async () => {
                                await supabase.from('commissions').update({ needs_label: true }).eq('id', showLabelOptionsModal);
                                setShowLabelOptionsModal(null);
                                refreshCommissions();
                            };
                            addToQueue();
                        }} className="w-full py-3 bg-blue-600 hover:bg-blue-500" icon={<Layers size={18} />}>Zur Druckwarteschlange</Button>
                        <Button onClick={() => setShowLabelOptionsModal(null)} variant="secondary" className="w-full">Schließen</Button>
                    </div>
                </div>
            </GlassModal>

            <CommissionCleanupModal isOpen={showCleanupModal} onClose={() => setShowCleanupModal(false)} />

        </MasterDetailLayout>
    );
};

export default Commissions;
