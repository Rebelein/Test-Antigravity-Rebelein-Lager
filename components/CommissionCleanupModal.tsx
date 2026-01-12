import React, { useState, useEffect, useRef } from 'react';
import { GlassModal, Button, StatusBadge } from '../components/UIComponents';
import { supabase } from '../supabaseClient';
import { Commission } from '../types';
import { ScanLine, X, Loader2, CheckCircle2, AlertTriangle, ArrowRight, Trash2, RotateCcw, Search, BoxSelect } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { toast } from 'sonner';

// --- INTERFACES ---
interface CommissionCleanupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCleanupComplete?: () => void;
}

// Native BarcodeDetector Interface
interface BarcodeDetector {
    detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>;
}
interface DetectedBarcode {
    rawValue: string;
    format: string;
    boundingBox: DOMRectReadOnly;
}
declare global {
    var BarcodeDetector: {
        new(options?: { formats: string[] }): BarcodeDetector;
        getSupportedFormats(): Promise<string[]>;
    };
}

export const CommissionCleanupModal: React.FC<CommissionCleanupModalProps> = ({ isOpen, onClose, onCleanupComplete }) => {
    // --- STATE ---
    const [step, setStep] = useState<'scan' | 'review'>('scan');
    const [loading, setLoading] = useState(false);

    console.log("CommissionCleanupModal Rendered. isOpen:", isOpen);

    // Data
    const [expectedCommissions, setExpectedCommissions] = useState<Commission[]>([]);
    const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
    const [scannedCommissions, setScannedCommissions] = useState<Commission[]>([]); // Those we found matched

    // Scanner
    const [useNative, setUseNative] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastScannedDebug, setLastScannedDebug] = useState<string | null>(null); // Debug info
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scannerLoopRef = useRef<number | null>(null);
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const isMounted = useRef(true);

    // Initial Load
    useEffect(() => {
        if (isOpen) {
            setStep('scan');
            setScannedIds(new Set());
            setScannedCommissions([]);
            fetchExpectedCommissions();
            isMounted.current = true;
            // Delay scanner init slightly for DOM
            setTimeout(initScanner, 100);
        } else {
            stopScanner();
        }
        return () => { isMounted.current = false; stopScanner(); };
    }, [isOpen]);

    const fetchExpectedCommissions = async () => {
        setLoading(true);
        try {
            // Fetch ALL active commissions that SHOULD be on the shelf
            // Status: Ready OR ReturnReady
            const { data, error } = await supabase
                .from('commissions')
                .select('*')
                .in('status', ['Ready', 'ReturnReady'])
                .is('deleted_at', null);

            if (error) throw error;
            setExpectedCommissions(data || []);
        } catch (err) {
            console.error("Failed to fetch expected commissions", err);
            toast.error("Laden der Kommissionen fehlgeschlagen");
        } finally {
            setLoading(false);
        }
    };

    // --- SCANNER LOGIC duplicated/adapted from Stocktaking ---
    const initScanner = async () => {
        if ('BarcodeDetector' in window) {
            setUseNative(true);
            startNativeScanner();
        } else {
            setUseNative(false);
            setTimeout(startFallbackScanner, 100);
        }
    };

    const startNativeScanner = async () => {
        if (!isMounted.current) return;
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: "environment" }, focusMode: 'continuous' } as any
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            const formats = ['qr_code'];
            const detector = new window.BarcodeDetector({ formats });

            const scanLoop = async () => {
                if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
                try {
                    const barcodes = await detector.detect(videoRef.current);
                    if (barcodes.length > 0) handleScan(barcodes[0].rawValue);
                } catch (e) { }
                if (isMounted.current && step === 'scan') {
                    scannerLoopRef.current = requestAnimationFrame(scanLoop);
                }
            };
            scanLoop();
        } catch (err) {
            console.error(err);
            setUseNative(false);
            startFallbackScanner();
        }
    };

    const startFallbackScanner = async () => {
        if (!document.getElementById('cleanup-reader')) return;
        if (html5QrCodeRef.current?.isScanning) return;
        try {
            const scanner = new Html5Qrcode("cleanup-reader", { experimentalFeatures: { useBarCodeDetectorIfSupported: false }, verbose: false });
            html5QrCodeRef.current = scanner;
            await scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
                (decodedText) => handleScan(decodedText),
                undefined
            );
        } catch (err) {
            console.error(err);
            setError("Kamera-Fehler");
        }
    };

    const stopScanner = async () => {
        if (scannerLoopRef.current) cancelAnimationFrame(scannerLoopRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
            try { await html5QrCodeRef.current.stop(); html5QrCodeRef.current.clear(); } catch (e) { }
        }
    };

    const handleScan = (raw: string) => {
        // Normalize: valid formats: "COMM:UUID", "COMM: UUID", "UUID"
        setLastScannedDebug(raw); // Show raw input for debug
        let id = raw.trim();

        // Check prefix case-insensitively
        if (id.toUpperCase().startsWith('COMM:')) {
            id = id.substring(5).trim();
        }

        // Remove any potentially weird chars if necessary, but UUIDs are hex + dash

        // Check for match case-insensitive
        const match = expectedCommissions.find(c => c.id.toLowerCase() === id.toLowerCase());
        const matchedId = match ? match.id : id; // Use the canonical DB ID if matched

        setScannedIds(prev => {
            if (prev.has(matchedId)) return prev; // Already scanned

            // New scan!
            const newSet = new Set(prev);
            newSet.add(matchedId);

            if (match) {
                toast.success(`Gefunden: ${match.name}`);
            } else {
                // If no direct ID match, try searching by order number?
                // Often QR is just ID.
                toast(`Gescannt: ...${matchedId.slice(-4)} (Nicht in Liste)`, {
                    icon: <ScanLine size={14} />,
                    description: "Status prüfen?"
                });
            }

            if (navigator.vibrate) navigator.vibrate(50);
            return newSet;
        });
    };

    // --- FINISH & REVIEW ---
    const handleFinishScan = () => {
        stopScanner();
        setStep('review');
    };

    const handleCleanup = async (idsToCleanup: string[], keepOpen = false) => {
        if (idsToCleanup.length === 0) return;
        if (!keepOpen && !confirm(`${idsToCleanup.length} Kommissionen als 'Vermisst' markieren?`)) return;

        setLoading(true);
        try {
            const now = new Date().toISOString();

            // Update DB
            const { error } = await supabase
                .from('commissions')
                .update({
                    status: 'Missing',
                    // withdrawn_at: now // Do not set withdrawn_at for missing items
                })
                .in('id', idsToCleanup);

            if (error) throw error;

            // Log Events
            const logEntries = expectedCommissions
                .filter(c => idsToCleanup.includes(c.id))
                .map(c => ({
                    commission_id: c.id,
                    commission_name: c.name,
                    user_id: (supabase.auth.getUser() as any)?.id,
                    action: 'status_change',
                    details: 'Automatisch auf "Vermisst" gesetzt durch Aufräum-Scan'
                }));

            // We need user ID for logs.
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const logs = logEntries.map(l => ({ ...l, user_id: user.id }));
                await supabase.from('commission_events').insert(logs);
            }

            toast.success("Aufräumen erfolgreich!");
            if (onCleanupComplete) onCleanupComplete();

            // Remove from expected list locally if keeping open
            if (keepOpen) {
                setExpectedCommissions(prev => prev.filter(c => !idsToCleanup.includes(c.id)));
            } else {
                onClose();
            }

        } catch (err: any) {
            toast.error("Fehler: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- RENDER HELPERS ---

    // MISSING: Expected but NOT scanned
    const missingCommissions = expectedCommissions.filter(c => !scannedIds.has(c.id));

    // FOUND: Expected AND scanned
    const foundCommissions = expectedCommissions.filter(c => scannedIds.has(c.id));

    // UNEXPECTED: Scanned but NOT in expected list (maybe already Withdrawn or Draft?)
    // This requires fetching details for IDs that are not in expectedCommissions. 
    // For MVP, we ignore them or just show count.
    const unexpectedCount = scannedIds.size - foundCommissions.length;

    return (
        <GlassModal isOpen={isOpen} onClose={onClose} className="w-[95vw] max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">

            {/* HEADER */}
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                <div className="flex items-center gap-2">
                    <BoxSelect size={20} className="text-emerald-400" />
                    <h2 className="text-lg font-bold text-white">Regal aufräumen</h2>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white"><X size={20} /></button>
            </div>

            {/* CONTENT */}
            <div className="flex-1 bg-gray-900 relative overflow-hidden flex flex-col">

                {step === 'scan' && (
                    <>
                        <div className="flex-1 relative bg-black">
                            {useNative && <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />}
                            {!useNative && <div id="cleanup-reader" className="w-full h-full object-cover" />}

                            {/* Overlay */}
                            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                                {/* Semi-transparent darkened frame around the scan box */}
                                <div className="absolute inset-0 bg-black/40 mask-scan-area"></div>

                                <div className="z-10 w-72 h-72 md:w-96 md:h-64 border-2 border-emerald-500/50 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 shadow-[0_0_15px_#10b981] animate-[scan_2s_infinite_linear]" />
                                    {/* Corner markers for better visibility */}
                                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 -mt-1 -ml-1 rounded-tl-lg"></div>
                                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 -mt-1 -mr-1 rounded-tr-lg"></div>
                                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 -mb-1 -ml-1 rounded-bl-lg"></div>
                                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 -mb-1 -mr-1 rounded-br-lg"></div>
                                </div>
                                <div className="z-10 mt-4 text-white/80 font-medium bg-black/50 px-4 py-1 rounded-full backdrop-blur-sm">
                                    QR-Code im Rahmen platzieren
                                </div>
                            </div>

                            {/* Stats Overlay */}
                            <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none">
                                <div className="bg-black/60 backdrop-blur px-3 py-1.5 rounded-lg text-white border border-white/10">
                                    <div className="text-xs text-white/50">Erwartet</div>
                                    <div className="font-bold text-lg">{expectedCommissions.length}</div>
                                </div>
                                <div className="bg-black/60 backdrop-blur px-3 py-1.5 rounded-lg text-white border border-white/10">
                                    <div className="text-xs text-white/50">Gefunden</div>
                                    <div className="font-bold text-lg text-emerald-400">{foundCommissions.length}</div>
                                </div>
                            </div>

                            {/* Debug Info */}
                            {lastScannedDebug && (
                                <div className="absolute bottom-20 left-0 right-0 text-center pointer-events-none">
                                    <span className="bg-black/50 text-white/50 text-xs px-2 py-1 rounded backdrop-blur">
                                        Letzter Scan: {lastScannedDebug}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Scan Footer */}
                        <div className="p-4 bg-gray-800 border-t border-white/10 space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                                <input
                                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    placeholder="Manuelle ID Eingabe (COMM:...)"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const val = (e.target as HTMLInputElement).value;
                                            if (val) { handleScan(val); (e.target as HTMLInputElement).value = ''; }
                                        }
                                    }}
                                />
                            </div>
                            <Button onClick={handleFinishScan} className="w-full bg-emerald-600 hover:bg-emerald-500 py-4 text-lg">
                                Scannen beenden & Auswerten
                            </Button>
                        </div>
                    </>
                )}

                {step === 'review' && (
                    <div className="flex-1 flex flex-col overflow-hidden bg-gray-900">
                        <div className="p-4 bg-gray-800/50 border-b border-white/5">
                            <h3 className="text-white font-bold mb-1">Auswertung</h3>
                            <p className="text-sm text-white/60">
                                {foundCommissions.length} von {expectedCommissions.length} Kommissionen gefunden.
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6">

                            {/* SECTION: FOUND */}
                            {foundCommissions.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <CheckCircle2 size={16} className="text-emerald-500" />
                                        <h4 className="text-emerald-400 font-bold uppercase text-xs tracking-wider">Im Regal ({foundCommissions.length})</h4>
                                    </div>
                                    <div className="space-y-2 opacity-60">
                                        {foundCommissions.map(c => (
                                            <div key={c.id} className="p-3 bg-white/5 rounded-lg border border-white/5 flex justify-between items-center">
                                                <span className="text-white text-sm">{c.name}</span>
                                                <StatusBadge status={c.status} size="sm" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* SECTION: MISSING */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertTriangle size={16} className="text-rose-500" />
                                    <h4 className="text-rose-400 font-bold uppercase text-xs tracking-wider">Vermisst - Nicht gescannt ({missingCommissions.length})</h4>
                                </div>
                                {missingCommissions.length === 0 ? (
                                    <div className="text-white/30 text-sm italic">Alles vollständig! 👍</div>
                                ) : (
                                    <div className="space-y-2">
                                        {missingCommissions.map(c => (
                                            <div key={c.id} className="p-3 bg-rose-500/10 rounded-lg border border-rose-500/20 flex justify-between items-center">
                                                <div>
                                                    <div className="text-white font-medium">{c.name}</div>
                                                    <div className="text-xs text-rose-300 mt-0.5">Sollte da sein: {c.order_number || 'Ohne Nr'}</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <StatusBadge status={c.status} size="sm" />
                                                    <button
                                                        onClick={() => handleCleanup([c.id], true)}
                                                        className="p-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition-colors border border-rose-500/30"
                                                        title="Als Vermisst markieren"
                                                    >
                                                        <AlertTriangle size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {unexpectedCount > 0 && (
                                <div className="text-xs text-white/30 italic mt-4 text-center">
                                    + {unexpectedCount} unbekannte/irrelevante Codes gescannt.
                                </div>
                            )}

                        </div>

                        <div className="p-4 border-t border-white/10 bg-gray-800 flex flex-col gap-3">
                            <Button
                                onClick={() => handleCleanup(missingCommissions.map(c => c.id), false)}
                                disabled={missingCommissions.length === 0 || loading}
                                className="w-full bg-rose-600 hover:bg-rose-500 py-3"
                                icon={loading ? <Loader2 className="animate-spin" /> : <AlertTriangle size={18} />}
                            >
                                {missingCommissions.length} als Vermisst markieren
                            </Button>
                            <Button variant="secondary" onClick={() => setStep('scan')} className="w-full">
                                <RotateCcw size={16} className="mr-2" /> Scan fortsetzen
                            </Button>
                        </div>
                    </div>
                )}

            </div>
        </GlassModal>
    );
};
