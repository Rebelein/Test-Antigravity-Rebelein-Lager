
import React, { useEffect, useState, useMemo } from 'react';
import { GlassCard, Button, GlassInput, GlassSelect } from '../components/UIComponents';
import { supabase } from '../supabaseClient';
import { Warehouse, Article } from '../types';
import { Tag, Printer, Sliders, Search, CheckSquare, Square, ChevronLeft, ChevronRight, Download, ImageIcon, FileText, Box, Layers, Check, Loader2, Edit2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type DownloadFormat = 'pdf' | 'png';
type LabelViewMode = 'articles' | 'locations';
type LocationOccupancyFilter = 'all' | 'single' | 'multi';

interface LabelConfig {
    width: number; // mm
    height: number; // mm
    fontSizeScale: number; // 1 = default
}

interface GroupedLocation {
    uniqueKey: string; // Composite key for selection
    category: string;
    locationName: string;
    articles: Article[];
}

const DEFAULT_LABEL_CONFIG: LabelConfig = { width: 70, height: 37, fontSizeScale: 1 };

const Labels: React.FC = () => {
    const navigate = useNavigate();

    // Data States
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);

    // Label Tab States
    const [labelViewMode, setLabelViewMode] = useState<LabelViewMode>('articles');
    const [labelFilterWarehouse, setLabelFilterWarehouse] = useState<string>('all');
    const [labelFilterCategory, setLabelFilterCategory] = useState<string>('all');
    const [labelSearch, setLabelSearch] = useState('');
    const [locationOccupancyFilter, setLocationOccupancyFilter] = useState<LocationOccupancyFilter>('multi');

    const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(new Set());
    // For locations we use the unique composite key string
    const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());

    // Label Configuration
    const [isCustomSize, setIsCustomSize] = useState(false);
    const [globalLabelConfig, setGlobalLabelConfig] = useState<LabelConfig>(DEFAULT_LABEL_CONFIG);
    const [labelOverrides, setLabelOverrides] = useState<Record<string, LabelConfig>>({}); // ID -> Config

    // Label Preview & Options
    const [previewIndex, setPreviewIndex] = useState(0);
    const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>('pdf');
    const [isGeneratingImages, setIsGeneratingImages] = useState(false);

    useEffect(() => { fetchData(); }, []);

    // Reset Category Filter when Warehouse Filter changes
    useEffect(() => {
        setLabelFilterCategory('all');
    }, [labelFilterWarehouse]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch data needed for filters
            const { data: whData } = await supabase.from('warehouses').select('*');
            if (whData) setWarehouses(whData.map((w: any) => ({ ...w, itemsCount: w.items_count })));

            // Fetch articles for selection
            const { data: artData } = await supabase.from('articles').select('*');
            if (artData) {
                setArticles(artData.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    sku: item.sku,
                    manufacturerSkus: item.manufacturer_skus,
                    stock: item.stock,
                    targetStock: item.target_stock,
                    location: item.location,
                    category: item.category,
                    price: item.price,
                    supplier: item.supplier,
                    warehouseId: item.warehouse_id,
                    ean: item.ean,
                    supplierSku: item.supplier_sku,
                    productUrl: item.product_url,
                    image: item.image_url
                })));
            }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    // ==========================================
    // LABEL LOGIC
    // ==========================================

    // 1. Filter Articles & Group Locations
    const getFilteredArticles = () => {
        return articles.filter(a => {
            const matchWh = labelFilterWarehouse === 'all' || a.warehouseId === labelFilterWarehouse;
            const matchCat = labelFilterCategory === 'all' || (a.category || 'Sonstiges') === labelFilterCategory;
            const matchSearch = !labelSearch || a.name.toLowerCase().includes(labelSearch.toLowerCase()) || a.sku.toLowerCase().includes(labelSearch.toLowerCase());
            return matchWh && matchCat && matchSearch;
        });
    };

    // Calculated Available Categories based on selected Warehouse
    const availableCategories = useMemo(() => {
        let relevantArticles = articles;
        if (labelFilterWarehouse !== 'all') {
            relevantArticles = articles.filter(a => a.warehouseId === labelFilterWarehouse);
        }
        const cats = new Set(relevantArticles.map(a => a.category || 'Sonstiges'));
        return Array.from(cats).sort();
    }, [articles, labelFilterWarehouse]);

    const getFilteredLocations = (): GroupedLocation[] => {
        const filteredArts = getFilteredArticles();
        // Group by Category + Location (Composite Key) to ensure uniqueness
        const grouped: Record<string, { cat: string, loc: string, items: Article[] }> = {};

        filteredArts.forEach(a => {
            const loc = a.location ? a.location.trim() : 'Unsortiert';
            const cat = a.category ? a.category.trim() : 'Sonstiges';
            const key = `${cat}::${loc}`; // Unique Key

            if (!grouped[key]) {
                grouped[key] = { cat, loc, items: [] };
            }
            grouped[key].items.push(a);
        });

        let result = Object.entries(grouped).map(([key, data]) => ({
            uniqueKey: key,
            category: data.cat,
            locationName: data.loc,
            articles: data.items
        }));

        // Occupancy Filter
        if (locationOccupancyFilter === 'single') {
            result = result.filter(g => g.articles.length === 1);
        } else if (locationOccupancyFilter === 'multi') {
            result = result.filter(g => g.articles.length > 1);
        }

        // Search filter for location name OR category
        if (labelSearch && labelViewMode === 'locations') {
            const searchLower = labelSearch.toLowerCase();
            result = result.filter(g =>
                g.locationName.toLowerCase().includes(searchLower) ||
                g.category.toLowerCase().includes(searchLower)
            );
        }

        // Sort by Category then Location
        return result.sort((a, b) => {
            const catCompare = a.category.localeCompare(b.category);
            if (catCompare !== 0) return catCompare;
            return a.locationName.localeCompare(b.locationName, undefined, { numeric: true });
        });
    };

    const filteredLabelArticles = getFilteredArticles();
    const filteredLocations = getFilteredLocations();

    // 2. Selection Logic
    const toggleSelection = (id: string) => {
        if (labelViewMode === 'articles') {
            const newSet = new Set(selectedArticleIds);
            if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
            setSelectedArticleIds(newSet);
        } else {
            const newSet = new Set(selectedLocations);
            if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
            setSelectedLocations(newSet);
        }
    };

    const toggleSelectAll = () => {
        if (labelViewMode === 'articles') {
            if (selectedArticleIds.size === filteredLabelArticles.length) setSelectedArticleIds(new Set());
            else setSelectedArticleIds(new Set(filteredLabelArticles.map(a => a.id)));
        } else {
            if (selectedLocations.size === filteredLocations.length) setSelectedLocations(new Set());
            else setSelectedLocations(new Set(filteredLocations.map(a => a.uniqueKey)));
        }
    };

    // 3. Configuration Helpers
    const getSelectedItemsList = () => {
        if (labelViewMode === 'articles') {
            return articles.filter(a => selectedArticleIds.has(a.id));
        } else {
            // Returns GroupedLocations
            return filteredLocations.filter(l => selectedLocations.has(l.uniqueKey));
        }
    };

    // Current Preview Item
    const selectedItemsList = getSelectedItemsList();
    const previewItem = selectedItemsList[previewIndex]; // Can be Article or GroupedLocation

    // Get Config for a specific item (Global vs Override)
    const getConfigForItem = (id: string) => {
        return labelOverrides[id] || globalLabelConfig;
    };

    const updateCurrentConfig = (updates: Partial<LabelConfig>) => {
        if (!previewItem) return;
        // Use uniqueKey as ID for locations
        const currentId = 'id' in previewItem ? previewItem.id : previewItem.uniqueKey;
        const isOverridden = !!labelOverrides[currentId];

        if (isOverridden) {
            setLabelOverrides(prev => ({
                ...prev,
                [currentId]: { ...prev[currentId], ...updates }
            }));
        } else {
            setGlobalLabelConfig(prev => ({ ...prev, ...updates }));
        }
    };

    const toggleOverrideForCurrent = () => {
        if (!previewItem) return;
        const currentId = 'id' in previewItem ? previewItem.id : previewItem.uniqueKey;

        if (labelOverrides[currentId]) {
            const newOverrides = { ...labelOverrides };
            delete newOverrides[currentId];
            setLabelOverrides(newOverrides);
        } else {
            setLabelOverrides(prev => ({
                ...prev,
                [currentId]: { ...globalLabelConfig }
            }));
        }
    };

    // 4. Helper: Generate Label on Canvas
    const drawLabelToCanvas = async (item: Article | GroupedLocation, config: LabelConfig): Promise<string> => {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const scale = 4;
            const ppmm = 3.78 * scale;

            const width = config.width * ppmm;
            const height = config.height * ppmm;

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            if (!ctx) { reject("Canvas context failed"); return; }

            // Background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);

            const margin = 3 * ppmm;

            // Determine Mode
            const isLocation = !('sku' in item);

            // Prepare Data
            let qrData = '';

            if (isLocation) {
                const loc = item as GroupedLocation;
                // NEW: Encode both Category and Location for uniqueness
                qrData = `LOC:${loc.category}::${loc.locationName}`;
            } else {
                const art = item as Article;
                qrData = art.id; // UUID for scanning
            }

            // --- IMAGES (QR & Barcode) ---
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

            // Barcode only for Single Articles
            let barcodeUrl = null;
            if (!isLocation) {
                const art = item as Article;
                const barcodeVal = art.supplierSku || art.sku || art.ean || '0000';
                barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(barcodeVal)}&scale=4&height=20&includetext`;
            }

            const loadImg = (src: string): Promise<HTMLImageElement> => {
                return new Promise((res, rej) => {
                    const img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.onload = () => res(img);
                    img.onerror = rej;
                    img.src = src;
                });
            };

            const promises = [loadImg(qrUrl)];

            if (isLocation) {
                const loc = item as GroupedLocation;
                loc.articles.slice(0, 3).forEach(a => {
                    const bcVal = a.supplierSku || a.sku || a.ean || '0000';
                    const bcUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(bcVal)}&scale=2&height=5&includetext=false`;
                    promises.push(loadImg(bcUrl));
                });
            } else if (barcodeUrl) {
                promises.push(loadImg(barcodeUrl));
            }

            Promise.all(promises)
                .then((images) => {
                    const [qrImg, barImg] = images;

                    // Layout Constants
                    const qrSize = 19 * ppmm;
                    const rightColX = width - qrSize - margin;
                    const textWidth = rightColX - margin - (1 * ppmm);

                    // Draw QR Code (Top Right)
                    ctx.drawImage(qrImg, rightColX, margin, qrSize, qrSize);

                    if (isLocation) {
                        // --- MULTI ITEM / LOCATION LAYOUT ---
                        const loc = item as GroupedLocation;
                        const locationText = `${loc.category} / ${loc.locationName}`;

                        // 1. Footer Text (Location / Shelf) - Centered at Bottom
                        const fontSizeFooter = 12 * config.fontSizeScale * scale; // Large font
                        ctx.font = `bold ${fontSizeFooter}px Inter, sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.fillStyle = 'black';
                        // Position: Bottom center
                        ctx.fillText(locationText, width / 2, height - (margin / 2));

                        // 2. Article List (Top Left) - Start at top
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'top';

                        let cursorY = margin;
                        const fontSizeList = 8 * config.fontSizeScale * scale;
                        const fontSizeSub = 6 * config.fontSizeScale * scale;

                        // Show up to 3 items because of barcode space
                        const maxItems = 3;
                        const itemsToShow = loc.articles.slice(0, maxItems);

                        itemsToShow.forEach((a, index) => {
                            // Line 1: Article Name
                            ctx.font = `bold ${fontSizeList}px Inter, sans-serif`;
                            ctx.fillStyle = 'black';
                            const name = a.name.length > 25 ? a.name.substring(0, 23) + '..' : a.name;
                            ctx.fillText(`• ${name}`, margin, cursorY, textWidth); // Constrained width near QR
                            cursorY += fontSizeList + (1 * scale);

                            // Line 2: Barcode Image
                            if (images[index + 1]) {
                                const bcImg = images[index + 1];
                                const bcW = bcImg.width * 0.5; // Scale down
                                const bcH = bcImg.height * 0.5;
                                // Limit width
                                const maxBcW = textWidth * 0.8;
                                const finalW = Math.min(bcW, maxBcW);
                                const finalH = bcH * (finalW / bcW);

                                ctx.drawImage(bcImg, margin + (2 * scale), cursorY, finalW, finalH);
                                cursorY += finalH;
                            } else {
                                // Fallback info if no barcode
                                ctx.font = `${fontSizeSub}px Inter, sans-serif`;
                                ctx.fillStyle = '#555';
                                const supInfo = `${a.supplier || ''}: ${a.supplierSku || ''}`;
                                ctx.fillText(`   ${supInfo}`, margin, cursorY, textWidth);
                                cursorY += fontSizeSub;
                            }

                            cursorY += (2 * scale); // Spacer
                        });

                    } else {
                        // --- SINGLE ARTICLE LAYOUT ---
                        const art = item as Article;
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'top';

                        // Title
                        const fontSizeTitle = 12 * config.fontSizeScale * scale;
                        ctx.font = `bold ${fontSizeTitle}px Inter, sans-serif`;
                        ctx.fillStyle = 'black';
                        ctx.fillText(art.name, margin, margin, textWidth);

                        let cursorY = margin + fontSizeTitle + (4 * scale);

                        // SKU
                        const fontSizeSku = 9 * config.fontSizeScale * scale;
                        ctx.font = `${fontSizeSku}px Inter, sans-serif`;
                        ctx.fillStyle = '#555';
                        ctx.fillText(`Hersteller-Nr.: ${art.sku}`, margin, cursorY);
                        cursorY += fontSizeSku + (8 * scale);

                        // Details
                        const fontSizeInfo = 9 * config.fontSizeScale * scale;
                        ctx.fillStyle = '#333';
                        ctx.fillText(art.location || '-', margin, cursorY);
                        cursorY += fontSizeInfo + (2 * scale);
                        ctx.fillText(art.category || '', margin, cursorY);
                        cursorY += fontSizeInfo + (6 * scale);

                        ctx.font = `bold ${fontSizeInfo}px Inter, sans-serif`;
                        ctx.fillText(art.supplier || '', margin, cursorY);

                        // Barcode (Bottom)
                        if (barImg) {
                            const barHeight = 8 * ppmm;
                            const barWidth = width - (margin * 2);
                            const barY = height - barHeight - margin;
                            ctx.drawImage(barImg, margin, barY, barWidth, barHeight);
                        }
                    }

                    resolve(canvas.toDataURL('image/png'));
                })
                .catch(err => {
                    reject(err);
                });
        });
    };

    const handleDownloadImage = async (item: Article | GroupedLocation) => {
        try {
            const id = 'id' in item ? item.id : item.uniqueKey;
            const config = getConfigForItem(id);
            const dataUrl = await drawLabelToCanvas(item, config);
            const link = document.createElement('a');
            const filename = 'id' in item
                ? `Etikett_${item.sku}_${item.name.substring(0, 10)}.png`
                : `Lagerfach_${item.locationName}.png`;

            link.download = filename;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error("Failed to generate image", err);
        }
    };

    const handleBatchDownloadImages = async () => {
        if (!window.confirm(`Warnung: Es werden ${selectedItemsList.length} einzelne Bild-Dateien heruntergeladen. Fortfahren?`)) return;

        setIsGeneratingImages(true);
        for (const item of selectedItemsList) {
            await handleDownloadImage(item);
            await new Promise(r => setTimeout(r, 200));
        }
        setIsGeneratingImages(false);
    };


    // 5. Printing Logic (PDF/Print Dialog)
    const handlePrintPDF = (singleMode: boolean = false) => {
        const itemsToPrint = singleMode
            ? (previewItem ? [previewItem] : [])
            : selectedItemsList;

        if (itemsToPrint.length === 0) return;

        const printWindow = window.open('', 'PRINT_LABELS', 'height=600,width=800');
        if (!printWindow) return;

        // --- TITLE GENERATION ---
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DD_HH-mm-ss
        let docTitle = `Etiketten_Batch_${timestamp}`;

        if (singleMode && previewItem) {
            const isLoc = !('sku' in previewItem);
            const name = isLoc ? (previewItem as GroupedLocation).locationName : (previewItem as Article).name;
            // Sanitize filename
            const safeName = name.replace(/[^a-zA-Z0-9-_]/g, '_');
            docTitle = `Etikett_${safeName}_${timestamp}`;
        }

        const labelsHtml = itemsToPrint.map(item => {
            const isLocation = !('sku' in item);
            const id = isLocation ? (item as GroupedLocation).uniqueKey : (item as Article).id;
            const config = getConfigForItem(id);

            let qrData = '';
            let contentHtml = '';

            if (isLocation) {
                const loc = item as GroupedLocation;
                // NEW: Use composite key for unique QR
                qrData = `LOC:${loc.category}::${loc.locationName}`;

                // List items: Max 3 because of barcode space
                const itemsToShow = loc.articles.slice(0, 3);
                const listHtml = itemsToShow.map(a => {
                    const bcVal = a.supplierSku || a.sku || a.ean || '0000';
                    const bcUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(bcVal)}&scale=2&height=4&includetext=false`;

                    return `<div style="margin-bottom: 2mm; line-height: 1.1;">
                      <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: bold; color: #000;">• ${a.name}</div>
                      <!-- Barcode Image -->
                      <img src="${bcUrl}" crossorigin="anonymous" style="height: 5mm; max-width: 90%; margin-top: 0.5mm; display: block;" />
                      <div style="font-size: 0.5em; color: #777; margin-top: 0; padding-left: 1px;">${a.supplierSku || a.sku}</div>
                   </div>`;
                }).join('');

                contentHtml = `
                <div style="display: flex; flex-direction: column; height: 100%; justify-content: space-between;">
                    <div style="display: flex; justify-content: space-between;">
                         <div style="flex: 1; font-size: ${8 * config.fontSizeScale}pt; overflow: hidden; padding-right: 2mm;">
                            ${listHtml}
                         </div>
                         <div style="width: 19mm; height: 19mm; flex-shrink: 0;">
                             <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}" style="width: 100%; height: 100%; object-fit: contain;" crossorigin="anonymous" />
                         </div>
                    </div>
                    <div style="text-align: center; font-weight: bold; font-size: ${12 * config.fontSizeScale}pt; border-top: 1px solid #eee; padding-top: 1mm; margin-top: 1mm;">
                        ${loc.category} / ${loc.locationName}
                    </div>
                </div>
              `;

                return `
                <div class="label-wrapper" style="width: ${config.width}mm; height: ${config.height}mm;">
                    <div class="label-content" style="padding: 3mm; box-sizing: border-box; width: 100%; height: 100%;">
                        ${contentHtml}
                    </div>
                </div>
              `;

            } else {
                const art = item as Article;
                qrData = art.id;
                const barcodeValue = art.supplierSku || art.sku || art.ean || '0000';
                const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(barcodeValue)}&scale=2&height=10&includetext`;

                contentHtml = `
                <div class="label-content-single">
                    <div class="header">
                        <div class="title" style="font-size: ${9 * config.fontSizeScale}pt;">${art.name}</div>
                        <div class="sku" style="font-size: ${6 * config.fontSizeScale}pt;">Hersteller-Nr.: ${art.sku}</div>
                    </div>
                    <div class="qr-container">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}" crossorigin="anonymous" />
                    </div>
                    <div class="info" style="font-size: ${6 * config.fontSizeScale}pt;">
                        <div>${art.location || '-'}</div>
                        <div>${art.category || ''}</div>
                        <div style="margin-top:1mm;"><strong>${art.supplier || ''}</strong></div>
                    </div>
                    <div class="barcode-container">
                        <img src="${barcodeUrl}" crossorigin="anonymous" />
                    </div>
                </div>
              `;

                return `
                <div class="label-wrapper" style="width: ${config.width}mm; height: ${config.height}mm;">
                    <div style="width: 100%; height: 100%; padding: 3mm; box-sizing: border-box;">
                        ${contentHtml}
                    </div>
                </div>
              `;
            }
        }).join('');

        printWindow.document.write(`
        <html>
        <head>
            <title>${docTitle}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
                @page { 
                    size: A4 landscape; 
                    margin: 10mm; 
                }
                body { 
                    margin: 0; 
                    padding: 0; 
                    font-family: 'Inter', sans-serif; 
                    background: white; 
                }
                
                .print-container {
                    display: flex;
                    flex-wrap: wrap;
                    align-content: flex-start;
                    gap: 2mm;
                }

                .label-wrapper {
                    border: 1px dashed #ccc;
                    box-sizing: border-box;
                    background: white;
                    position: relative;
                    overflow: hidden;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }

                /* Single Label Grid */
                .label-content-single {
                    width: 100%;
                    height: 100%;
                    display: grid;
                    grid-template-columns: 1fr 20mm;
                    grid-template-rows: auto 1fr auto;
                    gap: 1mm;
                }
                .header { grid-column: 1 / 2; }
                .title { font-weight: 700; line-height: 1.1; overflow: hidden; max-height: 2.4em; }
                .sku { color: #555; margin-top: 1mm; }
                .qr-container { grid-column: 2 / 3; grid-row: 1 / 3; display: flex; justify-content: center; align-items: flex-start; }
                .qr-container img { width: 19mm; height: 19mm; object-fit: contain; }
                .info { grid-column: 1 / 2; align-self: center; overflow: hidden; }
                .barcode-container { grid-column: 1 / 3; display: flex; justify-content: center; align-items: flex-end; padding-top: 1mm; }
                .barcode-container img { max-width: 100%; height: 8mm; object-fit: contain; }

                @media print {
                    body { background: none; }
                    .label-wrapper { border-color: #eee; }
                }
            </style>
        </head>
        <body>
            <div class="print-container">
                ${labelsHtml}
            </div>
            <script>
                window.onload = function() { setTimeout(() => { window.print(); }, 800); }
            </script>
        </body>
        </html>
      `);
        printWindow.document.close();
    };

    return (
        <div className="space-y-6 pb-20 h-full">
            <header className="flex items-center justify-between gap-4">
                <div>
                    <button onClick={() => navigate('/dashboard')} className="text-sm text-white/50 hover:text-white mb-2">← Dashboard</button>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">Etikettendruck</h1>
                </div>
            </header>

            {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-400" /></div> : (
                <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)] min-h-[650px]">

                    {/* LEFT: SELECTION */}
                    <GlassCard
                        className="flex-1 overflow-hidden border border-white/10"
                        contentClassName="flex flex-col p-0 min-h-0"
                    >
                        <div className="p-4 border-b border-white/10 bg-white/5 space-y-3">

                            {/* View Mode Toggle (Article vs Location) */}
                            <div className="flex p-1 bg-black/40 rounded-lg border border-white/10">
                                <button
                                    onClick={() => { setLabelViewMode('articles'); setSelectedArticleIds(new Set()); setPreviewIndex(0); }}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2 ${labelViewMode === 'articles' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}
                                >
                                    <Box size={14} /> Artikel-Ansicht
                                </button>
                                <button
                                    onClick={() => { setLabelViewMode('locations'); setSelectedLocations(new Set()); setPreviewIndex(0); setLocationOccupancyFilter('multi'); }}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2 ${labelViewMode === 'locations' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}
                                >
                                    <Layers size={14} /> Lagerfächer
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <GlassSelect
                                        value={labelFilterWarehouse}
                                        onChange={(e) => setLabelFilterWarehouse(e.target.value)}
                                    >
                                        <option value="all" className="bg-gray-900 text-white">Alle Lager</option>
                                        {warehouses.map(w => <option key={w.id} value={w.id} className="bg-gray-900 text-white">{w.name}</option>)}
                                    </GlassSelect>
                                </div>
                                <div className="flex-1">
                                    <GlassSelect
                                        value={labelFilterCategory}
                                        onChange={(e) => setLabelFilterCategory(e.target.value)}
                                    >
                                        <option value="all" className="bg-gray-900 text-white">Alle Regale</option>
                                        {availableCategories.map(c => <option key={c} value={c} className="bg-gray-900 text-white">{c}</option>)}
                                    </GlassSelect>
                                </div>
                            </div>

                            {/* Extra Filter for Location View */}
                            {labelViewMode === 'locations' && (
                                <div className="flex gap-2 text-xs">
                                    <button onClick={() => setLocationOccupancyFilter('all')} className={`px-3 py-1 rounded-full border ${locationOccupancyFilter === 'all' ? 'bg-white/20 border-white/30 text-white' : 'border-transparent text-white/50'}`}>Alle Fächer</button>
                                    <button onClick={() => setLocationOccupancyFilter('single')} className={`px-3 py-1 rounded-full border ${locationOccupancyFilter === 'single' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'border-transparent text-white/50'}`}>Einzeln</button>
                                    <button onClick={() => setLocationOccupancyFilter('multi')} className={`px-3 py-1 rounded-full border ${locationOccupancyFilter === 'multi' ? 'bg-blue-500/20 border-blue-500/30 text-blue-300' : 'border-transparent text-white/50'}`}>Mehrfach</button>
                                </div>
                            )}

                            <GlassInput
                                icon={<Search size={14} />}
                                placeholder={labelViewMode === 'articles' ? "Artikel suchen..." : "Fach suchen..."}
                                value={labelSearch}
                                onChange={e => setLabelSearch(e.target.value)}
                                className="py-2 text-sm"
                            />

                            <div className="flex items-center justify-between pt-2">
                                <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                                    {((labelViewMode === 'articles' && selectedArticleIds.size > 0) || (labelViewMode === 'locations' && selectedLocations.size > 0)) ? <CheckSquare size={16} /> : <Square size={16} />}
                                    Alle auswählen ({labelViewMode === 'articles' ? filteredLabelArticles.length : filteredLocations.length})
                                </button>
                                <span className="text-sm text-white/50">
                                    {labelViewMode === 'articles' ? selectedArticleIds.size : selectedLocations.size} gewählt
                                </span>
                            </div>
                        </div>

                        {/* LIST VIEW */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {labelViewMode === 'articles' ? (
                                filteredLabelArticles.length === 0 ? (
                                    <div className="text-center text-white/30 py-8 text-sm">Keine Artikel gefunden.</div>
                                ) : (
                                    filteredLabelArticles.map(article => (
                                        <div
                                            key={article.id}
                                            onClick={() => toggleSelection(article.id)}
                                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedArticleIds.has(article.id) ? 'bg-emerald-500/10 border border-emerald-500/20' : 'hover:bg-white/5 border border-transparent'}`}
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedArticleIds.has(article.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/30'}`}>
                                                {selectedArticleIds.has(article.id) && <Check size={10} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-white truncate">{article.name}</div>
                                                <div className="text-xs text-white/40 flex gap-2">
                                                    <span>{article.sku}</span>
                                                    <span>•</span>
                                                    <span>{article.location}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )
                            ) : (
                                filteredLocations.length === 0 ? (
                                    <div className="text-center text-white/30 py-8 text-sm">Keine Lagerfächer gefunden.</div>
                                ) : (
                                    filteredLocations.map(loc => {
                                        const isMulti = loc.articles.length > 1;
                                        const isSelected = selectedLocations.has(loc.uniqueKey);
                                        return (
                                            <div
                                                key={loc.uniqueKey}
                                                onClick={() => toggleSelection(loc.uniqueKey)}
                                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-emerald-500/10 border border-emerald-500/20' : 'hover:bg-white/5 border border-transparent'}`}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/30'}`}>
                                                    {isSelected && <Check size={10} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <div className="text-sm font-bold text-white truncate">{loc.category} / {loc.locationName}</div>
                                                        <div className={`text-[10px] px-1.5 py-0.5 rounded border ${isMulti ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-white/10 text-white/50 border-white/10'}`}>
                                                            {loc.articles.length} Artikel
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-white/40 truncate">
                                                        {loc.articles.map(a => a.name).join(', ')}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )
                            )}
                        </div>
                    </GlassCard>

                    {/* RIGHT: CONFIG & PREVIEW */}
                    <div className="flex-1 flex flex-col gap-4 min-w-[320px]">

                        {/* Config Panel */}
                        <GlassCard className="p-4 space-y-4 flex-1 flex flex-col">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <h3 className="text-white font-bold flex items-center gap-2"><Sliders size={18} className="text-emerald-400" /> Etikett anpassen</h3>

                                <div className="flex gap-2">
                                    {/* Size Toggle */}
                                    <div className="flex items-center bg-black/30 rounded-lg p-1 border border-white/10">
                                        <button onClick={() => setIsCustomSize(false)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${!isCustomSize ? 'bg-white/20 text-white' : 'text-white/50'}`}>Standard</button>
                                        <button onClick={() => setIsCustomSize(true)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${isCustomSize ? 'bg-emerald-600 text-white' : 'text-white/50'}`}>Manuell</button>
                                    </div>
                                </div>
                            </div>

                            {/* Preview Area */}
                            <div className="flex flex-col items-center justify-center bg-black/20 rounded-xl p-4 border border-white/5 relative flex-1 min-h-[200px] overflow-auto">
                                {previewItem ? (
                                    (() => {
                                        const isLocation = !('sku' in previewItem);
                                        const id = isLocation ? (previewItem as GroupedLocation).uniqueKey : (previewItem as Article).id;
                                        const config = getConfigForItem(id);
                                        const isOverridden = !!labelOverrides[id];

                                        const scale = 1.0;
                                        const pxWidth = config.width * 3.78;
                                        const pxHeight = config.height * 3.78;

                                        return (
                                            <>
                                                <div
                                                    className="bg-white text-black relative shadow-xl overflow-hidden transition-all duration-300 flex-shrink-0"
                                                    style={{
                                                        width: `${pxWidth}px`,
                                                        height: `${pxHeight}px`,
                                                        transform: `scale(${scale})`,
                                                        marginBottom: '1rem'
                                                    }}
                                                >
                                                    {/* Use Canvas-like simulation via HTML for preview */}
                                                    {isLocation ? (
                                                        // LOCATION LAYOUT PREVIEW
                                                        <div className="w-full h-full flex flex-col justify-between p-[3mm] box-border">
                                                            {/* Top Content */}
                                                            <div className="flex justify-between items-start flex-1 overflow-hidden">
                                                                {/* List */}
                                                                <div className="flex-1 pr-2 overflow-hidden">
                                                                    {(previewItem as GroupedLocation).articles.slice(0, 4).map(a => (
                                                                        <div key={a.id} className="mb-[1mm] leading-[1.1]">
                                                                            <div className="font-bold whitespace-nowrap overflow-hidden text-ellipsis text-[8pt]">• {a.name}</div>
                                                                            <div className="pl-2 text-[6pt] text-[#555] whitespace-nowrap overflow-hidden text-ellipsis">{a.supplier || ''}: {a.supplierSku || ''}</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                {/* QR */}
                                                                <div className="w-[19mm] h-[19mm] flex-shrink-0">
                                                                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`LOC:${(previewItem as GroupedLocation).category}::${(previewItem as GroupedLocation).locationName}`)}`} className="w-full h-full object-contain" alt="QR" />
                                                                </div>
                                                            </div>

                                                            {/* Footer */}
                                                            <div className="text-center font-bold border-t border-gray-200 pt-[1mm] mt-auto" style={{ fontSize: `${12 * config.fontSizeScale}pt` }}>
                                                                {(previewItem as GroupedLocation).category} / {(previewItem as GroupedLocation).locationName}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        // SINGLE ARTICLE LAYOUT PREVIEW
                                                        <div className="w-full h-full grid grid-cols-[1fr_20mm] grid-rows-[auto_1fr_auto] gap-[1mm] p-[3mm] box-border">
                                                            {/* Header */}
                                                            <div className="col-start-1 col-end-2">
                                                                <div className="font-bold leading-[1.1] overflow-hidden max-h-[2.4em]" style={{ fontSize: `${9 * config.fontSizeScale}pt` }}>{(previewItem as Article).name}</div>
                                                                <div className="text-[#555] mt-[1mm]" style={{ fontSize: `${6 * config.fontSizeScale}pt` }}>Hersteller-Nr.: {(previewItem as Article).sku}</div>
                                                            </div>

                                                            {/* QR Code */}
                                                            <div className="col-start-2 col-end-3 row-start-1 row-end-3 flex justify-center items-start">
                                                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent((previewItem as Article).id)}`} className="w-[19mm] h-[19mm] object-contain" alt="QR" />
                                                            </div>

                                                            {/* Content Body */}
                                                            <div className="col-start-1 col-end-2 self-center text-[#333]" style={{ fontSize: `${6 * config.fontSizeScale}pt` }}>
                                                                <div>{(previewItem as Article).location || '-'}</div>
                                                                <div>{(previewItem as Article).category || ''}</div>
                                                                <div className="mt-[1mm]"><strong>{(previewItem as Article).supplier || 'Lieferant'}</strong></div>
                                                            </div>

                                                            {/* Barcode */}
                                                            <div className="col-start-1 col-end-3 flex justify-center items-end pt-[1mm]">
                                                                <img src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent((previewItem as Article).supplierSku || '0000')}&scale=2&height=10&includetext`} className="max-w-full h-[8mm] object-contain" alt="Barcode" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-white/30 text-xs mt-4 text-center w-full">Vorschau ({config.width}mm x {config.height}mm)</div>
                                                {isOverridden && <div className="absolute top-2 right-2 bg-amber-500 text-black text-[10px] font-bold px-2 py-1 rounded-full">Individuell</div>}
                                            </>
                                        );
                                    })()
                                ) : (
                                    <div className="text-white/30 flex flex-col items-center gap-2">
                                        <Tag size={32} />
                                        <span>Wähle {labelViewMode === 'articles' ? 'Artikel' : 'Fach'} aus</span>
                                    </div>
                                )}
                            </div>

                            {/* Controls */}
                            {selectedItemsList.length > 0 && (
                                <>
                                    {/* Navigation */}
                                    <div className="flex items-center justify-between bg-white/5 rounded-lg p-2 border border-white/10">
                                        <button onClick={() => setPreviewIndex(prev => Math.max(0, prev - 1))} disabled={previewIndex === 0} className="p-1 hover:bg-white/10 rounded disabled:opacity-30"><ChevronLeft size={20} /></button>
                                        <span className="text-xs text-white/70 font-mono">{previewIndex + 1} / {selectedItemsList.length}</span>
                                        <button onClick={() => setPreviewIndex(prev => Math.min(selectedItemsList.length - 1, prev + 1))} disabled={previewIndex === selectedItemsList.length - 1} className="p-1 hover:bg-white/10 rounded disabled:opacity-30"><ChevronRight size={20} /></button>
                                    </div>

                                    {/* Manual Sliders */}
                                    {previewItem && (isCustomSize || labelOverrides['id' in previewItem ? previewItem.id : previewItem.uniqueKey]) && (
                                        <div className="space-y-3 pt-2 animate-in slide-in-from-top-2 fade-in bg-white/5 p-3 rounded-xl">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs text-white/60 flex items-center gap-1"><Edit2 size={10} /> Individuell anpassen</label>
                                                <button onClick={toggleOverrideForCurrent} className={`w-8 h-4 rounded-full transition-colors relative ${labelOverrides['id' in previewItem ? previewItem.id : previewItem.uniqueKey] ? 'bg-emerald-500' : 'bg-white/20'}`}>
                                                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${labelOverrides['id' in previewItem ? previewItem.id : previewItem.uniqueKey] ? 'translate-x-4' : ''}`} />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div>
                                                    <label className="text-[10px] text-white/50 block mb-1">Breite</label>
                                                    <input type="range" min="30" max="100" step="1" className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" value={getConfigForItem('id' in previewItem ? previewItem.id : previewItem.uniqueKey).width} onChange={(e) => updateCurrentConfig({ width: Number(e.target.value) })} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-white/50 block mb-1">Höhe</label>
                                                    <input type="range" min="20" max="80" step="1" className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" value={getConfigForItem('id' in previewItem ? previewItem.id : previewItem.uniqueKey).height} onChange={(e) => updateCurrentConfig({ height: Number(e.target.value) })} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-white/50 block mb-1">Schrift</label>
                                                    <input type="range" min="0.5" max="1.5" step="0.1" className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" value={getConfigForItem('id' in previewItem ? previewItem.id : previewItem.uniqueKey).fontSizeScale} onChange={(e) => updateCurrentConfig({ fontSizeScale: Number(e.target.value) })} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </GlassCard>

                        {/* Download Actions */}
                        <div className="bg-black/20 border border-white/10 rounded-xl p-3">
                            {/* Format Toggle */}
                            <div className="flex justify-center mb-3">
                                <div className="flex items-center bg-white/5 rounded-lg p-1 border border-white/10 w-full">
                                    <button onClick={() => setDownloadFormat('pdf')} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${downloadFormat === 'pdf' ? 'bg-emerald-600 text-white shadow-lg' : 'text-white/50 hover:text-white'}`}>
                                        <FileText size={16} /> PDF (Drucken)
                                    </button>
                                    <button onClick={() => setDownloadFormat('png')} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${downloadFormat === 'png' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/50 hover:text-white'}`}>
                                        <ImageIcon size={16} /> Bild (PNG)
                                    </button>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-2">
                                {/* Always visible Print Button */}
                                <Button
                                    variant="secondary"
                                    className="col-span-2 bg-white/10 hover:bg-white/20"
                                    icon={<Printer size={18} />}
                                    disabled={selectedItemsList.length === 0}
                                    onClick={() => handlePrintPDF(false)} // Direct Print (Uses Browser Print which is usually PDF)
                                >
                                    Sofort Drucken
                                </Button>

                                {/* Download All */}
                                <Button
                                    className={downloadFormat === 'png' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'}
                                    icon={isGeneratingImages ? <Loader2 className="animate-spin" /> : <Download size={18} />}
                                    disabled={selectedItemsList.length === 0 || isGeneratingImages}
                                    onClick={() => downloadFormat === 'pdf' ? handlePrintPDF(false) : handleBatchDownloadImages()}
                                >
                                    {downloadFormat === 'pdf' ? 'Alle (PDF)' : `Alle (${selectedItemsList.length})`}
                                </Button>

                                {/* Download Single */}
                                <Button
                                    variant="secondary"
                                    icon={<Tag size={18} />}
                                    disabled={selectedItemsList.length === 0 || isGeneratingImages}
                                    onClick={() => downloadFormat === 'pdf' ? handlePrintPDF(true) : (previewItem && handleDownloadImage(previewItem))}
                                >
                                    Einzeln
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Labels;
