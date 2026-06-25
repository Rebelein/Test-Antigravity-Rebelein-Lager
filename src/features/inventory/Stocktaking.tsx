import React, { useState, useRef } from 'react';
import { GlassCard, Button } from '../../components/UIComponents';
import { supabase } from '../../../supabaseClient';
import { ScanLine, X, Loader2, AlertTriangle, Search, ArrowRight, CheckCircle2, Plus, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import UnifiedScanner from '../../components/UnifiedScanner';
import { motion, AnimatePresence } from 'framer-motion';

const Stocktaking: React.FC = () => {
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);

    // Scanner State
    const [scannerProcessing, setScannerProcessing] = useState(false);

    // Quick Booking State
    const [bookingAmount, setBookingAmount] = useState(0);
    const [isBooking, setIsBooking] = useState(false);

    // Result State
    const [scannedResult, setScannedResult] = useState<{
        type: 'article' | 'location' | 'unknown';
        data: any;
        raw: string;
    } | null>(null);

    const isMounted = useRef(true);

    const handleScanSuccess = async (decodedText: string) => {
        if (scannerProcessing) return;
        if (scannedResult && scannedResult.raw === decodedText) return; // Simple dup check

        console.log("Scanned:", decodedText);
        setScannerProcessing(true);
        setBookingAmount(0); // Reset booking amount on new scan

        // --- LOGIC (Shared) ---
        if (decodedText.startsWith('COMM:')) {
            const commId = decodedText.substring(5).trim();
            navigate(`/commissions?openId=${commId}`);
            return;
        }
        if (decodedText.startsWith('MACH:')) {
            const machId = decodedText.substring(5).trim();
            navigate('/machines', { state: { openMachineId: machId } });
            return;
        }
        if (decodedText.startsWith('LOC:')) {
            const rawLoc = decodedText.substring(4).trim();
            let cat = '';
            let loc = rawLoc;
            if (rawLoc.includes('::')) [cat, loc] = rawLoc.split('::');
            navigate('/inventory', { state: { filterLocation: loc, filterCategory: cat } });
            return;
        }

        // --- NEW: SMART COMMISSION CHECK ---
        try {
            const { data: commissions } = await supabase
                .from('commissions')
                .select('id, order_number, supplier_order_number')
                .not('status', 'in', '("Withdrawn","ReturnComplete")');

            if (commissions) {
                const matchedCommission = commissions.find(c => {
                    if (c.order_number && c.order_number.length > 4 && decodedText.includes(c.order_number)) return true;
                    if (c.supplier_order_number && c.supplier_order_number.length > 4 && decodedText.includes(c.supplier_order_number)) return true;
                    return false;
                });

                if (matchedCommission) {
                    toast.success("Kommission erkannt!");
                    navigate(`/commissions?openId=${matchedCommission.id}`);
                    return;
                }
            }
        } catch (e) {
            console.warn("Smart Scan Check failed", e);
        }

        // Article Lookup
        try {
            const { data } = await supabase.from('articles').select('*')
                .or(`id.eq.${decodedText},ean.eq.${decodedText},sku.eq.${decodedText},supplier_sku.eq.${decodedText}`)
                .limit(1);

            if (data && data.length > 0) {
                setScannedResult({ type: 'article', data: data[0], raw: decodedText });
                if (navigator.vibrate) navigator.vibrate(200);
            } else {
                setError(`Kein Artikel: ${decodedText}`);
                setTimeout(() => { setError(null); setScannerProcessing(false); }, 2000);
            }
        } catch (err) {
            setError("Fehler beim Scannen.");
            setScannerProcessing(false);
        }
    };

    const handleCloseResult = () => {
        setScannedResult(null);
        setScannerProcessing(false);
        setBookingAmount(0);
    };

    const handleGoToArticle = () => {
        if (scannedResult?.type === 'article') {
            navigate('/inventory', { state: { openArticleId: scannedResult.data.id } });
        }
    };

    const handleQuickBook = async () => {
        if (!scannedResult || scannedResult.type !== 'article' || bookingAmount === 0 || isBooking) return;

        setIsBooking(true);
        const article = scannedResult.data;
        const newStock = article.stock + bookingAmount;

        try {
            const { error } = await supabase
                .from('articles')
                .update({ stock: newStock })
                .eq('id', article.id);

            if (error) throw error;

            toast.success(`Bestand ${bookingAmount > 0 ? 'erhöht +' + bookingAmount : 'verringert ' + bookingAmount}`, {
                style: { background: bookingAmount > 0 ? '#10b981' : '#f43f5e', color: 'white', border: 'none' }
            });

            setScannedResult(prev => prev ? {
                ...prev,
                data: { ...prev.data, stock: newStock }
            } : null);

            setBookingAmount(0);
        } catch (err) {
            console.error(err);
            toast.error("Buchung fehlgeschlagen");
        } finally {
            setIsBooking(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[170] bg-black/45 dark:bg-black/60 backdrop-blur-md flex items-end justify-center">
            <Toaster position="top-center" />

            {/* Backdrop click-to-close */}
            <div className="absolute inset-0 z-10" onClick={() => navigate(-1)} />

            {/* SLIDE-UP DRAWER PANEL */}
            <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 280, mass: 0.9 }}
                className="relative z-20 w-full max-w-lg h-[82vh] bg-white dark:bg-[#090e17] border-t border-slate-200 dark:border-white/10 rounded-t-[2.5rem] shadow-[0_-8px_32px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
            >
                {/* Drag Handle representation */}
                <div className="w-12 h-1.5 bg-slate-300 dark:bg-white/20 rounded-full mx-auto my-3.5 shrink-0" />

                {/* Header inside Panel */}
                <div className="px-6 pb-3 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2 dark:text-emerald-400 text-emerald-800">
                        <ScanLine size={20} className="shrink-0" />
                        <h1 className="text-lg font-bold text-slate-800 dark:text-white">Hauptscanner</h1>
                    </div>
                    <button 
                        onClick={() => navigate(-1)} 
                        className="p-1.5 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-500 dark:text-white transition-all cursor-pointer border-none flex items-center justify-center"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Scanner Viewport or Result Box */}
                <div className="flex-1 relative overflow-hidden bg-black">
                    {/* CAMERA STAGE */}
                    {!scannedResult && (
                        <UnifiedScanner
                            onScan={handleScanSuccess}
                            onError={setError}
                            className="absolute inset-0 w-full h-full"
                        />
                    )}

                    {/* Scanner Error */}
                    {error && (
                        <div className="absolute bottom-4 left-4 right-4 p-4 bg-red-500/90 backdrop-blur-sm text-white rounded-xl border border-red-400/50 flex items-center gap-3 animate-in slide-in-from-bottom-5 z-30">
                            <AlertTriangle size={24} className="shrink-0" />
                            <span className="text-sm font-medium">{error}</span>
                        </div>
                    )}

                    {/* RESULT CARD - Rendered inside the panel */}
                    {scannedResult && scannedResult.type === 'article' && (
                        <div className="absolute inset-0 z-40 bg-white dark:bg-[#090e17] p-6 overflow-y-auto flex flex-col justify-between">
                            <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
                                {/* Title / Close Row */}
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-2 dark:text-emerald-400 text-emerald-800">
                                        <CheckCircle2 size={24} />
                                        <span className="font-bold text-lg">Artikel gefunden</span>
                                    </div>
                                    <button onClick={handleCloseResult} className="text-muted-foreground hover:text-foreground"><X size={24} /></button>
                                </div>

                                {/* Article Info Card */}
                                <div className="flex gap-4 mb-6 bg-slate-50 dark:bg-slate-900/40 p-4 border border-slate-100 dark:border-white/5 rounded-2xl">
                                    <div className="w-20 h-20 bg-muted rounded-xl overflow-hidden shrink-0 border border-border">
                                        <img src={scannedResult.data.image_url || `https://picsum.photos/seed/${scannedResult.data.id}/200`} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-foreground text-base line-clamp-2 break-words">{scannedResult.data.name}</h3>
                                        <div className="text-xs text-muted-foreground mt-0.5 font-mono">{scannedResult.data.sku}</div>
                                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                                            <span className="text-[10px] px-2 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">{scannedResult.data.location || 'Kein Ort'}</span>
                                            <span className={`text-sm font-bold ${scannedResult.data.stock < scannedResult.data.target_stock ? 'dark:text-rose-400 text-rose-800' : 'dark:text-emerald-400 text-emerald-800'}`}>
                                                Bestand: {scannedResult.data.stock}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Booking Section */}
                                <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-4 border border-slate-100 dark:border-white/5 mb-6">
                                    <div className="flex items-center justify-between gap-4 mb-4">
                                        <button
                                            onClick={() => setBookingAmount(prev => prev - 1)}
                                            className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-750 text-foreground transition-colors cursor-pointer border-none"
                                        >
                                            <Minus size={20} />
                                        </button>

                                        <div className="flex flex-col items-center">
                                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Menge</span>
                                            <span className={`text-3xl font-black font-mono ${bookingAmount > 0 ? 'dark:text-emerald-400 text-emerald-800' :
                                                bookingAmount < 0 ? 'dark:text-rose-400 text-rose-800' : 'text-foreground'
                                                }`}>
                                                {bookingAmount > 0 ? '+' : ''}{bookingAmount}
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => setBookingAmount(prev => prev + 1)}
                                            className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-750 text-foreground transition-colors cursor-pointer border-none"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>

                                    <Button
                                        onClick={handleQuickBook}
                                        disabled={bookingAmount === 0 || isBooking}
                                        className={`w-full py-4 text-base font-bold shadow-lg transition-all border-none cursor-pointer ${bookingAmount > 0
                                            ? 'bg-primary hover:bg-primary shadow-emerald-950/20 text-white'
                                            : bookingAmount < 0
                                                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/20 text-white'
                                                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                                            }`}
                                    >
                                        {isBooking ? (
                                            <Loader2 className="animate-spin mx-auto" size={20} />
                                        ) : (
                                            bookingAmount === 0 ? 'Menge wählen' :
                                                bookingAmount > 0 ? `Einlagern (+${bookingAmount})` : `Entnehmen (${bookingAmount})`
                                        )}
                                    </Button>
                                </div>
                            </div>

                            <div className="flex gap-3 max-w-md mx-auto w-full pt-4 border-t border-slate-100 dark:border-white/5">
                                <Button variant="secondary" onClick={handleCloseResult} className="flex-1 bg-slate-100 dark:bg-slate-800 border-none cursor-pointer">Scan weiter</Button>
                                <Button onClick={handleGoToArticle} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white border-none cursor-pointer">Details</Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Input Bar */}
                {!scannedResult && (
                    <div className="p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200/50 dark:border-white/5 z-20 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                            <input
                                type="text"
                                placeholder="Code manuell eingeben..."
                                className="w-full bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-white/5 rounded-xl py-3.5 pl-12 pr-12 text-foreground dark:placeholder-white/30 placeholder-muted-foreground/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm font-medium"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleScanSuccess((e.target as HTMLInputElement).value);
                                }}
                            />
                            <button
                                onClick={(e) => handleScanSuccess((e.currentTarget.previousElementSibling as HTMLInputElement).value)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary rounded-lg text-white border-none cursor-pointer flex items-center justify-center min-w-[32px] min-h-[32px]"
                            >
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default Stocktaking;
