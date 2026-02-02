import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Button, GlassCard } from '../components/UIComponents';
import { compressImage } from '../utils/imageCompression';
import { Loader2, CheckCircle, AlertTriangle, Play, ArrowRight, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ImageOptimizer: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Unified item structure
    interface OptimizableItem {
        id: string;
        name: string;
        imageUrl: string;
        tableName: string;
        columnName: string;
        bucketName: string;
    }

    const [items, setItems] = useState<OptimizableItem[]>([]);
    const [stats, setStats] = useState({ total: 0, optimized: 0, pending: 0 });

    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setLogs([]);
        try {
            const allItems: OptimizableItem[] = [];

            // 1. Fetch Articles (article-images)
            const { data: articleData } = await supabase
                .from('articles')
                .select('id, name, image')
                .not('image', 'is', null)
                .neq('image', '');

            if (articleData) {
                articleData.forEach((a: any) => {
                    if (a.image) {
                        allItems.push({
                            id: a.id,
                            name: `Artikel: ${a.name}`,
                            imageUrl: a.image,
                            tableName: 'articles',
                            columnName: 'image',
                            bucketName: 'article-images'
                        });
                    }
                });
            }

            // 2. Fetch Workwear (workwear)
            const { data: workwearData } = await supabase
                .from('workwear_templates')
                .select('id, name, image_url')
                .not('image_url', 'is', null)
                .neq('image_url', '');

            if (workwearData) {
                workwearData.forEach((w: any) => {
                    if (w.image_url) {
                        allItems.push({
                            id: w.id,
                            name: `Kleidung: ${w.name}`,
                            imageUrl: w.image_url,
                            tableName: 'workwear_templates',
                            columnName: 'image_url',
                            bucketName: 'workwear'
                        });
                    }
                });
            }

            // Filter pending
            // Enhanced check: Check for .webp extension OR "data:image/webp"
            const pending = allItems.filter(item => {
                const url = item.imageUrl.toLowerCase();
                // If it already contains 'optimized_' AND is webp, skip it
                if (url.includes('optimized_') && url.endsWith('.webp')) return false;

                // If it is NOT webp, optimize it
                return !url.endsWith('.webp');
            });

            setItems(pending);
            setStats({
                total: allItems.length,
                optimized: allItems.length - pending.length,
                pending: pending.length
            });

        } catch (e: any) {
            console.error(e);
            addLog("Fehler beim Laden: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const addLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 50));

    const processImages = async () => {
        if (items.length === 0) return;
        setProcessing(true);
        setProgress({ current: 0, total: items.length, success: 0, failed: 0 });
        setLogs([]);

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            setProgress(prev => ({ ...prev, current: i + 1 }));

            try {
                addLog(`Bearbeite: ${item.name}...`);

                // 1. Fetch original image
                // Handle different URL types (public Supabase URL vs others)
                // Use no-cache to ensure we get the file
                const response = await fetch(item.imageUrl, { cache: 'no-cache' });
                if (!response.ok) throw new Error(`Fetch failed (${response.status})`);
                const blob = await response.blob();

                // 2. Compress
                const file = new File([blob], "image.jpg", { type: blob.type });
                // If already small/optimized, util might return original. We enforce WebP conversion implicitly.
                const optimizedFile = await compressImage(file);

                // Check if compression actually happened/helped
                // If the util returns same file and it wasn't webp, we might want to force it?
                // The util currently converts to WebP.

                // 3. Upload new to CORRECT bucket
                const fileName = `optimized_${item.id}_${Date.now()}.webp`;

                // Upload options: Upsert false (new file), Content-Type explicit
                const { error: uploadError } = await supabase.storage
                    .from(item.bucketName)
                    .upload(fileName, optimizedFile, {
                        contentType: 'image/webp',
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                const { data: publicUrlData } = supabase.storage
                    .from(item.bucketName)
                    .getPublicUrl(fileName);

                const newUrl = publicUrlData.publicUrl;

                // 4. Update DB
                const updateObj: any = {};
                updateObj[item.columnName] = newUrl;

                const { error: dbError } = await supabase
                    .from(item.tableName)
                    .update(updateObj)
                    .eq('id', item.id);

                if (dbError) throw dbError;

                // 5. Success
                const savings = ((file.size - optimizedFile.size) / 1024).toFixed(1);
                addLog(`OK: ${(file.size / 1024).toFixed(1)}kb -> ${(optimizedFile.size / 1024).toFixed(1)}kb (Gespart: ${savings}kb)`);
                setProgress(prev => ({ ...prev, success: prev.success + 1 }));

            } catch (err: any) {
                console.error(err);
                addLog(`FEHLER ${item.name}: ${err.message}`);
                setProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
            }
        }

        setProcessing(false);
        fetchData(); // Refresh stats
    };

    return (
        <div className="min-h-screen bg-[#0f1115] text-white p-6 pb-24 space-y-8">
            <header className="flex items-center gap-4">
                <button onClick={() => navigate('/dashboard')} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-white/50 hover:text-white"><ArrowLeft size={20} /></button>
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
                        Bild-Optimierer
                    </h1>
                    <p className="text-white/50">Komprimiert nachträglich alle Artikelbilder</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlassCard className="flex flex-col items-center justify-center p-6">
                    <div className="text-3xl font-bold text-white">{stats.total}</div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Gesamt Bilder</div>
                </GlassCard>
                <GlassCard className="flex flex-col items-center justify-center p-6 border-emerald-500/20 bg-emerald-500/5">
                    <div className="text-3xl font-bold text-emerald-400">{stats.optimized}</div>
                    <div className="text-xs text-emerald-200/50 uppercase tracking-wider">Bereits Optimiert (WebP)</div>
                </GlassCard>
                <GlassCard className="flex flex-col items-center justify-center p-6 border-amber-500/20 bg-amber-500/5">
                    <div className="text-3xl font-bold text-amber-400">{stats.pending}</div>
                    <div className="text-xs text-amber-200/50 uppercase tracking-wider">Ausstehend</div>
                </GlassCard>
            </div>

            {loading ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-purple-400" /></div>
            ) : (
                <div className="space-y-6">
                    {stats.pending > 0 ? (
                        <GlassCard className="p-8 flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 mb-2">
                                <AlertTriangle size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-white">Optimierung erforderlich</h2>
                            <p className="text-white/60 max-w-md">
                                Es wurden {stats.pending} Bilder gefunden, die noch nicht im WebP-Format vorliegen.
                                Starten Sie den Prozess, um Speicherplatz zu und Ladezeiten zu verbessern.
                            </p>

                            {!processing ? (
                                <Button
                                    onClick={processImages}
                                    className="bg-gradient-to-r from-purple-600 to-blue-600 border-none shadow-lg shadow-purple-500/20 px-8 py-3 h-auto text-lg"
                                >
                                    <Play size={20} className="mr-2" /> Optimierung Starten
                                </Button>
                            ) : (
                                <div className="w-full max-w-md space-y-2">
                                    <div className="flex justify-between text-xs text-white/50">
                                        <span>Verarbeite... {progress.current} / {progress.total}</span>
                                        <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                                    </div>
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
                                            style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[10px] text-white/30 pt-1">
                                        <span className="text-emerald-400">Erfolg: {progress.success}</span>
                                        <span className="text-rose-400">Fehler: {progress.failed}</span>
                                    </div>
                                </div>
                            )}
                        </GlassCard>
                    ) : (
                        <GlassCard className="p-8 flex flex-col items-center text-center space-y-4 border-emerald-500/20 bg-emerald-500/5">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-2">
                                <CheckCircle size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-white">Alles optimiert!</h2>
                            <p className="text-white/60">Alle Artikelbilder sind auf dem neuesten Stand.</p>
                        </GlassCard>
                    )}

                    {logs.length > 0 && (
                        <div className="bg-black/50 rounded-xl p-4 font-mono text-xs text-white/50 max-h-[300px] overflow-y-auto">
                            {logs.map((log, i) => (
                                <div key={i} className="border-b border-white/5 py-1 last:border-0">{log}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ImageOptimizer;
