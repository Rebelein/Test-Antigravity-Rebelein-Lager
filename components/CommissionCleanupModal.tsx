import React, { useState, useEffect, useRef } from 'react';
import { GlassModal, Button, StatusBadge } from '../components/UIComponents';
import { supabase } from '../supabaseClient';
import { Commission } from '../types';
import { ScanLine, X, Loader2, CheckCircle2, AlertTriangle, ArrowRight, Trash2, RotateCcw, Search, BoxSelect, Truck } from 'lucide-react';
import { toast } from 'sonner';
import UnifiedScanner from './UnifiedScanner';

// --- INTERFACES ---
interface CommissionCleanupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCleanupComplete?: () => void;
}



const CommissionCleanupModalComponent: React.FC<CommissionCleanupModalProps> = ({ isOpen, onClose, onCleanupComplete }) => {
    // --- STATE ---
    const [step, setStep] = useState<'scan' | 'review'>('scan');
    const [loading, setLoading] = useState(false);



    // Data
    const [expectedCommissions, setExpectedCommissions] = useState<Commission[]>([]);
    const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
    const [scannedCommissions, setScannedCommissions] = useState<Commission[]>([]); // Those we found matched

    // Scanner
    const [lastScannedDebug, setLastScannedDebug] = useState<string | null>(null); // Debug info
    const lastProcessedRef = useRef<{ id: string, time: number } | null>(null);

    // Initial Load
    useEffect(() => {
        if (isOpen) {
            setStep('scan');
            setScannedIds(new Set());
            setScannedCommissions([]);
            fetchExpectedCommissions();
        }
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




    // --- SCANNER LOGIC ---
    const handleScan = async (raw: string) => {
        // Normalize: valid formats: "COMM:UUID", "COMM: UUID", "UUID"
        setLastScannedDebug(raw); // Show raw input for debug
        let id = raw.trim();

        // Check prefix case-insensitively
        if (id.toUpperCase().startsWith('COMM:')) {
            id = id.substring(5).trim();
        }

        const now = Date.now();
        if (lastProcessedRef.current && lastProcessedRef.current.id === id && (now - lastProcessedRef.current.time < 2000)) {
            return; // Ignore same code for 2 seconds to prevent loops
        }
        lastProcessedRef.current = { id, time: now };

        // Check for match case-insensitive
        const match = expectedCommissions.find(c => c.id.toLowerCase() === id.toLowerCase());

        if (match) {
            // MATCH FOUND -> Update DB immediately
            try {
                // Optimistic UI update
                setScannedIds(prev => new Set(prev).add(match.id));

                const { error } = await supabase.from('commissions').update({ last_scanned_at: new Date().toISOString() }).eq('id', match.id);
                if (error) throw error;

                toast.success(`Gefunden: ${match.name}`);
                triggerScanFeedback();
            } catch (err) {
                console.error("Error updating scan time", err);
                toast.error("Fehler beim Speichern");
            }
        } else {
            // NO MATCH in expected list
            toast(`Gescannt: ...${id.slice(-4)} (Nicht in "Vermisst"-Liste)`, {
                icon: <ScanLine size={14} />,
            });
            triggerScanFeedback();
        }
    };

    // ... (rest of scanner logic)

    const triggerScanFeedback = () => {
        // Prevent continuous feedback (Debouncing at caller level usually, but here just robust checks)
        // 1. Vibration (Android)
        if (navigator.vibrate) {
            try { navigator.vibrate(200); } catch (e) { }
        }

        // 2. Audio Beep (iOS & Android)
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) {
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.type = "sine";
                osc.frequency.setValueAtTime(1200, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);

                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.2);
            }
        } catch (e) {
            console.error("Audio feedback failed", e);
        }
    };

    // --- FINISH & REVIEW ---
    const handleFinishScan = () => {
        setStep('review');
    };

    const handleCleanup = async (idsToCleanup: string[], mode: 'withdrawn' | 'missing', keepOpen = false) => {
        if (idsToCleanup.length === 0) return;

        const actionText = mode === 'withdrawn' ? 'als ENTDOMMEN buchen' : 'als VERMISST melden';
        if (!keepOpen && !confirm(`${idsToCleanup.length} Kommissionen ${actionText}?`)) return;

        setLoading(true);
        try {
            const BATCH_SIZE = 20;
            const now = new Date().toISOString();

            for (let i = 0; i < idsToCleanup.length; i += BATCH_SIZE) {
                const batch = idsToCleanup.slice(i, i + BATCH_SIZE);

                if (mode === 'withdrawn') {
                    // "Smart Fix": Mark as Withdrawn (Picked up)
                    const { error } = await supabase
                        .from('commissions')
                        .update({
                            status: 'Withdrawn',
                            withdrawn_at: now,
                            // Ensure it's not deleted
                            deleted_at: null
                        })
                        .in('id', batch);
                    if (error) throw error;
                } else {
                    // "Legacy Fix": Mark as Missing
                    const { error } = await supabase
                        .from('commissions')
                        .update({
                            status: 'Missing',
                            last_scanned_at: null
                        })
                        .in('id', batch);
                    if (error) throw error;
                }
            }

            // Log Events
            const logEntries = expectedCommissions
                .filter(c => idsToCleanup.includes(c.id))
                .map(c => ({
                    commission_id: c.id,
                    commission_name: c.name,
                    user_id: (supabase.auth.getUser() as any)?.id,
                    action: 'status_change',
                    details: mode === 'withdrawn' ? 'Audit: Automatisch auf ENTDOMMEN gesetzt (Nicht im Regal)' : 'Audit: Als VERMISST markiert'
                }));

            // We need user ID for logs.
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const logs = logEntries.map(l => ({ ...l, user_id: user.id }));
                await supabase.from('commission_events').insert(logs);
            }

            toast.success(mode === 'withdrawn' ? "Erfolgreich ausgebucht!" : "Als vermisst markiert.");

            if (onCleanupComplete) onCleanupComplete();
            if (!keepOpen) onClose();
            else {
                // Update local state
                setExpectedCommissions(prev => prev.filter(c => !idsToCleanup.includes(c.id)));
            }
        } catch (err: any) {
            toast.error("Fehler: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    // ...

    // --- RENDER HELPERS ---

    // Logic: Scanned today = Found. Not scanned today = Missing.
    // We base "Scanned" on the `last_scanned_at` timestamp in DB if it exists, PLUS local session scans.
    // Wait, fetchExpectedCommissions loads data once. 
    // We should rely on local `scannedIds` for the session, but also respect `last_scanned_at` if we want to support "Resume scan".
    // For now, let's keep `scannedIds` as the session truth for "Found in this session".
    // BUT the requirement is: "alle kommisionen die nach dem scannen ... keine neuen datums eintrag ... erzeugen sollen in dem vermissten tab ... angezeigt werden"
    // This implies that the modal is just the tool to add the timestamp. The TAB does the display.
    // The Modal review step should just show what was captured NOW.

    const missingCommissions = expectedCommissions.filter(c => !scannedIds.has(c.id));
    const foundCommissions = expectedCommissions.filter(c => scannedIds.has(c.id));
    const unexpectedCount = 0; // Simplified for now

    return (
        <GlassModal isOpen={isOpen} onClose={onClose} className="w-[95vw] max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">

            {/* HEADER */}
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                <div className="flex items-center gap-2">
                    <BoxSelect size={20} className="text-emerald-400" />
                    <h2 className="text-lg font-bold text-white">Bestand prüfen (Audit)</h2>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white"><X size={20} /></button>
            </div>

            {/* CONTENT */}
            <div className="flex-1 bg-gray-900 relative overflow-hidden flex flex-col">

                {step === 'scan' && (
                    <>
                        <div className="flex-1 relative bg-black">
                            <UnifiedScanner
                                onScan={handleScan}
                                className="w-full h-full object-cover"
                            />



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
                                                        onClick={() => handleCleanup([c.id], 'missing', true)}
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
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    onClick={() => handleCleanup(missingCommissions.map(c => c.id), 'missing', false)}
                                    disabled={missingCommissions.length === 0 || loading}
                                    className="col-span-2 bg-rose-600 hover:bg-rose-500 py-4 text-lg shadow-lg shadow-rose-900/20"
                                    icon={loading ? <Loader2 className="animate-spin" /> : <AlertTriangle size={20} />}
                                >
                                    {missingCommissions.length} zur Prüfung vorlegen
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => handleCleanup(missingCommissions.map(c => c.id), 'withdrawn', false)}
                                    disabled={missingCommissions.length === 0 || loading}
                                    className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border-purple-500/20"
                                    icon={<Truck size={16} />}
                                >
                                    Direkt entnehmen
                                </Button>
                                <Button variant="secondary" onClick={() => setStep('scan')} className="">
                                    <RotateCcw size={16} className="mr-2" /> Weiter scannen
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </GlassModal>
    );
};

export const CommissionCleanupModal = React.memo(CommissionCleanupModalComponent);
