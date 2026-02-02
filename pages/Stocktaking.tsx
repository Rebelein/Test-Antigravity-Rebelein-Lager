import React, { useState, useRef } from 'react';
import { GlassCard, Button } from '../components/UIComponents';
import { supabase } from '../supabaseClient';
import { ScanLine, X, Loader2, AlertTriangle, Search, ArrowRight, CheckCircle2, Plus, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import UnifiedScanner from '../components/UnifiedScanner';

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
        <div className="fixed inset-0 z-[170] bg-black flex flex-col">
            <Toaster position="top-center" />

            {/* HEADER */}
            <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex items-center gap-2">
                    <ScanLine className="text-emerald-400" size={24} />
                    <h1 className="text-xl font-bold text-white">Scanner</h1>
                </div>
                <button onClick={() => navigate('/dashboard')} className="p-2 bg-white/10 rounded-full text-white/80 hover:text-white backdrop-blur-md">
                    <X size={24} />
                </button>
            </div>

            {/* SCANNER VIEWPORT */}
            <div className="flex-1 relative overflow-hidden bg-gray-900">
                {/* UNIFIED SCANNER */}
                {!scannedResult && (
                    <UnifiedScanner
                        onScan={handleScanSuccess}
                        onError={setError}
                        className="absolute inset-0 w-full h-full"
                    />
                )}



                {/* Error Toast */}
                {error && (
                    <div className="absolute bottom-40 left-4 right-4 p-4 bg-red-500/90 backdrop-blur-md text-white rounded-xl border border-red-400/50 flex items-center gap-3 animate-in slide-in-from-bottom-5 z-30">
                        <AlertTriangle size={24} className="shrink-0" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                )}
            </div>

            {/* FOOTER / MANUAL INPUT */}
            {!scannedResult && (
                <div className="p-6 bg-black pb-24 z-20">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20} />
                        <input
                            type="text"
                            placeholder="Code manuell eingeben..."
                            className="w-full bg-white/10 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleScanSuccess((e.target as HTMLInputElement).value);
                            }}
                        />
                        <button
                            onClick={(e) => handleScanSuccess((e.currentTarget.previousElementSibling as HTMLInputElement).value)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 rounded-lg text-white"
                        >
                            <ArrowRight size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* RESULT MODAL */}
            {scannedResult && scannedResult.type === 'article' && (
                <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
                    <GlassCard className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 flex flex-col max-h-[90vh]">

                        {/* Title & Close */}
                        <div className="flex justify-between items-start mb-4 shrink-0">
                            <div className="flex items-center gap-2 text-emerald-400">
                                <CheckCircle2 size={24} />
                                <span className="font-bold">Artikel gefunden</span>
                            </div>
                            <button onClick={handleCloseResult} className="text-white/50 hover:text-white"><X size={24} /></button>
                        </div>

                        {/* Article Info */}
                        <div className="flex gap-4 mb-6 shrink-0">
                            <div className="w-20 h-20 bg-white/10 rounded-xl overflow-hidden shrink-0 border border-white/10">
                                <img src={scannedResult.data.image_url || `https://picsum.photos/seed/${scannedResult.data.id}/200`} className="w-full h-full object-cover" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white line-clamp-2">{scannedResult.data.name}</h3>
                                <div className="text-sm text-white/50 mt-1">{scannedResult.data.sku}</div>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-xs px-2 py-0.5 bg-white/10 rounded text-white/70">{scannedResult.data.location || 'Kein Ort'}</span>
                                    <span className={`text-sm font-bold ${scannedResult.data.stock < scannedResult.data.target_stock ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        Bestand: {scannedResult.data.stock}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Booking Section */}
                        <div className="bg-white/5 rounded-xl p-4 mb-4 border border-white/10 shrink-0">
                            <div className="flex items-center justify-between gap-4 mb-4">
                                <button
                                    onClick={() => setBookingAmount(prev => prev - 1)}
                                    className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                                >
                                    <Minus size={24} />
                                </button>

                                <div className="flex flex-col items-center">
                                    <span className="text-xs text-white/50 uppercase tracking-wider font-medium mb-1">Menge</span>
                                    <span className={`text-3xl font-bold font-mono ${bookingAmount > 0 ? 'text-emerald-400' :
                                        bookingAmount < 0 ? 'text-rose-400' : 'text-white'
                                        }`}>
                                        {bookingAmount > 0 ? '+' : ''}{bookingAmount}
                                    </span>
                                </div>

                                <button
                                    onClick={() => setBookingAmount(prev => prev + 1)}
                                    className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                                >
                                    <Plus size={24} />
                                </button>
                            </div>

                            <Button
                                onClick={handleQuickBook}
                                disabled={bookingAmount === 0 || isBooking}
                                className={`w-full py-4 text-lg font-bold shadow-lg transition-all ${bookingAmount > 0
                                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
                                    : bookingAmount < 0
                                        ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20'
                                        : 'bg-white/10 text-white/30 cursor-not-allowed'
                                    }`}
                            >
                                {isBooking ? (
                                    <Loader2 className="animate-spin mx-auto" size={24} />
                                ) : (
                                    bookingAmount === 0 ? 'Menge wählen' :
                                        bookingAmount > 0 ? `Einlagern (+${bookingAmount})` : `Entnehmen (${bookingAmount})`
                                )}
                            </Button>
                        </div>

                        <div className="flex gap-3 shrink-0">
                            <Button variant="secondary" onClick={handleCloseResult} className="flex-1">Scan weiter</Button>
                            <Button onClick={handleGoToArticle} className="flex-1 bg-blue-600/20 text-blue-200 hover:bg-blue-600/30 border border-blue-500/30">Details</Button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};

export default Stocktaking;
