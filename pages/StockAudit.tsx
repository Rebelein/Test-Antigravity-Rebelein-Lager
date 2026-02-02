import React, { useState, useEffect, useRef } from 'react';
import { GlassCard, Button } from '../components/UIComponents';
import { supabase } from '../supabaseClient';
import { Article, Warehouse, WarehouseType } from '../types';
import { ClipboardList, Activity, Clock, ArrowRight, CheckCircle2, X, Loader2, Layers, AlertTriangle, ScanLine, MapPin, ChevronDown, Warehouse as WarehouseIcon, Truck, HardHat, Split, Focus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useTheme } from '../contexts/ThemeContext';

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

type AuditTab = 'movement' | 'stale';

const StockAudit: React.FC = () => {
    const { user, profile, updateWarehousePreference } = useAuth();
    const { isLowPerfMode } = useTheme();
    const [activeTab, setActiveTab] = useState<AuditTab>('movement');
    const [loading, setLoading] = useState(true);

    // Warehouse State
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);

    // Data
    const [articles, setArticles] = useState<Article[]>([]);
    const [recommendations, setRecommendations] = useState<{ title: string, items: any[], type: 'shelf' | 'article' } | null>(null);

    // Scanner State
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [scannerProcessing, setScannerProcessing] = useState(false);
    const [useNative, setUseNative] = useState(true);

    // Camera Capabilities (Focus) - NATIVE & LIBRARY
    const [cameraCapabilities, setCameraCapabilities] = useState<any>(null);
    const [focusValue, setFocusValue] = useState<number>(0);

    // Native Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scannerLoopRef = useRef<number | null>(null);

    // Audit Entry Modal State
    const [scannedLocation, setScannedLocation] = useState<string | null>(null);
    const [locationArticles, setLocationArticles] = useState<Article[]>([]);
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [auditCount, setAuditCount] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // DEBUG STATE
    const [debugLog, setDebugLog] = useState<string[]>([]);
    const addLog = (msg: string) => setDebugLog(prev => [msg, ...prev].slice(0, 5));

    // Ambiguity Handling (Mehrdeutige Fächer)
    const [showCategorySelector, setShowCategorySelector] = useState(false);
    const [ambiguousCategories, setAmbiguousCategories] = useState<string[]>([]);
    const [tempScannedLocName, setTempScannedLocName] = useState<string>('');

    const scannerRef = useRef<Html5Qrcode | null>(null); // For Fallback Html5Qrcode
    const scannerStartPromise = useRef<Promise<void> | null>(null);
    const isMounted = useRef(true);

    // Current Active Warehouse ID (from Profile)
    const activeWarehouseId = profile?.primary_warehouse_id;
    const activeWarehouse = warehouses.find(w => w.id === activeWarehouseId);

    useEffect(() => {
        isMounted.current = true;
        fetchWarehouses();

        // Listen for global event from Layout button
        const handleOpenScanner = () => setIsScannerOpen(true);
        window.addEventListener('open-audit-scanner', handleOpenScanner);

        return () => {
            isMounted.current = false;
            window.removeEventListener('open-audit-scanner', handleOpenScanner);
        };
    }, []);

    // Reload data when warehouse changes
    useEffect(() => {
        if (activeWarehouseId) {
            fetchAuditData();
        }
    }, [activeWarehouseId]);

    // Re-calculate lists when tab or data changes
    useEffect(() => {
        calculateRecommendations();
    }, [articles, activeTab]);

    // Scanner Lifecycle
    useEffect(() => {
        const shouldRun = isScannerOpen && !scannedLocation && !selectedArticle && !showCategorySelector && !document.hidden;

        if (shouldRun) {
            startScanner();
        } else {
            stopScanner();
        }

        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopScanner();
            } else if (isScannerOpen && !scannedLocation && !selectedArticle && !showCategorySelector) {
                startScanner();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);

    }, [isScannerOpen, scannedLocation, selectedArticle, showCategorySelector]);

    const fetchWarehouses = async () => {
        const { data } = await supabase.from('warehouses').select('*').order('name');
        if (data) {
            setWarehouses(data.map((w: any) => ({
                id: w.id,
                name: w.name,
                type: w.type,
                location: w.location
            })));

            // If no preference set, open selection immediately
            if (!profile?.primary_warehouse_id && data.length > 0) {
                setIsWarehouseModalOpen(true);
            }
        }
    };

    const handleSelectWarehouse = async (warehouseId: string) => {
        await updateWarehousePreference('primary', warehouseId);
        setIsWarehouseModalOpen(false);
        // Data fetch triggered by useEffect on activeWarehouseId change
    };

    const fetchAuditData = async () => {
        if (!activeWarehouseId) return;

        setLoading(true);
        try {
            const { data: artData } = await supabase
                .from('articles')
                .select('*')
                .eq('warehouse_id', activeWarehouseId);

            if (artData) {
                setArticles(artData.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    sku: item.sku,
                    stock: item.stock,
                    targetStock: item.target_stock || item.min_stock || 0,
                    location: item.location,
                    category: item.category,
                    price: item.price,
                    lastCountedAt: item.last_counted_at,
                    image: item.image_url,
                    ean: item.ean, // Include EAN for scanning
                    supplierSku: item.supplier_sku // Include Supplier SKU for scanning
                } as Article)));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const calculateRecommendations = async () => {
        if (articles.length === 0) return;

        const now = new Date();
        const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        if (activeTab === 'movement') {
            // Fetch movements only when needed (heavy query potentially)
            const { data: movements } = await supabase
                .from('stock_movements')
                .select('article_id')
                .gte('created_at', thirtyDaysAgo.toISOString());

            if (movements) {
                const movementCounts: Record<string, number> = {};
                movements.forEach((m: any) => {
                    movementCounts[m.article_id] = (movementCounts[m.article_id] || 0) + 1;
                });

                // Group by Category + Location (Regal / Fach)
                const shelfScores: Record<string, { score: number, lastCounted: string | null, category: string, locationName: string }> = {};

                articles.forEach(a => {
                    const loc = a.location || 'Unbekannt';
                    const cat = a.category || 'Sonstiges';

                    // Use composite key to distinguish same Fach number in different shelves
                    const compositeKey = `${cat}:::${loc}`;

                    const score = movementCounts[a.id] || 0;

                    if (!shelfScores[compositeKey]) {
                        shelfScores[compositeKey] = { score: 0, lastCounted: null, category: cat, locationName: loc };
                    }
                    shelfScores[compositeKey].score += score;

                    // Keep most recent count date for the shelf
                    if (a.lastCountedAt) {
                        if (!shelfScores[compositeKey].lastCounted || new Date(a.lastCountedAt) > new Date(shelfScores[compositeKey].lastCounted!)) {
                            shelfScores[compositeKey].lastCounted = a.lastCountedAt;
                        }
                    }
                });

                const sortedShelves = Object.values(shelfScores)
                    .filter(s => {
                        // Hide if counted recently (< 8 days)
                        if (s.lastCounted && new Date(s.lastCounted) > eightDaysAgo) return false;
                        return s.score > 0;
                    })
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 20);

                setRecommendations({
                    title: 'Häufig bewegte Lagerfächer (Top 20)',
                    type: 'shelf',
                    items: sortedShelves
                });
            }

        } else {
            // Stale Tab
            const staleArticles = articles
                .filter(a => {
                    const lastCounted = a.lastCountedAt ? new Date(a.lastCountedAt) : null;
                    // If counted recently (< 8 days), hide
                    if (lastCounted && lastCounted > eightDaysAgo) return false;
                    // If never counted or older than 30 days
                    return !lastCounted || lastCounted < thirtyDaysAgo;
                })
                .sort((a, b) => {
                    // Sort: Never counted first, then oldest date
                    if (!a.lastCountedAt) return -1;
                    if (!b.lastCountedAt) return 1;
                    return new Date(a.lastCountedAt).getTime() - new Date(b.lastCountedAt).getTime();
                })
                .slice(0, 50);

            setRecommendations({
                title: 'Lange nicht geprüft (> 30 Tage)',
                type: 'article',
                items: staleArticles
            });
        }
    };

    // --- SCANNER LOGIC ---

    // --- SCANNER LOGIC (Native + Fallback) ---

    const startScanner = async () => {
        // Feature Detection
        if ('BarcodeDetector' in window) {
            console.log("Using Native BarcodeDetector (Android/Chrome)");
            setUseNative(true);
            startNativeScanner();
        } else {
            console.log("Using Fallback Html5Qrcode (iOS/Safari)");
            setUseNative(false);
            // Small delay to ensure DOM is ready for library
            setTimeout(() => startFallbackScanner(), 100);
        }
    };

    // --- NATIVE IMPLEMENTATION (Android/Chrome) ---
    const startNativeScanner = async () => {
        if (!isMounted.current) return;
        setCameraError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: "environment" },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    // @ts-ignore
                    focusMode: 'continuous'
                }
            });

            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();

                // Get Capabilities (Focus/Zoom)
                const track = stream.getVideoTracks()[0];
                const capabilities = track.getCapabilities() as any;
                setCameraCapabilities(capabilities); // For Manual Slider

                // Apply Focus/Zoom
                if (capabilities.focusMode?.includes('continuous')) {
                    try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] } as any); } catch (e) { }
                }
                if (capabilities.zoom) {
                    try { await track.applyConstraints({ advanced: [{ zoom: Math.min(capabilities.zoom.max, 2.0) }] } as any); } catch (e) { }
                }
            }

            const formats = ['qr_code', 'code_128', 'ean_13', 'ean_8', 'code_39', 'upc_a', 'data_matrix', 'itf'];
            const detector = new window.BarcodeDetector({ formats });

            setIsScanning(true);
            const scanLoop = async () => {
                if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
                try {
                    const barcodes = await detector.detect(videoRef.current);
                    if (barcodes.length > 0) handleScanSuccess(barcodes[0].rawValue);
                } catch (e) { }
                if (isMounted.current && !scannerProcessing) {
                    scannerLoopRef.current = requestAnimationFrame(scanLoop);
                }
            };
            scanLoop();

        } catch (err: any) {
            console.error("Native Scanner Error", err);
            // Fallback to library if Native fails unexpectedly
            setUseNative(false);
            startFallbackScanner();
        }
    };

    // --- FALLBACK IMPLEMENTATION ---
    const startFallbackScanner = async () => {
        if (!document.getElementById('audit-reader')) return;
        if (scannerStartPromise.current) return;
        if (scannerRef.current?.isScanning) return;

        addLog("Init Fallback Scanner...");

        try {
            if (scannerRef.current) await stopScanner();

            const scanner = new Html5Qrcode("audit-reader", {
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: false // Force legacy for consistent fallback
                },
                verbose: true,
            });
            scannerRef.current = scanner;

            addLog("Starting stream...");

            // Reduced QR box size for better precision on single labels
            await scanner.start(
                { facingMode: "environment" },
                {
                    // MINIMAL CONSTRAINTS
                    fps: 10,
                    // No qrbox
                    // No aspectRatio
                },
                handleScanSuccess,
                (errorMessage) => {
                    // console.log(errorMessage);
                }
            );
            addLog("Stream started!");

            // POST-START: CHECK CAPABILITIES & APPLY FOCUS
            try {
                const caps = scanner.getRunningTrackCameraCapabilities() as any;
                setCameraCapabilities(caps);

                // Attempt soft autofocus if supported
                if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
                    await scanner.applyVideoConstraints({ focusMode: 'continuous' } as any);
                }
            } catch (e) { console.warn("Caps check failed", e); }

            if (isMounted.current) {
                setIsScanning(true);
                setCameraError(null);
            } else {
                await stopScanner();
            }
        } catch (err: any) {
            console.warn("Scanner start failed", err);
            addLog("Error: " + (err.message || err));
            if (isMounted.current && err?.name !== 'Html5QrcodeError') {
                setCameraError("Kamerafehler: " + (err.message || "Unbekannt"));
            }
        }
    };

    const stopScanner = async () => {
        // Stop Native
        if (scannerLoopRef.current) cancelAnimationFrame(scannerLoopRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        // Stop Fallback
        if (scannerRef.current && scannerRef.current.isScanning) {
            try { await scannerRef.current.stop(); } catch (e) { }
            try { scannerRef.current.clear(); } catch (e) { }
        }
        scannerRef.current = null;
        if (isMounted.current) setIsScanning(false);
    };

    const handleScanSuccess = async (decodedText: string) => {
        if (scannerProcessing) return;
        setScannerProcessing(true);

        // --- LOGIC: Direct Article OR Location Scan ---

        // 1. Check for Location Prefix (Internal QR)
        if (decodedText.startsWith('LOC:')) {
            const rawLoc = decodedText.substring(4).trim();
            handleLocationDetected(rawLoc);
        } else {
            // 2. Try direct Article match (UUID, EAN, SKU, SupplierSKU)
            const matchedArticle = articles.find(a =>
                a.id === decodedText ||
                (a.ean && a.ean === decodedText) ||
                (a.sku && a.sku === decodedText) ||
                (a.supplierSku && a.supplierSku === decodedText)
            );

            if (matchedArticle) {
                handleArticleSelect(matchedArticle);
            } else {
                alert("Code nicht erkannt: " + decodedText);
                setTimeout(() => setScannerProcessing(false), 2000);
            }
        }
    };

    const handleLocationDetected = (rawLoc: string) => {
        // Check for Precise Format: "Category::LocationName"
        const separatorIndex = rawLoc.indexOf('::');

        let matches: Article[] = [];
        let locNameDisplay = rawLoc;

        if (separatorIndex !== -1) {
            // Precise Scan (LOC:Regal A::Fach 1)
            const category = rawLoc.substring(0, separatorIndex);
            const location = rawLoc.substring(separatorIndex + 2);

            matches = articles.filter(a => a.location === location && (a.category || 'Sonstiges') === category);
            locNameDisplay = `${category} / ${location}`;
        } else {
            // Legacy Scan (LOC:Fach 1) -> Ambiguous check needed
            matches = articles.filter(a => a.location === rawLoc);
            locNameDisplay = rawLoc;
        }

        if (matches.length === 0) {
            alert(`Keine Artikel für "${locNameDisplay}" gefunden.`);
            setScannerProcessing(false);
            return;
        }

        // Check for Ambiguity (Only relevant for Legacy Scans without Category)
        const categories = Array.from(new Set(matches.map(a => a.category || 'Sonstiges')));

        if (separatorIndex === -1 && categories.length > 1) {
            // Multiple categories found for this legacy location name! Ask user.
            setTempScannedLocName(rawLoc);
            setAmbiguousCategories(categories.sort());
            setShowCategorySelector(true);
            // Scanner stops automatically via useEffect
        } else {
            // Unique match (or Explicit Category)
            setScannedLocation(locNameDisplay);
            setLocationArticles(matches);

            // If single article in shelf, auto-select for counting
            if (matches.length === 1) {
                setSelectedArticle(matches[0]);
                setAuditCount(matches[0].stock);
            }
        }
    };

    const handleCategorySelection = (category: string) => {
        const locName = tempScannedLocName;
        // Filter strictly by the chosen category
        const filtered = articles.filter(a => a.location === locName && (a.category || 'Sonstiges') === category);

        // Update view title to be more specific: "Regal A / Fach 1"
        setScannedLocation(`${category} / ${locName}`);
        setLocationArticles(filtered);

        setShowCategorySelector(false);

        if (filtered.length === 1) {
            setSelectedArticle(filtered[0]);
            setAuditCount(filtered[0].stock);
        }
    };

    const handleArticleSelect = (article: Article) => {
        setSelectedArticle(article);
        setAuditCount(article.stock);
    };

    const handleAuditSubmit = async () => {
        if (!selectedArticle || !user) return;
        setIsSubmitting(true);
        try {
            const now = new Date().toISOString();
            const diff = auditCount - selectedArticle.stock;

            // Update Article
            await supabase.from('articles').update({
                stock: auditCount,
                last_counted_at: now
            }).eq('id', selectedArticle.id);

            // Log Movement if changed
            if (diff !== 0) {
                await supabase.from('stock_movements').insert({
                    article_id: selectedArticle.id,
                    user_id: user.id,
                    amount: diff,
                    type: 'audit_correction',
                    reference: 'Inventur'
                });
            }

            // Update Local State
            setArticles(prev => prev.map(a => a.id === selectedArticle.id ? { ...a, stock: auditCount, lastCountedAt: now } : a));

            // Reset logic
            if (scannedLocation && locationArticles.length > 1) {
                // If we are in a Shelf View with multiple items, go back to list
                setSelectedArticle(null);
            } else {
                // If we scanned a single item (Direct Scan or Single Shelf Item), close everything
                handleCloseScanner();
            }

        } catch (err: any) {
            alert("Fehler beim Speichern: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseScanner = () => {
        setIsScannerOpen(false);
        setScannedLocation(null);
        setSelectedArticle(null);
        setLocationArticles([]);
        setScannerProcessing(false);
        setShowCategorySelector(false);
    };

    const getWarehouseIcon = (type: WarehouseType) => {
        switch (type) {
            case 'Main': return <WarehouseIcon size={24} className="text-emerald-100" />;
            case 'Vehicle': return <Truck size={24} className="text-blue-100" />;
            case 'Site': return <HardHat size={24} className="text-amber-100" />;
        }
    };

    const getWarehouseColor = (type: WarehouseType) => {
        switch (type) {
            case 'Main': return 'bg-gradient-to-br from-emerald-600 to-teal-700 border-emerald-500';
            case 'Vehicle': return 'bg-gradient-to-br from-blue-600 to-indigo-700 border-blue-500';
            case 'Site': return 'bg-gradient-to-br from-amber-600 to-orange-700 border-amber-500';
        }
    };

    return (
        <div className="space-y-6 pb-24">
            <header className="mb-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-fuchsia-300">
                            Inventur
                        </h1>
                        <p className="text-white/50">Lagerbestand prüfen und korrigieren.</p>
                    </div>

                    {/* WAREHOUSE SELECTOR BUTTON */}
                    <button
                        onClick={() => setIsWarehouseModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-sm transition-all"
                    >
                        <span className="text-white/60">Lager:</span>
                        <span className="font-bold text-white max-w-[100px] truncate">{activeWarehouse ? activeWarehouse.name : 'Wählen...'}</span>
                        <ChevronDown size={14} className="text-white/50" />
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-black/20 rounded-xl border border-white/5">
                <button onClick={() => setActiveTab('movement')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'movement' ? 'bg-white/10 text-white shadow' : 'text-white/50'}`}>
                    <Activity size={16} /> Hohe Bewegung
                </button>
                <button onClick={() => setActiveTab('stale')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'stale' ? 'bg-white/10 text-white shadow' : 'text-white/50'}`}>
                    <Clock size={16} /> Überfällig
                </button>
            </div>

            {/* Recommendations List */}
            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-purple-400" /></div>
            ) : (
                <div className="space-y-4">
                    {recommendations && (
                        <>
                            <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider px-2">{recommendations.title}</h3>
                            {recommendations.items.length === 0 ? (
                                <div className="text-center py-8 bg-white/5 rounded-xl border border-white/5 text-white/40">
                                    <CheckCircle2 size={32} className="mx-auto mb-2 opacity-50" />
                                    Alles geprüft! Keine Vorschläge.
                                </div>
                            ) : (
                                recommendations.items.map((item: any, idx) => (
                                    <GlassCard key={idx} className="flex items-center justify-between group">
                                        {recommendations.type === 'shelf' ? (
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-300 font-bold">
                                                    {idx + 1}
                                                </div>
                                                <div>
                                                    <div className="text-lg font-bold text-white">{item.category} / {item.locationName}</div>
                                                    <div className="text-xs text-white/50">Bewegungs-Score: {item.score}</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-white/5 overflow-hidden">
                                                    <img src={item.image} className="w-full h-full object-cover opacity-70" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-white">{item.name}</div>
                                                    <div className="text-xs text-white/50 flex gap-2">
                                                        <span className="font-bold text-purple-100">{item.category} / {item.location}</span>
                                                        <span className="text-purple-300 border-l border-white/10 pl-2 ml-1">Zuletzt: {item.lastCountedAt ? new Date(item.lastCountedAt).toLocaleDateString() : 'Nie'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="text-white/20">
                                            <ArrowRight size={18} />
                                        </div>
                                    </GlassCard>
                                ))
                            )}
                        </>
                    )}
                </div>
            )}

            {/* --- SCANNER MODAL --- */}
            {isScannerOpen && (
                <div className="fixed inset-0 z-[170] bg-black flex flex-col">
                    {/* Scanner Header */}
                    <div className="p-4 flex justify-between items-center bg-black/80 backdrop-blur-md z-10 absolute top-0 left-0 right-0">
                        <div className="flex items-center gap-2 text-purple-400 font-bold">
                            <ScanLine /> Inventur: {activeWarehouse?.name}
                        </div>
                        <button onClick={handleCloseScanner} className="p-2 bg-white/10 rounded-full text-white"><X size={24} /></button>
                    </div>

                    {/* Viewport */}
                    <div className="flex-1 relative bg-black">
                        {/* Only render camera if we are in scan mode (not showing result/selector) */}
                        {!scannedLocation && !showCategorySelector && !selectedArticle && (
                            <>
                                {/* NATIVE VIDEO */}
                                {useNative && (
                                    <video
                                        ref={videoRef}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        playsInline
                                        muted
                                    />
                                )}

                                {/* FALLBACK DIV (Required for html5-qrcode) */}
                                {!useNative && (
                                    <div id="audit-reader" className="w-full h-full object-cover" />
                                )}
                            </>
                        )}

                        {/* Error / Status */}
                        {!scannedLocation && !showCategorySelector && !selectedArticle && cameraError && (
                            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-red-400 bg-black/90 z-30">
                                <AlertTriangle size={48} className="mb-4" />
                                {cameraError}
                            </div>
                        )}

                        {/* MANUAL FOCUS SLIDER (If Supported) */}
                        {!scannedLocation && !showCategorySelector && !selectedArticle && isScanning && cameraCapabilities?.focusDistance && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 h-40 bg-black/40 backdrop-blur-md rounded-full border border-white/20 p-2 flex flex-col items-center gap-2 pointer-events-auto z-20">
                                <Focus size={16} className="text-white/70" />
                                <input
                                    type="range"
                                    // @ts-ignore
                                    orient="vertical"
                                    className="w-2 h-full appearance-none bg-white/20 rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400"
                                    style={{ writingMode: 'vertical-lr', WebkitAppearance: 'slider-vertical' }}
                                    min={cameraCapabilities.focusDistance.min}
                                    max={cameraCapabilities.focusDistance.max}
                                    step={cameraCapabilities.focusDistance.step}
                                    value={focusValue}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setFocusValue(val);
                                        if (useNative && streamRef.current) {
                                            // Apply to native track
                                            const track = streamRef.current.getVideoTracks()[0];
                                            track.applyConstraints({
                                                advanced: [{ focusMode: 'manual', focusDistance: val }]
                                            } as any).catch(e => console.warn(e));
                                        } else {
                                            // Apply to fallback
                                            scannerRef.current?.applyVideoConstraints({
                                                focusMode: 'manual',
                                                focusDistance: val
                                            } as any);
                                        }
                                    }}
                                />
                            </div>
                        )}

                        {/* Overlay if scanning */}
                        {!scannedLocation && !showCategorySelector && !selectedArticle && isScanning && (
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                {/* DEBUG OVERLAY */}
                                <div className="absolute top-20 left-4 right-4 z-50 pointer-events-none text-center">
                                    <div className="inline-block bg-black/50 text-white/70 text-[10px] font-mono p-2 rounded backdrop-blur-md text-left">
                                        {debugLog.map((log, i) => <div key={i}>{log}</div>)}
                                    </div>
                                </div>

                                <div className="w-[280px] h-[100px] border-2 border-purple-500 rounded-lg relative">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/80 text-xs bg-black/50 px-2 py-1 rounded whitespace-nowrap">
                                        {useNative ? 'High Performance (Native)' : 'Legacy Mode (JS)'}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* CATEGORY SELECTOR MODAL (Disambiguation) */}
                        {showCategorySelector && (
                            <div className="absolute inset-0 bg-gray-900/95 backdrop-blur-xl flex flex-col justify-center p-6 animate-in fade-in zoom-in-95 z-50">
                                <div className="text-center mb-6">
                                    <Split size={48} className="mx-auto text-amber-400 mb-4" />
                                    <h2 className="text-2xl font-bold text-white mb-2">Mehrdeutiges Fach!</h2>
                                    <p className="text-white/60">
                                        Das Fach <b>"{tempScannedLocName}"</b> kommt in mehreren Bereichen vor. Welches meinst du?
                                    </p>
                                </div>
                                <div className="space-y-3 max-w-sm mx-auto w-full">
                                    {ambiguousCategories.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => handleCategorySelection(cat)}
                                            className="w-full p-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex justify-between items-center group transition-all"
                                        >
                                            <span className="font-bold text-white text-lg">{cat}</span>
                                            <ArrowRight className="text-white/30 group-hover:text-amber-400 transition-colors" />
                                        </button>
                                    ))}
                                    <button onClick={handleCloseScanner} className="w-full py-4 text-white/40 hover:text-white mt-4">Abbrechen</button>
                                </div>
                            </div>
                        )}

                        {/* RESULT: LOCATION CONTENT */}
                        {scannedLocation && !selectedArticle && (
                            <div className="absolute inset-0 bg-gray-900 flex flex-col pt-20 p-4">
                                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <Layers size={20} className="text-purple-400" /> {scannedLocation}
                                </h2>
                                <p className="text-white/50 text-sm mb-4">Bitte Artikel wählen zur Zählung:</p>
                                <div className="space-y-3 overflow-y-auto pb-20">
                                    {locationArticles.map(article => (
                                        <GlassCard key={article.id} onClick={() => handleArticleSelect(article)} className="flex items-center gap-4 cursor-pointer hover:bg-white/10">
                                            <div className="w-12 h-12 rounded bg-black/30 overflow-hidden">
                                                <img src={article.image} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-bold text-white">{article.name}</div>
                                                <div className="text-xs text-white/50">{article.sku}</div>
                                            </div>
                                            <div className="text-emerald-400 font-mono">{article.stock}</div>
                                        </GlassCard>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* RESULT: COUNT ENTRY */}
                        {selectedArticle && (
                            <div className="absolute inset-0 bg-gray-900 flex flex-col justify-center p-6 animate-in slide-in-from-bottom-10">
                                <div className="w-full max-w-md mx-auto bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl">
                                    <div className="text-center mb-6">
                                        <div className="w-20 h-20 rounded-2xl bg-black/30 mx-auto mb-4 overflow-hidden border border-white/10">
                                            <img src={selectedArticle.image} className="w-full h-full object-cover" />
                                        </div>
                                        <h2 className="text-xl font-bold text-white line-clamp-2">{selectedArticle.name}</h2>
                                        <div className="flex items-center justify-center gap-2 mt-3 p-2 bg-white/5 rounded-xl border border-white/5">
                                            <MapPin size={16} className="text-purple-400" />
                                            <span className="font-mono font-medium text-purple-100">
                                                {selectedArticle.category || 'Regal ?'} / {selectedArticle.location || 'Fach ?'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="bg-black/30 rounded-2xl p-4 flex items-center justify-between">
                                            <button onClick={() => setAuditCount(c => Math.max(0, c - 1))} className="w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-2xl">-</button>
                                            <div className="text-center">
                                                <div className="text-4xl font-bold text-white">{auditCount}</div>
                                                <div className="text-[10px] text-white/40 uppercase tracking-wider mt-1">Ist-Menge</div>
                                            </div>
                                            <button onClick={() => setAuditCount(c => c + 1)} className="w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-2xl">+</button>
                                        </div>

                                        <div className="text-center text-xs text-white/30">
                                            Systembestand: {selectedArticle.stock} • Diff: {auditCount - selectedArticle.stock > 0 ? '+' : ''}{auditCount - selectedArticle.stock}
                                        </div>

                                        <div className="flex gap-3">
                                            <Button variant="secondary" className="flex-1" onClick={() => setSelectedArticle(null)}>Zurück</Button>
                                            <Button className="flex-1 bg-purple-600 hover:bg-purple-500 border-none shadow-purple-500/20" onClick={handleAuditSubmit} disabled={isSubmitting}>
                                                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Bestätigen'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- WAREHOUSE SELECTION MODAL --- */}
            {isWarehouseModalOpen && (
                <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in">
                    <GlassCard className="w-full max-w-2xl">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-white">Lager auswählen</h2>
                                <p className="text-white/50 text-sm">Welches Lager wird inventarisiert?</p>
                            </div>
                            {activeWarehouseId && (
                                <button onClick={() => setIsWarehouseModalOpen(false)} className="p-2 bg-white/5 rounded-full text-white/50 hover:text-white"><X size={20} /></button>
                            )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {warehouses.map(w => {
                                const isActive = activeWarehouseId === w.id;
                                return (
                                    <button
                                        key={w.id}
                                        onClick={() => handleSelectWarehouse(w.id)}
                                        className={`
                                     relative group flex flex-col items-center justify-center p-6 rounded-2xl border transition-all duration-300
                                     ${isActive ? 'ring-2 ring-white scale-[1.02]' : 'hover:scale-[1.02] hover:bg-white/5'}
                                     ${getWarehouseColor(w.type)}
                                   `}
                                    >
                                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                            {getWarehouseIcon(w.type)}
                                        </div>
                                        <span className="font-bold text-white text-center line-clamp-2">{w.name}</span>
                                        <span className="text-[10px] text-white/60 uppercase mt-1">{w.type === 'Main' ? 'Hauptlager' : w.type === 'Vehicle' ? 'Fahrzeug' : 'Baustelle'}</span>

                                        {isActive && <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center text-emerald-600 shadow-lg"><CheckCircle2 size={14} /></div>}
                                    </button>
                                );
                            })}
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};

export default StockAudit;