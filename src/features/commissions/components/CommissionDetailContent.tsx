'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Button, StatusBadge, GlassModal } from '../../../components/UIComponents';
import { ExtendedCommission, CommissionItem } from '../../../../types';
import { supabase } from '../../../../supabaseClient';
import { X, CheckCircle2, Truck, RotateCcw, Edit2, Printer, Check, Undo2, Package, ExternalLink, MessageSquare, Eye, AlertTriangle, FileText, History, PackageX, ScanLine, Clock, ChevronRight, MapPin, Plus, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { copyTextToClipboard } from '../../../../utils/clipboard';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const compareLocations = (a: any, b: any) => {
    const locA = a.type === 'Stock' ? (a.article?.location || '') : '';
    const locB = b.type === 'Stock' ? (b.article?.location || '') : '';
    if (!locA) return 1;
    if (!locB) return -1;
    return locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' });
};

const getEventIconAndColor = (type: string) => {
    switch (type) {
        case 'status_change':
            return {
                bg: "bg-blue-100 dark:text-blue-400 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
                icon: <Clock size={12} />
            };
        case 'item_picked':
            return {
                bg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
                icon: <Check size={12} />
            };
        case 'labels_printed':
        case 'labels_reprinted':
            return {
                bg: "bg-purple-100 dark:text-purple-400 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
                icon: <Printer size={12} />
            };
        case 'storno':
        case 'deleted':
            return {
                bg: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
                icon: <Undo2 size={12} />
            };
        default:
            return {
                bg: "bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400",
                icon: <History size={12} />
            };
    }
};

interface CommissionDetailContentProps {
    commission: ExtendedCommission | null;
    items: any[];
    localHistoryLogs: any[];
    allItemsPicked: boolean;
    hasBackorders: boolean;
    isSubmitting: boolean;
    onSetReady: () => void;
    onWithdraw: () => void;
    onResetStatus: () => void;
    onRevertWithdraw: () => void;
    onInitReturn: () => void;
    onReturnToReady: () => void;
    onCompleteReturn: () => void;
    onEdit: (e: React.MouseEvent) => void;
    onPrint: () => void;
    onTogglePicked: (itemId: string, current: boolean) => void;
    onToggleBackorder: (itemId: string, current: boolean) => void;
    onSaveNote: (itemId: string, note: string) => void;
    onClose?: () => void;
    onSaveOfficeData?: (isProcessed: boolean, notes: string) => void;
    onRequestCancellation?: (id: string, type: 'restock' | 'return_supplier', note: string) => void;
    onStartScan?: () => void;
    onDelete?: (e: React.MouseEvent) => void;
    onUpdateStagingLocations?: (locations: string[]) => void;
}

export const CommissionDetailContent: React.FC<CommissionDetailContentProps> = ({
    commission, items, localHistoryLogs, allItemsPicked, hasBackorders, isSubmitting,
    onSetReady, onWithdraw, onResetStatus, onRevertWithdraw, onInitReturn,
    onReturnToReady, onCompleteReturn, onEdit, onPrint, onTogglePicked,
    onToggleBackorder, onSaveNote, onClose, onSaveOfficeData, onRequestCancellation,
    onStartScan, onDelete, onUpdateStagingLocations
}) => {
    const [editingItemNote, setEditingItemNote] = useState<{ itemId: string; note: string } | null>(null);
    const [viewingAttachment, setViewingAttachment] = useState<string | null>(null);

    const [hidePicked, setHidePicked] = useState(false);
    const [sortByLocation, setSortByLocation] = useState(true);
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    useEffect(() => {
        setShowMobileMenu(false);
    }, [commission?.id, commission?.status]);

    // Storno State
    const [showStornoModal, setShowStornoModal] = useState(false);
    const [stornoType, setStornoType] = useState<'restock' | 'return_supplier'>('restock');
    const [stornoNote, setStornoNote] = useState('');

    // Office Data State
    const [officeNotes, setOfficeNotes] = useState(commission?.office_notes || '');
    const [isProcessed, setIsProcessed] = useState(commission?.is_processed || false);

    // Staging Locations State
    const [locations, setLocations] = useState<string[]>(commission?.staging_locations || ['Regal']);
    const [customInput, setCustomInput] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [savingLocations, setSavingLocations] = useState(false);

    // Sync state when commission changes
    useEffect(() => {
        if (commission) {
            setOfficeNotes(commission.office_notes || '');
            setIsProcessed(commission.is_processed || false);
            setLocations(commission.staging_locations || ['Regal']);
        }
    }, [commission]);

    const headerPrimaryAction = useMemo(() => {
        if (!commission) return null;
        const status = commission.status;
        const allNonBackorderedItemsPicked = items.filter(i => !i.is_backorder).every(i => i.is_picked);

        if (status === 'Draft' || status === 'Preparing') {
            if (hasBackorders) {
                return (
                    <div className="flex flex-col gap-2 w-full">
                        <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold leading-snug">
                            <AlertTriangle size={16} className="shrink-0" />
                            <span>Kommission auf Rückstand (Bereitstellen gesperrt).</span>
                        </div>
                        <Button 
                            disabled={true} 
                            className="w-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 font-bold h-10 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed border-none text-xs sm:text-sm"
                        >
                            <CheckCircle2 size={16} /> Bereitstellen
                        </Button>
                    </div>
                );
            } else if (allNonBackorderedItemsPicked) {
                return (
                    <Button 
                        onClick={onSetReady} 
                        disabled={isSubmitting} 
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-10 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 active:scale-95 transition-all duration-200 cursor-pointer text-xs sm:text-sm border-none"
                    >
                        <CheckCircle2 size={16} /> Bereitstellen
                    </Button>
                );
            }
        } else if (status === 'Ready') {
            return (
                <div className="flex gap-2 w-full">
                    <Button 
                        onClick={onResetStatus} 
                        disabled={isSubmitting} 
                        variant="secondary"
                        className="flex-1 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50 bg-amber-500/5 hover:bg-amber-500/10 font-bold h-10 px-4 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all duration-200 cursor-pointer text-xs sm:text-sm"
                    >
                        <RotateCcw size={16} /> Zurückstellen
                    </Button>
                    <Button 
                        onClick={onWithdraw} 
                        disabled={isSubmitting} 
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold h-10 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/10 active:scale-95 transition-all duration-200 cursor-pointer text-xs sm:text-sm border-none"
                    >
                        <Truck size={16} /> Entnehmen
                    </Button>
                </div>
            );
        } else if (status === 'ReturnPending') {
            const isRestock = commission.notes?.includes('Einlagern') || commission.notes?.includes('ZURÜCK INS LAGER');
            return (
                <Button 
                    onClick={isRestock ? onCompleteReturn : onReturnToReady} 
                    disabled={isSubmitting} 
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-10 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 active:scale-95 transition-all duration-200 cursor-pointer text-xs sm:text-sm border-none"
                >
                    <CheckCircle2 size={16} /> {isRestock ? 'Eingelagert' : 'Ins Abholregal'}
                </Button>
            );
        } else if (status === 'ReturnReady') {
            return (
                <Button 
                    onClick={onCompleteReturn} 
                    disabled={isSubmitting} 
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-10 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 active:scale-95 transition-all duration-200 cursor-pointer text-xs sm:text-sm border-none"
                >
                    <CheckCircle2 size={16} /> Erledigt
                </Button>
            );
        } else if (status === 'Withdrawn') {
            return (
                <div className="flex gap-2 w-full">
                    <Button 
                        onClick={onRevertWithdraw} 
                        disabled={isSubmitting} 
                        variant="secondary"
                        className="flex-1 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50 bg-amber-500/5 hover:bg-amber-500/10 font-bold h-10 px-4 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all duration-200 cursor-pointer text-xs sm:text-sm"
                    >
                        <RotateCcw size={16} /> Zurückstellen
                    </Button>
                    <Button 
                        onClick={onInitReturn} 
                        disabled={isSubmitting} 
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold h-10 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/10 active:scale-95 transition-all duration-200 cursor-pointer text-xs sm:text-sm border-none"
                    >
                        <Undo2 size={16} /> Retoure anmelden
                    </Button>
                </div>
            );
        }
        return null;
    }, [commission?.status, commission?.notes, items, hasBackorders, isSubmitting, onSetReady, onWithdraw, onCompleteReturn, onReturnToReady, onRevertWithdraw, onInitReturn, onResetStatus]);

    const handleSaveOffice = () => {
        if (onSaveOfficeData) {
            onSaveOfficeData(isProcessed, officeNotes);
        }
    };

    const translateStatus = (s: string) => {
        switch (s) {
            case 'Draft': return 'Entwurf';
            case 'Preparing': return 'In Vorbereitung';
            case 'Ready': return 'Bereitgestellt';
            case 'Withdrawn': return 'Entnommen';
            case 'ReturnReady': return 'Abholbereit (Retoure)';
            case 'ReturnPending': return 'Angemeldet (Retoure)';
            case 'ReturnComplete': return 'Retoure Abgeschlossen';
            default: return s;
        }
    };

    const openItems = useMemo(() => {
        let result = items.filter(item => !item.is_picked);
        if (sortByLocation) {
            result = [...result].sort(compareLocations);
        }
        return result;
    }, [items, sortByLocation]);

    const pickedItems = useMemo(() => {
        let result = items.filter(item => item.is_picked);
        if (sortByLocation) {
            result = [...result].sort(compareLocations);
        }
        return result;
    }, [items, sortByLocation]);

    const progressPercent = useMemo(() => {
        if (!items || items.length === 0) return 0;
        // Backordered items do not count as picked for progress percent
        const picked = items.filter(item => item.is_picked && !item.is_backorder).length;
        const calcPercent = Math.round((picked / items.length) * 100);
        // If there are backorders, cap at 95% so it doesn't show 100% completion
        const hasBo = items.some(item => item.is_backorder);
        if (hasBo && calcPercent === 100) {
            return 95;
        }
        return calcPercent;
    }, [items]);

    const activeStep = useMemo(() => {
        if (!commission) return 0;
        const status = commission.status;
        if (status === 'Preparing' || status === 'Missing') return 1;
        if (status === 'Ready' || status === 'ReturnReady' || status === 'ReturnPending') return 2;
        if (status === 'Withdrawn' || status === 'ReturnComplete') return 3;
        return 0; // Draft
    }, [commission?.status]);

    const [copiedItemId, setCopiedItemId] = useState<string | null>(null);

    const handleCopyRef = async (e: React.MouseEvent, text: string, itemId: string) => {
        e.stopPropagation();
        if (!text || text === '-') return;
        const success = await copyTextToClipboard(text);
        if (success) {
            setCopiedItemId(itemId);
            toast.success("Vorgangsnummer kopiert");
            setTimeout(() => setCopiedItemId(null), 2000);
        } else {
            toast.error("Kopieren fehlgeschlagen");
        }
    };

    const renderItemCard = (item: any) => {
        const isPicked = item.is_picked;
        const isBackorder = item.is_backorder;
        const isStock = item.type === 'Stock';
        
        let cardBg = "bg-white dark:bg-card border-slate-200 dark:border-border hover:border-primary/40 shadow-sm";
        let leftBarColor = "bg-slate-300 dark:bg-slate-700";

        if (isBackorder) {
            cardBg = "bg-orange-50/70 dark:bg-orange-950/15 border-orange-200 dark:border-orange-900/40 shadow-sm hover:border-orange-300/60";
            leftBarColor = "bg-orange-500";
        } else if (isPicked) {
            cardBg = "bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30 opacity-80 shadow-sm hover:border-emerald-200/50";
            leftBarColor = "bg-emerald-500";
        } else if (isStock) {
            cardBg = "bg-blue-50/30 dark:bg-blue-950/5 border-blue-200/60 dark:border-blue-900/30 hover:border-blue-300 shadow-sm";
            leftBarColor = "bg-blue-500";
        } else {
            cardBg = "bg-purple-50/30 dark:bg-purple-950/5 border-purple-200/60 dark:border-purple-900/30 hover:border-purple-300 shadow-sm";
            leftBarColor = "bg-purple-500";
        }

        return (
            <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onTogglePicked(item.id, item.is_picked)}
                key={item.id} 
                className={cn(
                    "group flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden cursor-pointer",
                    cardBg
                )}
            >
                <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 transition-all", leftBarColor)} />

                <div className="flex items-start gap-4 flex-1 w-full pl-1">
                    <div
                        className={cn(
                            "mt-1 shrink-0 w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all shadow-sm",
                            isPicked 
                                ? "bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/20 scale-105" 
                                : isStock
                                    ? "border-blue-300 dark:border-blue-700 text-transparent bg-white dark:bg-slate-800"
                                    : "border-purple-300 dark:border-purple-700 text-transparent bg-white dark:bg-slate-800"
                        )}
                    >
                        <Check size={18} strokeWidth={3} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className={cn(
                                "font-black text-sm px-2.5 py-1 rounded-lg leading-none shadow-sm shrink-0 border",
                                isPicked 
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/40" 
                                    : isStock 
                                        ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800/40"
                                        : "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800/40"
                            )}>
                                {item.amount}x
                            </span>
                            <span className={cn(
                                "font-bold text-slate-800 dark:text-slate-100 text-base tracking-tight",
                                isPicked && "line-through opacity-60"
                            )}>
                                {isStock ? item.article?.name : item.custom_name}
                            </span>
                            <span className={cn(
                                "text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-sm shrink-0 inline-flex items-center gap-1",
                                isStock 
                                    ? "bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400 text-blue-800 dark:text-blue-400 border-blue-100 dark:border-blue-900/30" 
                                    : "bg-purple-50 dark:bg-purple-950/20 dark:text-purple-400 text-purple-800 dark:text-purple-400 border-purple-100 dark:border-purple-900/30"
                            )}>
                                {isStock ? (
                                    <>
                                        <Package size={10} />
                                        Lagerware
                                    </>
                                ) : (
                                    <>
                                        <Truck size={10} />
                                        Bestellware
                                    </>
                                )}
                            </span>
                        </div>
                        
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 mt-2">
                            {isStock ? (
                                <>
                                    <span className="flex items-center gap-1.5 bg-blue-600 dark:bg-blue-500 text-white px-3 py-1 rounded-lg font-black font-mono shadow-sm tracking-wide text-xs">
                                        <MapPin size={12} className="dark:text-blue-200 text-blue-900 dark:text-blue-100" /> 
                                        {item.article?.location || 'Kein Lagerort'}
                                    </span>
                                    {item.article?.sku && (
                                        <span className="bg-white dark:bg-slate-850 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 font-mono text-[10px] shadow-sm">
                                            SKU: {item.article.sku}
                                        </span>
                                    )}
                                    {item.article?.ean && (
                                        <span className="bg-white dark:bg-slate-850 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 font-mono text-[10px] shadow-sm">
                                            EAN: {item.article.ean}
                                        </span>
                                    )}
                                    {item.article?.stock !== undefined && item.article?.stock !== null && (
                                        <span className={cn(
                                            "px-2 py-0.5 rounded border text-[10px] font-bold shadow-sm",
                                            item.article.stock > 0 
                                                ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/30 dark:border-emerald-900/30" 
                                                : "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-200/30 dark:border-rose-900/30"
                                        )}>
                                            Bestand: {item.article.stock} Stk
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <button 
                                        onClick={(e) => handleCopyRef(e, item.external_reference, item.id)}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors border text-xs font-mono font-bold cursor-pointer shadow-sm",
                                            copiedItemId === item.id 
                                                ? "bg-emerald-500 border-emerald-600 text-white" 
                                                : "bg-purple-600 border-purple-500 hover:bg-purple-700 text-white"
                                        )}
                                        title="Bestellnummer kopieren"
                                    >
                                        {copiedItemId === item.id ? <Check size={12} /> : <ExternalLink size={12} />}
                                        Bestellung: {item.external_reference || '-'}
                                    </button>
                                </>
                            )}
                            {isBackorder && (
                                <span className="inline-flex items-center text-[10px] font-extrabold uppercase tracking-wider text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/20 px-2.5 py-1 rounded-lg border border-orange-200 dark:border-orange-500/30 shadow-sm animate-pulse">
                                    <AlertTriangle size={12} className="mr-1 shrink-0" /> Rückstand
                                </span>
                            )}
                        </div>
                        
                        {item.notes && (
                            <div className="mt-3 inline-flex items-start gap-2 text-amber-800 dark:text-amber-300 text-xs font-medium bg-amber-500/5 dark:bg-amber-500/10 px-3.5 py-2.5 rounded-xl border border-amber-500/20 dark:border-amber-500/10 w-full shadow-inner">
                                <MessageSquare size={14} className="mt-0.5 shrink-0 text-amber-500" />
                                <span className="leading-relaxed">{item.notes}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-slate-800">
                    {!isStock && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onToggleBackorder(item.id, item.is_backorder || false); }} 
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all border shadow-sm cursor-pointer",
                                isBackorder 
                                    ? 'bg-orange-500 border-orange-600 text-foreground shadow-orange-500/20' 
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 dark:hover:bg-orange-900/30'
                            )}
                        >
                            Rückstand
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); setEditingItemNote({ itemId: item.id, note: item.notes || '' }); }}
                        className={cn(
                            "p-2 min-w-[44px] min-h-[44px] rounded-lg transition-all shadow-sm border cursor-pointer",
                            item.notes
                                ? 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 hover:bg-amber-200'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-primary hover:border-primary/40'
                        )}
                        title="Notiz hinzufügen"
                        aria-label="Notiz hinzufügen"
                    >
                        <MessageSquare size={16} />
                    </button>
                </div>
            </motion.div>
        );
    };

    const renderActionTile = (label: string, icon: React.ReactNode, onClick: () => void, colorClass: string, disabled: boolean = false, subtext?: string) => (
        <button 
            onClick={onClick} 
            disabled={disabled}
            className={cn(
                "relative flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200 text-center gap-2 h-full w-full shadow-sm",
                disabled ? "opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400" :
                `${colorClass} hover:-translate-y-1 hover:shadow-md active:scale-95 cursor-pointer`
            )}
        >
            <div className="mb-1">{icon}</div>
            <div className="font-bold text-sm leading-tight">{label}</div>
            {subtext && <div className="text-[10px] opacity-80 mt-1">{subtext}</div>}
        </button>
    );

    if (!commission) return null;



    const renderSmartHeroActionCard = () => {
        const status = commission.status;
        let cardTitle = "";
        let cardDesc: React.ReactNode = "";
        let cardBg = "bg-white dark:bg-card border-slate-200 dark:border-border";
        let icon: React.ReactNode = null;
        let primaryAction: React.ReactNode = null;
        let secondaryActions: React.ReactNode[] = [];

        const readyBtn = (
            <Button 
                onClick={onSetReady} 
                disabled={isSubmitting || !allItemsPicked || hasBackorders} 
                className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform cursor-pointer"
            >
                <CheckCircle2 size={18} /> Jetzt bereitstellen
            </Button>
        );

        const withdrawBtn = (
            <Button 
                onClick={onWithdraw} 
                disabled={isSubmitting} 
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 active:scale-95 transition-transform cursor-pointer"
            >
                <Truck size={18} /> Entnehmen & Abschließen
            </Button>
        );

        const resetBtn = (
            <Button 
                onClick={onResetStatus} 
                disabled={isSubmitting} 
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-transform cursor-pointer"
            >
                <RotateCcw size={18} /> Zurückstellen
            </Button>
        );

        const returnCompleteBtn = (
            <Button 
                onClick={onCompleteReturn} 
                disabled={isSubmitting} 
                className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform cursor-pointer"
            >
                <CheckCircle2 size={18} /> Eingelagert / Erledigt
            </Button>
        );

        const returnToReadyBtn = (
            <Button 
                onClick={onReturnToReady} 
                disabled={isSubmitting} 
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 active:scale-95 transition-transform cursor-pointer"
            >
                <Printer size={18} /> Ins Abholregal legen
            </Button>
        );

        const revertWithdrawBtn = (
            <Button 
                onClick={onRevertWithdraw} 
                disabled={isSubmitting} 
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-transform cursor-pointer"
            >
                <RotateCcw size={18} /> Wiederherstellen
            </Button>
        );

        const initReturnBtn = (
            <Button 
                onClick={onInitReturn} 
                disabled={isSubmitting} 
                className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-foreground font-bold h-12 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95 transition-transform cursor-pointer"
            >
                <Undo2 size={18} /> Retoure buchen
            </Button>
        );

        if (status === 'Draft' || status === 'Preparing') {
            const allNonBackorderedItemsPicked = items.filter(i => !i.is_backorder).every(i => i.is_picked);
            
            if (!allNonBackorderedItemsPicked) {
                return null;
            } else if (hasBackorders) {
                cardTitle = "Rückstand vorhanden";
                cardDesc = "Mindestens ein Artikel ist auf Rückstand. Bereitstellen ist gesperrt, bis der Rückstand aufgehoben wurde.";
                cardBg = "bg-rose-50/50 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/40";
                icon = <AlertTriangle className="text-rose-500" size={36} />;
                primaryAction = readyBtn;
                secondaryActions = [];
            } else {
                cardTitle = "Fertig gepickt! 🎉";
                cardDesc = "Alle Artikel gepickt. Tippe „Jetzt bereitstellen“ zum Abschluss.";
                cardBg = "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30";
                icon = <CheckCircle2 className="text-emerald-500 animate-bounce" size={36} />;
                primaryAction = readyBtn;
                secondaryActions = [];
            }
        } else if (status === 'Ready') {
            const activeLocs = commission?.staging_locations && commission.staging_locations.length > 0
                ? commission.staging_locations
                : ['Regal'];
            cardTitle = "Kommission abholbereit";
            if (activeLocs.length === 1) {
                cardDesc = (
                    <span>
                        Bereitgestellt am Standort: <strong className="text-slate-900 dark:text-white">"{activeLocs[0]}"</strong>. Bitte verladen und Entnahme bestätigen.
                    </span>
                );
            } else {
                cardDesc = (
                    <span className="flex flex-col gap-1.5">
                        <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                            ⚠️ ACHTUNG: Ware liegt an mehreren Standorten!
                        </span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                            Bitte vollständig verladen von:
                        </span>
                        <span className="flex flex-wrap gap-1.5 mt-1">
                            {activeLocs.map(loc => (
                                <strong key={loc} className="px-3 py-1 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 rounded-xl text-xs font-black uppercase tracking-wider">
                                    {loc}
                                </strong>
                            ))}
                        </span>
                    </span>
                );
            }
            cardBg = "bg-purple-50/50 dark:bg-purple-950/10 border-purple-100 dark:border-purple-900/30";
            icon = <Package className="text-purple-500" size={36} />;
            primaryAction = withdrawBtn;
            secondaryActions = [resetBtn];
        } else if (status === 'ReturnPending') {
            const isRestock = commission.notes?.includes('Einlagern') || commission.notes?.includes('ZURÜCK INS LAGER');
            cardTitle = "Storno - Wiedereinlagerung ausstehend";
            cardDesc = isRestock 
                ? "Diese Kommission wurde storniert. Bitte bringe alle entnommenen Artikel zurück an ihren jeweiligen Lagerort."
                : "Diese Kommission wurde storniert. Bringe die Artikel in das Abholregal, um sie für den Rückversand an den Lieferanten vorzubereiten.";
            cardBg = "bg-orange-50/50 dark:bg-orange-950/10 border-orange-100 dark:border-orange-900/30";
            icon = <Undo2 className="text-orange-500" size={36} />;
            primaryAction = isRestock ? returnCompleteBtn : returnToReadyBtn;
            secondaryActions = [];
        } else if (status === 'ReturnReady') {
            cardTitle = "Stornoware abholbereit";
            cardDesc = "Die stornierte Ware liegt abholbereit im Abholregal und wartet auf die Abholung bzw. Rücksendung.";
            cardBg = "bg-purple-50/50 dark:bg-purple-950/10 border-purple-100 dark:border-purple-900/30";
            icon = <Truck className="text-purple-500" size={36} />;
            primaryAction = returnCompleteBtn;
            secondaryActions = [];
        } else if (status === 'Withdrawn') {
            cardTitle = "Erfolgreich abgeschlossen";
            cardDesc = "Die Artikel wurden entnommen und der Kommissionierungsprozess wurde erfolgreich abgeschlossen.";
            cardBg = "bg-slate-100/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800";
            icon = <Check className="text-slate-500" size={36} />;
            primaryAction = initReturnBtn;
            secondaryActions = [revertWithdrawBtn];
        } else if (status === 'ReturnComplete') {
            cardTitle = "Retoure abgeschlossen";
            cardDesc = "Die Retoure bzw. Wiedereinlagerung dieser stornierten Kommission wurde vollständig durchgeführt.";
            cardBg = "bg-slate-100/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800";
            icon = <Check className="text-slate-500" size={36} />;
            primaryAction = null;
            secondaryActions = [];
        } else {
            cardTitle = "Details";
            cardDesc = `Kommission befindet sich im Zustand: ${translateStatus(status)}`;
            icon = <FileText className="text-primary" size={36} />;
            primaryAction = null;
            secondaryActions = [];
        }

        return (
            <div className={cn("border rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm mb-6 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6 justify-between transition-colors duration-300", cardBg)}>
                <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1 p-2 bg-white dark:bg-slate-900 rounded-2xl shadow-inner shrink-0">{icon}</div>
                    <div>
                        <h3 className="font-extrabold text-lg text-slate-800 dark:text-white leading-snug mb-1">{cardTitle}</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-2xl">{cardDesc}</p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-200/50 dark:border-slate-800/50">
                    {primaryAction}
                    {secondaryActions.filter(Boolean).map((act, i) => (
                        <div key={i} className="flex-1 sm:flex-initial">{act}</div>
                    ))}
                </div>
            </div>
        );
    };

    const renderItemsControlBar = () => (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 px-2">
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Artikelliste ({items.length})</h3>
            <div className="flex items-center gap-3">


                <button 
                    onClick={() => setHidePicked(!hidePicked)}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm cursor-pointer",
                        hidePicked 
                            ? "bg-primary/10 text-primary border-primary/30" 
                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary/30"
                    )}
                >
                    {hidePicked ? "Gepickte einblenden" : "Gepickte verbergen"}
                </button>
            </div>
        </div>
    );

    const renderStagingLocationsWidget = () => {
        const defaultOptions = ['Regal', 'Garage', 'Hof', 'Palette'];
        
        const toggleLocation = async (locName: string) => {
            let nextLocs = [...locations];
            if (nextLocs.includes(locName)) {
                // Prevent removing the last remaining location
                if (nextLocs.length <= 1) {
                    toast.error("Mindestens ein Bereitstellungsort muss aktiv bleiben.");
                    return;
                }
                nextLocs = nextLocs.filter(l => l !== locName);
            } else {
                nextLocs.push(locName);
            }
            
            if (onUpdateStagingLocations) {
                onUpdateStagingLocations(nextLocs);
            } else {
                // Fallback direct update
                setSavingLocations(true);
                try {
                    const { error } = await supabase
                        .from('commissions')
                        .update({ staging_locations: nextLocs })
                        .eq('id', commission.id);
                    if (error) throw error;
                    setLocations(nextLocs);
                    toast.success("Bereitstellungsort aktualisiert");
                } catch (err: any) {
                    toast.error("Speichern fehlgeschlagen: " + err.message);
                } finally {
                    setSavingLocations(false);
                }
            }
        };

        const handleAddCustom = () => {
            const trimmed = customInput.trim();
            if (!trimmed) return;
            if (locations.includes(trimmed)) {
                toast.error("Ort existiert bereits.");
                return;
            }
            const nextLocs = [...locations, trimmed];
            setCustomInput('');
            setShowCustomInput(false);
            
            if (onUpdateStagingLocations) {
                onUpdateStagingLocations(nextLocs);
            } else {
                // Fallback direct update
                updateStagingLocationsDirect(nextLocs);
            }
        };

        const updateStagingLocationsDirect = async (nextLocs: string[]) => {
            setSavingLocations(true);
            try {
                const { error } = await supabase
                    .from('commissions')
                    .update({ staging_locations: nextLocs })
                    .eq('id', commission.id);
                if (error) throw error;
                setLocations(nextLocs);
                toast.success("Bereitstellungsort hinzugefügt");
            } catch (err: any) {
                toast.error("Speichern fehlgeschlagen: " + err.message);
            } finally {
                setSavingLocations(false);
            }
        };

        return (
            <div className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-2xl md:rounded-3xl p-4 md:p-5 mb-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <MapPin size={18} className="text-primary" />
                        BEREITSTELLUNGSORT(E)
                    </h3>
                    {savingLocations && <span className="text-[10px] text-muted-foreground animate-pulse">Speichert...</span>}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    {/* Render default options + any custom active options */}
                    {Array.from(new Set([...defaultOptions, ...locations])).map(loc => {
                        const isActive = locations.includes(loc);
                        return (
                            <button
                                key={loc}
                                onClick={() => toggleLocation(loc)}
                                className={cn(
                                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer border",
                                    isActive
                                        ? "bg-primary/10 border-primary/30 text-primary"
                                        : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:border-slate-800 dark:hover:bg-slate-800/80 dark:text-slate-400"
                                )}
                            >
                                {isActive && <Check size={11} strokeWidth={3} />}
                                {loc}
                            </button>
                        );
                    })}

                    {/* Custom Add Pill */}
                    {showCustomInput ? (
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 dark:bg-slate-800/40 dark:border-slate-800 rounded-xl px-2 py-0.5 animate-in fade-in zoom-in-95 duration-100">
                            <input
                                type="text"
                                className="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none w-20 py-1"
                                placeholder="Ort eingeben..."
                                value={customInput}
                                onChange={e => setCustomInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleAddCustom();
                                    if (e.key === 'Escape') {
                                        setShowCustomInput(false);
                                        setCustomInput('');
                                    }
                                }}
                                autoFocus
                            />
                            <button onClick={handleAddCustom} aria-label="Ort hinzufügen" className="p-1 min-w-[44px] min-h-[44px] text-primary hover:bg-primary/10 rounded-lg"><Check size={11} strokeWidth={3} /></button>
                            <button onClick={() => { setShowCustomInput(false); setCustomInput(''); }} aria-label="Abbrechen" className="p-1 min-w-[44px] min-h-[44px] text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={11} /></button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowCustomInput(true)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-400 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                            <Plus size={11} strokeWidth={3} />
                            Eigener Ort
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50 dark:bg-background overflow-y-auto relative font-sans custom-scrollbar">
            {/* HEADER */}
            <div className="bg-white dark:bg-card border-b border-slate-200 dark:border-border px-4 py-3 md:py-4 flex flex-col gap-3 shadow-sm shrink-0 relative z-30">
                {/* Main Content Area: Progress and Title Group */}
                <div className="flex items-start justify-between gap-3 w-full min-w-0">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* Progress Ring */}
                        <div className="relative w-11 h-11 flex items-center justify-center shrink-0 mt-0.5">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                <path className="text-slate-100 dark:text-slate-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <motion.path 
                                    className={`${hasBackorders ? "text-rose-500 dark:text-rose-400" : "text-primary"} drop-shadow-sm`} strokeWidth="3" strokeDasharray={`${progressPercent}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" 
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                                    initial={{ strokeDasharray: "0, 100" }} animate={{ strokeDasharray: `${progressPercent}, 100` }} transition={{ duration: 1, ease: "easeOut" }}
                                />
                            </svg>
                            <span className={`absolute text-[9px] font-bold ${hasBackorders ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"}`}>{progressPercent}%</span>
                        </div>
                        <div className="min-w-0 flex-1">
                            {/* Mini Stepper Breadcrumb (Hidden on narrow viewports/containers) */}
                            <div className="hidden items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5 flex-wrap">
                                <span className={cn(activeStep === 0 ? "text-primary font-extrabold" : activeStep > 0 ? "text-slate-600 dark:text-slate-400" : "")}>Erstellt</span>
                                <ChevronRight size={10} className="opacity-50 shrink-0" />
                                <span className={cn(activeStep === 1 ? "text-primary font-extrabold" : activeStep > 1 ? "text-slate-600 dark:text-slate-400" : "")}>In Arbeit</span>
                                <ChevronRight size={10} className="opacity-50 shrink-0" />
                                <span className={cn(activeStep === 2 ? "dark:text-purple-400 text-purple-800 dark:text-purple-400 font-extrabold" : activeStep > 2 ? "text-slate-600 dark:text-slate-400" : "")}>Bereitgestellt</span>
                                <ChevronRight size={10} className="opacity-50 shrink-0" />
                                <span className={cn(activeStep === 3 ? "text-emerald-600 dark:text-emerald-400 font-extrabold" : "")}>Abgeschlossen</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <h1 className="text-base md:text-lg font-black tracking-tight text-slate-900 dark:text-white leading-tight break-words">
                                    {commission.name}
                                </h1>
                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                    {commission.order_number && (
                                        <span 
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                const success = await copyTextToClipboard(commission.order_number);
                                                if (success) {
                                                    toast.success("Auftragsnummer kopiert");
                                                } else {
                                                    toast.error("Kopieren fehlgeschlagen");
                                                }
                                            }}
                                            className="group cursor-pointer inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-primary/10 dark:bg-slate-800 dark:hover:bg-primary/20 text-[10px] font-bold font-mono text-slate-700 dark:text-slate-300 hover:text-primary border border-slate-200 hover:border-primary/30 dark:border-slate-700 transition-all duration-200"
                                            title="Auftragsnummer kopieren"
                                        >
                                            <FileText size={10} className="opacity-70 group-hover:text-primary" />
                                            {commission.order_number}
                                        </span>
                                    )}
                                    <StatusBadge status={translateStatus(commission.status)} />
                                    <span className="text-[10px] md:text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1 shrink-0">
                                        {pickedItems.length}/{items.length} gepickt
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Mobile Actions Menu (Top Right - replacing Close Button) */}
                    <div className="md:hidden relative shrink-0">
                        <button
                            onClick={() => setShowMobileMenu(!showMobileMenu)}
                            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-750 dark:text-slate-400 dark:hover:text-slate-200 transition-all duration-200 focus:outline-none cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 flex items-center justify-center shrink-0 min-w-[32px] min-h-[32px]"
                            title="Aktionen"
                            aria-label="Aktionen"
                        >
                            <MoreVertical size={18} />
                        </button>
                        <AnimatePresence>
                            {showMobileMenu && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-30" 
                                        onClick={() => setShowMobileMenu(false)}
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                        className="absolute right-0 mt-2 w-44 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 z-40 overflow-hidden"
                                    >
                                        <button
                                            onClick={(e) => { setShowMobileMenu(false); onEdit(e); }}
                                            className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-750/50 text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-colors cursor-pointer border-none"
                                        >
                                            <Edit2 size={15} /> Bearbeiten
                                        </button>
                                        <button
                                            onClick={() => { setShowMobileMenu(false); onPrint(); }}
                                            className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-750/50 text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-colors cursor-pointer border-none"
                                        >
                                            <Printer size={15} /> Drucken
                                        </button>
                                        {onRequestCancellation && !commission.status.startsWith('Return') && commission.status !== 'Withdrawn' && (
                                            <button
                                                onClick={() => { setShowMobileMenu(false); setShowStornoModal(true); }}
                                                className="w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 flex items-center gap-2 transition-colors cursor-pointer border-none"
                                            >
                                                <Undo2 size={15} /> Storno
                                            </button>
                                        )}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
                
                {/* Actions container (Desktop: inline. Mobile: block below title with top border) */}
                <div className={cn(
                    "flex items-center justify-between gap-2.5 w-full shrink-0 border-t border-slate-100 dark:border-slate-850 pt-2.5 mt-0.5 animate-fade-in"
                )}>
                    {/* Header Primary Action Button */}
                    <div className="flex-1 flex justify-start w-full">
                        {headerPrimaryAction}
                    </div>

                    {/* Desktop actions (hidden on mobile) */}
                    <div className="hidden md:flex items-center gap-2 shrink-0">
                        <Button 
                            variant="secondary" 
                            onClick={(e) => onEdit(e)} 
                            icon={<Edit2 size={16} />} 
                            className="p-2.5 h-10 w-10 flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm border-slate-200 dark:border-slate-700 hover:border-primary/50 text-slate-700 dark:text-slate-200" 
                            title="Bearbeiten"
                            aria-label="Bearbeiten"
                        />
                        <Button 
                            variant="secondary" 
                            onClick={onPrint} 
                            icon={<Printer size={16} />} 
                            className="p-2.5 h-10 w-10 flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm border-slate-200 dark:border-slate-700 hover:border-primary/50 text-slate-700 dark:text-slate-200" 
                            title="Drucken"
                            aria-label="Drucken"
                        />
                        {onRequestCancellation && !commission.status.startsWith('Return') && commission.status !== 'Withdrawn' && (
                            <Button 
                                variant="secondary" 
                                onClick={() => setShowStornoModal(true)} 
                                icon={<Undo2 size={16} />} 
                                className="p-2.5 h-10 w-10 flex items-center justify-center bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/45 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 shadow-sm font-semibold"
                                title="Storno"
                                aria-label="Storno"
                            />
                        )}
                    </div>
                </div>

                {/* Thin Segmented Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 flex gap-0.5 z-30">
                    {[0, 1, 2, 3].map((stepIdx) => {
                        const isCompleted = stepIdx < activeStep;
                        const isActive = stepIdx === activeStep;
                        return (
                            <div 
                                key={stepIdx}
                                className={cn(
                                    "flex-1 h-full transition-all duration-500",
                                    isCompleted ? "bg-primary" :
                                    isActive ? "bg-primary animate-pulse" :
                                    "bg-slate-100 dark:bg-slate-800"
                                )}
                            />
                        );
                    })}
                </div>
            </div>

            {/* CONTENT CONTAINER */}
            <div className="p-3 md:p-8">
                
                {/* BEREITSTELLUNGSORTE WIDGET */}
                {renderStagingLocationsWidget()}
                


                {/* ALERTS */}
                <div className="space-y-3 mb-8">
                    {commission.warehouse_notes && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-sm flex items-start gap-4">
                            <div className="bg-amber-100 dark:bg-amber-500/20 p-2 rounded-xl shrink-0 text-amber-600 dark:text-amber-400">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h4 className="text-amber-800 dark:text-amber-300 font-bold text-sm uppercase tracking-wider mb-1">Lagerhinweis</h4>
                                <p className="text-amber-900 dark:text-amber-100 text-sm leading-relaxed whitespace-pre-wrap">{commission.warehouse_notes}</p>
                            </div>
                        </motion.div>
                    )}
                    {commission.notes && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-2xl p-4 sm:p-5 shadow-sm flex items-start gap-4">
                            <div className="bg-blue-100 dark:bg-blue-500/20 p-2 rounded-xl shrink-0 dark:text-blue-400 text-blue-800 dark:text-blue-400">
                                <FileText size={24} />
                            </div>
                            <div>
                                <h4 className="text-blue-800 dark:text-blue-300 font-bold text-sm uppercase tracking-wider mb-1">Allgemeine Notiz</h4>
                                <p className="text-blue-900 dark:text-blue-100 text-sm leading-relaxed whitespace-pre-wrap">{commission.notes}</p>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* MAIN CONTAINER */}
                <div className="flex flex-col gap-6">
                    
                    {/* ITEMS CONTROLS BAR */}
                    {renderItemsControlBar()}

                    {/* ITEMS LIST */}
                    <div className="flex flex-col gap-6">
                        {/* To Pick */}
                        {openItems.length > 0 && (
                            <div className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-2xl md:rounded-3xl overflow-hidden shadow-sm">
                                <div className="bg-slate-50 dark:bg-slate-900/50 px-4 md:px-6 py-3 md:py-4 border-b border-slate-200 dark:border-border flex justify-between items-center">
                                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                        <Package size={18} className="text-primary" /> 
                                        NOCH OFFEN
                                    </h3>
                                    <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold px-3 py-1 rounded-full shadow-inner">{openItems.length}</span>
                                </div>
                                <div className="p-4 sm:p-6 space-y-4 bg-slate-50/30 dark:bg-transparent">
                                    <AnimatePresence>
                                        {openItems.map(renderItemCard)}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}

                        {/* Picked */}
                        {!hidePicked && (
                            <div className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-2xl md:rounded-3xl overflow-hidden shadow-sm">
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 md:px-6 py-3 md:py-4 border-b border-emerald-100 dark:border-emerald-900/50 flex justify-between items-center">
                                    <h3 className="text-sm font-black text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                                        <CheckCircle2 size={18} /> 
                                        GEPICKT
                                    </h3>
                                    <span className="bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-100 text-xs font-bold px-3 py-1 rounded-full shadow-inner">{pickedItems.length}</span>
                                </div>
                                <div className="p-4 sm:p-6 space-y-4 bg-emerald-50/30 dark:bg-transparent">
                                    {pickedItems.length === 0 && (
                                        <div className="text-center py-12 opacity-50">
                                            <Package size={32} className="mx-auto mb-3 text-slate-400" />
                                            <p className="text-slate-500 dark:text-slate-400 font-medium">Noch nichts gepickt.</p>
                                        </div>
                                    )}
                                    <AnimatePresence>
                                        {pickedItems.map(renderItemCard)}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* OFFICE BENTO */}
                    {onSaveOfficeData && (
                        <div className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm">
                            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-6">
                                <FileText size={18} className="text-blue-500" /> 
                                BÜRO & VERWALTUNG
                            </h3>

                            <div
                                className={cn(
                                    "p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-4 mb-6 shadow-sm hover:shadow-md",
                                    isProcessed 
                                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500" 
                                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-emerald-500/50"
                                )}
                                onClick={() => setIsProcessed(!isProcessed)}
                            >
                                <div className={cn(
                                    "w-8 h-8 rounded-xl border-2 flex items-center justify-center shrink-0 transition-colors shadow-inner",
                                    isProcessed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-transparent"
                                )}>
                                    <Check size={18} strokeWidth={3} />
                                </div>
                                <div>
                                    <div className={cn("font-bold text-base", isProcessed ? "text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300")}>Abgeschlossen</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Vom Büro geprüft & verbucht</div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Interne Notizen</label>
                                <textarea
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all min-h-[120px] resize-none shadow-inner"
                                    placeholder="Wichtige Hinweise für die Buchhaltung..."
                                    value={officeNotes}
                                    onChange={e => setOfficeNotes(e.target.value)}
                                />
                                <div className="flex flex-wrap gap-2">
                                    {['Kunde informiert', 'Großhändler', 'Erledigt'].map(tag => (
                                        <button key={tag} onClick={() => setOfficeNotes(prev => (prev ? prev + '\n' : '') + tag)} className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm cursor-pointer">
                                            + {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                                <Button onClick={handleSaveOffice} disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-foreground dark:text-slate-900 text-sm h-12 shadow-lg rounded-xl font-bold border-none transition-transform active:scale-95 cursor-pointer">
                                    Speichern
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* HISTORY BENTO */}
                    <div className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm flex flex-col min-h-[300px]">
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-6">
                            <History size={18} className="text-slate-400" /> 
                            VERLAUF
                        </h3>

                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5 flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 max-h-[400px] custom-scrollbar">
                            {localHistoryLogs.length === 0 ? (
                                <div className="text-center text-sm text-slate-500 italic py-8">Noch keine Einträge.</div>
                            ) : (
                                <div className="space-y-6">
                                    {localHistoryLogs.map((log) => {
                                        const { bg, icon } = getEventIconAndColor(log.event_type);
                                        return (
                                            <div key={log.id} className="flex gap-4 relative before:absolute before:left-[11px] before:top-8 before:bottom-[-1.5rem] before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800 last:before:hidden">
                                                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 shadow-sm border border-white dark:border-slate-900", bg)}>
                                                    {icon}
                                                </div>
                                                <div className="flex-1 pb-2">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{log.profiles?.full_name?.split(' ')[0] || 'System'}</span>
                                                        <span className="text-xs text-slate-500 font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 shadow-sm">
                                                            {new Date(log.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed font-medium">{log.details}</div>
                                                    <div className="text-[10px] text-slate-400 mt-1 font-semibold uppercase tracking-wider">
                                                        {new Date(log.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ITEM NOTE EDIT MODAL */}
            <GlassModal isOpen={!!editingItemNote} onClose={() => setEditingItemNote(null)} className="max-w-sm">
                <div className="p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-6 text-amber-500">
                        <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-2xl shadow-inner border border-amber-100 dark:border-amber-500/20"><MessageSquare size={24} /></div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white">Positions-Notiz</h3>
                    </div>
                    <textarea
                        className="w-full h-32 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none shadow-inner text-sm font-medium"
                        placeholder="Notiz eingeben..."
                        defaultValue={editingItemNote?.note}
                        id="commission-item-note-input-content"
                    />
                    <div className="flex justify-end gap-3 mt-6">
                        <Button variant="secondary" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer" onClick={() => setEditingItemNote(null)}>Abbrechen</Button>
                        <Button onClick={() => {
                            const val = (document.getElementById('commission-item-note-input-content') as HTMLTextAreaElement).value;
                            if (editingItemNote) {
                                onSaveNote(editingItemNote.itemId, val);
                                setEditingItemNote(null);
                            }
                        }} className="shadow-lg font-bold border-none cursor-pointer">Speichern</Button>
                    </div>
                </div>
            </GlassModal>

            {/* STORNO MODAL */}
            <GlassModal isOpen={showStornoModal} onClose={() => setShowStornoModal(false)} className="max-w-md">
                <div className="p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-6 text-rose-500">
                        <div className="p-3 bg-rose-50 dark:bg-rose-500/10 rounded-2xl shadow-inner border border-rose-100 dark:border-rose-500/20"><Undo2 size={24} /></div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white">Stornieren</h3>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 font-medium">Wie sollen die Artikel dieser Kommission behandelt werden?</p>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <button onClick={() => setStornoType('restock')} className={cn("p-5 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all cursor-pointer", stornoType === 'restock' ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-500 text-rose-600 shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-rose-300')}>
                            <PackageX size={28} />
                            <span className="text-xs font-bold uppercase tracking-wider">Einlagern</span>
                        </button>
                        <button onClick={() => setStornoType('return_supplier')} className={cn("p-5 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all cursor-pointer", stornoType === 'return_supplier' ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-500 dark:text-purple-400 text-purple-800 shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-purple-300')}>
                            <Truck size={28} />
                            <span className="text-xs font-bold uppercase tracking-wider">Lieferant</span>
                        </button>
                    </div>
                    <div className="mb-8">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Grund (Optional)</label>
                        <textarea value={stornoNote} onChange={(e) => setStornoNote(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 outline-none resize-none shadow-inner" placeholder="Grund für Storno..." />
                    </div>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setShowStornoModal(false)} className="flex-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 h-12 font-bold hover:bg-slate-50 cursor-pointer">Abbrechen</Button>
                        <Button onClick={() => { if (onRequestCancellation && commission) { onRequestCancellation(commission.id, stornoType, stornoNote); setShowStornoModal(false); } }} className="flex-1 bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-500/20 text-white h-12 font-bold border-none cursor-pointer">Ausführen</Button>
                    </div>
                </div>
            </GlassModal>

            {/* FAB Scanner Button */}
            {onStartScan && (
                <div className="md:hidden fixed bottom-6 right-6 z-50">
                    <button onClick={onStartScan} className="w-16 h-16 bg-slate-900 dark:bg-primary hover:bg-slate-800 dark:hover:bg-primary/90 text-white rounded-full shadow-2xl flex items-center justify-center transition-transform active:scale-95 border-4 border-white dark:border-slate-800 cursor-pointer">
                        <ScanLine size={24} />
                    </button>
                </div>
            )}
        </div>
    );
};