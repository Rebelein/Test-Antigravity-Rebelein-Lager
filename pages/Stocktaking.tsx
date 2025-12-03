
import React, { useState, useEffect, useRef } from 'react';
import { GlassCard, Button } from '../components/UIComponents';
import { supabase } from '../supabaseClient';
import { Article } from '../types';
import { ScanLine, X, Loader2, AlertTriangle, Package, Layers, Search, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const Stocktaking: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [scannerProcessing, setScannerProcessing] = useState(false);
  
  // Result State
  const [scannedResult, setScannedResult] = useState<{
      type: 'article' | 'location' | 'unknown';
      data: any;
      raw: string;
  } | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
      isMounted.current = true;
      // Auto-start scanner on mount
      startScanner();

      return () => {
          isMounted.current = false;
          stopScanner();
      };
  }, []);

  const startScanner = async () => {
      if (!document.getElementById('live-reader')) return;
      if (scannerRef.current?.isScanning) return;

      try {
          const scanner = new Html5Qrcode("live-reader", { 
              experimentalFeatures: { useBarCodeDetectorIfSupported: true },
              verbose: false
          });
          scannerRef.current = scanner;

          await scanner.start(
              { facingMode: "environment" }, 
              { 
                  fps: 10, 
                  qrbox: { width: 280, height: 280 }, // Square box for QR/Barcodes
                  aspectRatio: 1.0,
                  formatsToSupport: [ 
                      Html5QrcodeSupportedFormats.QR_CODE,
                      Html5QrcodeSupportedFormats.CODE_128,
                      Html5QrcodeSupportedFormats.EAN_13,
                      Html5QrcodeSupportedFormats.EAN_8,
                      Html5QrcodeSupportedFormats.CODE_39,
                      Html5QrcodeSupportedFormats.UPC_A
                  ]
              }, 
              handleScanSuccess, 
              undefined
          );

          if (isMounted.current) setIsScanning(true);
      } catch (err: any) {
          console.error("Scanner Error", err);
          if (isMounted.current) setError("Kamera konnte nicht gestartet werden.");
      }
  };

  const stopScanner = async () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
          try { await scannerRef.current.stop(); } catch(e) {}
          try { scannerRef.current.clear(); } catch(e) {}
      }
      scannerRef.current = null;
      if (isMounted.current) setIsScanning(false);
  };

  const handleScanSuccess = async (decodedText: string) => {
      if (scannerProcessing) return;
      setScannerProcessing(true);
      setError(null);

      console.log("Scanned:", decodedText);

      // --- 1. COMMISSION QR (COMM:uuid) ---
      if (decodedText.startsWith('COMM:')) {
          const commId = decodedText.substring(5).trim();
          await stopScanner();
          // Navigate to Commission Page via State passing
          navigate('/commissions', { state: { openCommissionId: commId } });
          return;
      }

      // --- 2. MACHINE QR (MACH:uuid) ---
      if (decodedText.startsWith('MACH:')) {
          const machId = decodedText.substring(5).trim();
          await stopScanner();
          navigate('/machines', { state: { openMachineId: machId } });
          return;
      }

      // --- 3. LOCATION QR (LOC:Name or LOC:Category::Name) ---
      if (decodedText.startsWith('LOC:')) {
          const rawLoc = decodedText.substring(4).trim();
          let cat = '';
          let loc = rawLoc;
          
          if (rawLoc.includes('::')) {
              [cat, loc] = rawLoc.split('::');
          }

          // Show Location in Inventory (Filter)
          await stopScanner();
          navigate('/inventory', { 
              state: { 
                  filterLocation: loc,
                  filterCategory: cat 
              } 
          });
          return;
      }

      // --- 4. ARTICLE SCAN (EAN / SKU / UUID) ---
      try {
          const { data, error } = await supabase
              .from('articles')
              .select('*')
              .or(`id.eq.${decodedText},ean.eq.${decodedText},sku.eq.${decodedText},supplier_sku.eq.${decodedText}`)
              .limit(1);

          if (data && data.length > 0) {
              const article = data[0];
              setScannedResult({ type: 'article', data: article, raw: decodedText });
              // Pause scanner UI but don't fully stop stream if we want quick resume (optional)
              // For now, let's keep scanning active but show modal
          } else {
              setError(`Kein Artikel gefunden für Code: ${decodedText}`);
              setTimeout(() => setError(null), 3000);
              setScannerProcessing(false);
          }
      } catch (err) {
          setError("Datenbankfehler beim Scannen.");
          setScannerProcessing(false);
      }
  };

  const handleCloseResult = () => {
      setScannedResult(null);
      setScannerProcessing(false);
  };

  const handleGoToArticle = () => {
      if (scannedResult?.type === 'article') {
          stopScanner();
          navigate('/inventory', { state: { openArticleId: scannedResult.data.id } });
      }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* HEADER */}
      <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-2">
              <ScanLine className="text-emerald-400" size={24} />
              <h1 className="text-xl font-bold text-white">Live Scanner</h1>
          </div>
          <button onClick={() => navigate('/dashboard')} className="p-2 bg-white/10 rounded-full text-white/80 hover:text-white backdrop-blur-md">
              <X size={24} />
          </button>
      </div>

      {/* SCANNER VIEWPORT */}
      <div className="flex-1 relative">
          <div id="live-reader" className="w-full h-full object-cover" />
          
          {/* Overlay Guide */}
          {!scannedResult && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div className="w-64 h-64 border-2 border-emerald-500/50 rounded-2xl relative">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-500 -mt-1 -ml-1 rounded-tl-xl"/>
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-500 -mt-1 -mr-1 rounded-tr-xl"/>
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-500 -mb-1 -ml-1 rounded-bl-xl"/>
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-500 -mb-1 -mr-1 rounded-br-xl"/>
                      
                      {/* Scanning Animation Line */}
                      <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 shadow-[0_0_10px_#10b981] animate-[scan_2s_infinite_linear]" />
                  </div>
                  <p className="mt-8 text-white/80 text-sm font-medium bg-black/40 px-4 py-2 rounded-full backdrop-blur-md">
                      Code im Rahmen platzieren
                  </p>
                  <p className="mt-2 text-white/40 text-xs">
                      Erkennt: EAN, Artikel-Nr, COMM, LOC, MACH
                  </p>
              </div>
          )}

          {/* Error Toast */}
          {error && (
              <div className="absolute bottom-20 left-4 right-4 p-4 bg-red-500/90 backdrop-blur-md text-white rounded-xl border border-red-400/50 flex items-center gap-3 animate-in slide-in-from-bottom-5">
                  <AlertTriangle size={24} className="shrink-0" />
                  <span className="text-sm font-medium">{error}</span>
              </div>
          )}
      </div>

      {/* FOOTER / MANUAL INPUT */}
      {!scannedResult && (
          <div className="p-6 bg-black pb-24">
              <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20}/>
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

      {/* RESULT MODAL (Quick Action) */}
      {scannedResult && scannedResult.type === 'article' && (
          <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
              <GlassCard className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10">
                  <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 size={24} />
                          <span className="font-bold">Artikel gefunden</span>
                      </div>
                      <button onClick={handleCloseResult} className="text-white/50 hover:text-white"><X size={24}/></button>
                  </div>
                  
                  <div className="flex gap-4 mb-6">
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

                  <div className="flex gap-3">
                      <Button variant="secondary" onClick={handleCloseResult} className="flex-1">Scan weiter</Button>
                      <Button onClick={handleGoToArticle} className="flex-1 bg-emerald-600 hover:bg-emerald-500">Öffnen / Buchen</Button>
                  </div>
              </GlassCard>
          </div>
      )}
    </div>
  );
};

export default Stocktaking;
