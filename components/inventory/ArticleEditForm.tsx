import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Article, Warehouse, Supplier, ManufacturerSku, ArticleSupplier } from '../../types';
import { Button } from '../UIComponents';
import { X, ChevronDown, Trash2, Plus, Sparkles, Loader2, FileImage, Globe, CheckCircle2, ImageIcon, Clipboard, Hash, Star, Layers, Wand2, Pencil } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

interface ArticleEditFormProps {
    isEditMode: boolean;
    initialArticle: Article | null;
    warehouses: Warehouse[];
    suppliers: Supplier[];
    onSave: (articleData: any, shouldClose: boolean) => Promise<void>;
    onCancel: () => void;
    distinctCategories: string[];
    // Navigation props (optional for form, but useful if embedded)
    onNavigate?: (direction: 'prev' | 'next') => void;
    hasNavigation?: boolean;
    hideSaveAndNext?: boolean;
}

export const ArticleEditForm: React.FC<ArticleEditFormProps> = ({
    isEditMode,
    initialArticle,
    warehouses,
    suppliers,
    onSave,
    onCancel,
    distinctCategories,
    onNavigate,
    hasNavigation,
    hideSaveAndNext
}) => {
    // --- STATE MANAGEMENT ---
    const [newArticle, setNewArticle] = useState({
        name: '',
        ean: '',
        category: '',
        stock: 0,
        targetStock: 0,
        location: '',
        image: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isManualCategory, setIsManualCategory] = useState(false);

    // Lists
    const [tempSkus, setTempSkus] = useState<ManufacturerSku[]>([]);
    const [tempSkuInput, setTempSkuInput] = useState('');
    const [tempSuppliers, setTempSuppliers] = useState<ArticleSupplier[]>([]);
    const [tempSupplierSelect, setTempSupplierSelect] = useState('');
    const [tempSupplierSkuInput, setTempSupplierSkuInput] = useState('');
    const [tempSupplierUrlInput, setTempSupplierUrlInput] = useState('');
    const [editingSupplierIdx, setEditingSupplierIdx] = useState<number | null>(null);

    // AI State
    const [showAiScan, setShowAiScan] = useState(false);
    const [aiMode, setAiMode] = useState<'image' | 'link'>('image');
    const [aiUrlInput, setAiUrlInput] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiImagePreview, setAiImagePreview] = useState<string | null>(null);
    const [aiSelectedFile, setAiSelectedFile] = useState<File | null>(null);
    const [aiAnalysisResult, setAiAnalysisResult] = useState<any | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const aiFileInputRef = useRef<HTMLInputElement>(null);

    // --- INITIALIZATION ---
    useEffect(() => {
        if (initialArticle && isEditMode) {
            setNewArticle({
                name: initialArticle.name,
                ean: initialArticle.ean || '',
                category: initialArticle.category || '',
                stock: initialArticle.stock,
                targetStock: initialArticle.targetStock,
                location: initialArticle.location || '',
                image: initialArticle.image || ''
            });

            setIsManualCategory(!distinctCategories.includes(initialArticle.category || '') && !!initialArticle.category);

            if (initialArticle.manufacturerSkus && initialArticle.manufacturerSkus.length > 0) {
                setTempSkus(initialArticle.manufacturerSkus);
            } else if (initialArticle.sku) {
                setTempSkus([{ sku: initialArticle.sku, isPreferred: true }]);
            } else {
                setTempSkus([]);
            }

            // Fetch Suppliers
            const loadSuppliers = async () => {
                const { data } = await supabase.from('article_suppliers').select('*, suppliers(name)').eq('article_id', initialArticle.id);
                if (data && data.length > 0) {
                    setTempSuppliers(data.map((s: any) => ({
                        supplierId: s.supplier_id,
                        supplierName: s.suppliers?.name,
                        supplierSku: s.supplier_sku,
                        url: s.url,
                        isPreferred: !!s.is_preferred
                    })));
                } else if (initialArticle.supplier) {
                    const sObj = suppliers.find(s => s.name === initialArticle.supplier);
                    if (sObj) setTempSuppliers([{
                        supplierId: sObj.id,
                        supplierName: sObj.name,
                        supplierSku: initialArticle.supplierSku || '',
                        url: initialArticle.productUrl || '',
                        isPreferred: true
                    }]);
                } else {
                    setTempSuppliers([]);
                }
            };
            loadSuppliers();

        } else {
            resetForm();
            if (initialArticle && !isEditMode) {
                setNewArticle(prev => ({
                    ...prev,
                    category: initialArticle.category || '',
                    location: initialArticle.location || ''
                }));
                if (initialArticle.category) {
                    setIsManualCategory(!distinctCategories.includes(initialArticle.category));
                }
            }
        }
    }, [initialArticle, isEditMode]); // removed isOpen dependency as this is not a modal

    const resetForm = (preserveCategory = false) => {
        setNewArticle(prev => ({
            name: '',
            ean: '',
            category: preserveCategory ? prev.category : '',
            stock: 0,
            targetStock: 0,
            location: '',
            image: ''
        }));
        setTempSkus([]);
        setTempSuppliers([]);
        if (!preserveCategory) {
            setIsManualCategory(false);
        }
        setAiAnalysisResult(null);
        setAiSelectedFile(null);
        setAiImagePreview(null);
        setAiUrlInput('');
    };

    const handleSave = async (shouldClose: boolean) => {
        setIsSubmitting(true);
        try {
            await onSave({
                ...newArticle,
                manufacturer_skus: tempSkus,
                tempSuppliers
            }, shouldClose);

            if (!shouldClose) {
                resetForm(true); // Persist category
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };


    // --- LOGIC: SKUs ---
    const addTempSku = (sku = tempSkuInput) => {
        if (!sku.trim() || tempSkus.some(s => s.sku === sku)) return;
        setTempSkus(prev => [...prev, { sku: sku, isPreferred: prev.length === 0 }]);
        setTempSkuInput('');
    };
    const removeTempSku = (idx: number) => {
        setTempSkus(prev => {
            const next = prev.filter((_, i) => i !== idx);
            if (next.length > 0 && !next.some(s => s.isPreferred)) next[0].isPreferred = true;
            return next;
        });
    };
    const togglePreferredSku = (idx: number) => setTempSkus(prev => prev.map((s, i) => ({ ...s, isPreferred: i === idx })));

    // --- LOGIC: Suppliers ---
    const addTempSupplier = () => {
        if (!tempSupplierSelect) return;
        const sObj = suppliers.find(s => s.id === tempSupplierSelect);
        // If editing, skip the duplicate check for the CURRENT item (but still check others if needed, though simple replacement is easier for now)
        // If adding new, check duplicates
        if (!sObj || (editingSupplierIdx === null && tempSuppliers.some(s => s.supplierId === sObj.id))) return;

        const newSupplierEntry = {
            supplierId: sObj.id,
            supplierName: sObj.name,
            supplierSku: tempSupplierSkuInput,
            url: tempSupplierUrlInput,
            isPreferred: editingSupplierIdx !== null ? tempSuppliers[editingSupplierIdx].isPreferred : tempSuppliers.length === 0
        };

        if (editingSupplierIdx !== null) {
            setTempSuppliers(prev => prev.map((s, i) => i === editingSupplierIdx ? newSupplierEntry : s));
            setEditingSupplierIdx(null);
        } else {
            setTempSuppliers(prev => [...prev, newSupplierEntry]);
        }

        setTempSupplierSelect(''); setTempSupplierSkuInput(''); setTempSupplierUrlInput('');
    };

    const startEditSupplier = (idx: number) => {
        const s = tempSuppliers[idx];
        setTempSupplierSelect(s.supplierId);
        setTempSupplierSkuInput(s.supplierSku || '');
        setTempSupplierUrlInput(s.url || '');
        setEditingSupplierIdx(idx);
    };

    const cancelEditSupplier = () => {
        setEditingSupplierIdx(null);
        setTempSupplierSelect('');
        setTempSupplierSkuInput('');
        setTempSupplierUrlInput('');
    };
    const removeTempSupplier = (idx: number) => setTempSuppliers(prev => prev.filter((_, i) => i !== idx));
    const togglePreferredSupplier = (idx: number) => setTempSuppliers(prev => prev.map((s, i) => ({ ...s, isPreferred: i === idx })));

    // --- LOGIC: AI ---
    const getApiKey = () => {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
        try { if (process.env.API_KEY) return process.env.API_KEY; } catch (e) { } return '';
    };

    const analyzeWithGemini = async () => {
        setIsAnalyzing(true); setAiAnalysisResult(null); const apiKey = getApiKey();
        if (!apiKey) { alert("Fehler: API Key nicht gefunden."); setIsAnalyzing(false); return; }

        try {
            const supplierNames = suppliers.map(s => s.name).join(', ');
            const ai = new GoogleGenAI({ apiKey: apiKey });
            const schema = {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    compact_name_proposal: { type: Type.STRING },
                    ean: { type: Type.STRING },
                    skus: { type: Type.ARRAY, items: { type: Type.STRING } },
                    supplier_name: { type: Type.STRING },
                    supplier_sku: { type: Type.STRING },
                    product_url: { type: Type.STRING, nullable: true }
                }
            };
            const systemPrompt = `
            Analyze the product image or screenshot to extract structured data.
            
            CONTEXT (Known Suppliers): ${supplierNames}
            
            TASKS:
            1. **Product Name**: Extract the full product title.
            2. **Supplier**: Identify the supplier or wholesaler. Look for logos, website headers, or the domain in the browser address bar. Try to match with the "Known Suppliers" list.
            3. **Supplier SKU (Art-Nr)**: Look specifically for the supplier's article number (often labeled as "Art-Nr.", "Bestell-Nr.", "Ref", "Item No."). This is NOT the EAN.
            4. **URL**: If the image is a browser screenshot and shows the address bar, transcribe the URL exactly.
            5. **EAN/GTIN**: Extract if visible.
            
            OUTPUT RULES:
            - If exact supplier match found in context, use that name.
            - "supplier_sku" text is critical.
            `;

            let response;
            if (aiMode === 'image' && aiSelectedFile) {
                const reader = new FileReader();
                await new Promise((resolve) => { reader.onload = resolve; reader.readAsDataURL(aiSelectedFile); });
                const base64Data = (reader.result as string).split(',')[1];
                response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: [{ inlineData: { mimeType: aiSelectedFile.type, data: base64Data } }, { text: systemPrompt }],
                    config: { responseMimeType: "application/json", responseSchema: schema }
                });
            } else if (aiMode === 'link' && aiUrlInput) {
                // ... same logic
                response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: `${systemPrompt} JSON schema: ${JSON.stringify(schema)} Link: ${aiUrlInput}`,
                    config: { tools: [{ googleSearch: {} }] }
                });
            }

            if (response && response.text) {
                let text = response.text.trim().replace(/^```(json)?\s*/, '').replace(/\s*```$/, '');
                setAiAnalysisResult(JSON.parse(text));
            }
        } catch (e: any) { alert("AI Check Failed: " + e.message); } finally { setIsAnalyzing(false); }
    };

    const applyAiResult = (selectedName: string) => {
        if (!aiAnalysisResult) return;
        const data = aiAnalysisResult;
        setNewArticle(prev => ({
            ...prev,
            name: selectedName || data.name,
            ean: data.ean || prev.ean
        }));
        if (data.skus && Array.isArray(data.skus)) {
            setTempSkus(prev => {
                const existing = new Set(prev.map(s => s.sku));
                const newItems = data.skus.filter((found: string) => !existing.has(found) && found.trim()).map((s: string) => ({ sku: s, isPreferred: prev.length === 0 }));
                return [...prev, ...newItems];
            });
        }
        if (data.supplier_name) {
            const aiName = data.supplier_name.toLowerCase();
            // Fuzzy match: check if one includes the other in either direction
            const match = suppliers.find(s => {
                const dbName = s.name.toLowerCase();
                return dbName.includes(aiName) || aiName.includes(dbName);
            });

            if (match && !tempSuppliers.some(s => s.supplierId === match.id)) {
                setTempSuppliers(prev => [...prev, {
                    supplierId: match.id,
                    supplierName: match.name,
                    supplierSku: data.supplier_sku || '',
                    url: data.product_url || (aiMode === 'link' ? aiUrlInput : ''),
                    isPreferred: prev.length === 0
                }]);
            }
        }
        setIsAnalyzing(false); setShowAiScan(false);
    };

    const uploadFile = async (file: File) => {
        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const { error } = await supabase.storage.from('article-images').upload(fileName, file);
            if (error) throw error;
            const { data } = supabase.storage.from('article-images').getPublicUrl(fileName);
            setNewArticle(prev => ({ ...prev, image: data.publicUrl }));
        } catch (e: any) {
            alert("Upload failed: " + e.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        await uploadFile(e.target.files[0]);
    };

    const handlePasteImage = async () => {
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                if (item.types.some(type => type.startsWith('image/'))) {
                    const blob = await item.getType(item.types.find(type => type.startsWith('image/'))!);
                    const file = new File([blob], "pasted_image.png", { type: blob.type });
                    await uploadFile(file);
                    return;
                }
            }
            alert("Kein Bild in der Zwischenablage gefunden.");
        } catch (err) {
            console.error(err);
            // Fallback for older browsers or permission issues (though read() is stricter)
            alert("Zugriff auf Zwischenablage fehlgeschlagen oder nicht unterstützt.");
        }
    };

    const handlePasteAiImage = async () => {
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                if (item.types.some(type => type.startsWith('image/'))) {
                    const blob = await item.getType(item.types.find(type => type.startsWith('image/'))!);
                    const file = new File([blob], "ai_pasted_image.png", { type: blob.type });
                    setAiSelectedFile(file);
                    const r = new FileReader();
                    r.onload = x => setAiImagePreview(x.target?.result as string);
                    r.readAsDataURL(file);
                    return;
                }
            }
            alert("Kein Bild in der Zwischenablage gefunden.");
        } catch (err) {
            console.error(err);
            alert("Zugriff auf Zwischenablage fehlgeschlagen.");
        }
    };

    const handleAutoLocation = async () => {
        if (!newArticle.category) {
            alert("Bitte zuerst ein Regal auswählen.");
            return;
        }

        try {
            // Find last location in this category
            const { data } = await supabase
                .from('articles')
                .select('location')
                .eq('category', newArticle.category)
                .not('location', 'is', null)
                .order('created_at', { ascending: false }) // Or order by location? Alphanumeric sort is tricky in SQL. Created_at might be better proxy for "latest added".
                .limit(5); // Fetch detailed list to analyze client side if needed, but let's try mostly recent.

            if (!data || data.length === 0) {
                // No articles? Suggest start.
                setNewArticle(prev => ({ ...prev, location: 'A-01' }));
                return;
            }

            // Simple heuristic: Try to find pattern in most recent location
            const lastLoc = data[0].location;
            // Match any prefix (letters, spaces, dashes) followed by a number at the end
            const match = lastLoc?.match(/^(.+?)(\d+)$/);

            if (match) {
                const prefix = match[1];
                const numStr = match[2];
                const num = parseInt(numStr);
                const nextNum = num + 1;

                // Preserve padding if existing number starts with 0 and is longer than 1
                const shouldPad = numStr.startsWith('0') && numStr.length > 1;
                const nextNumStr = shouldPad
                    ? nextNum.toString().padStart(numStr.length, '0')
                    : nextNum.toString();

                setNewArticle(prev => ({ ...prev, location: `${prefix}${nextNumStr}` }));
            } else {
                // Determine valid default fallback if no pattern
                setNewArticle(prev => ({ ...prev, location: (lastLoc || '') + '-new' }));
            }

        } catch (e) { console.error(e); }
    };

    return (
        <div className="h-full flex flex-col bg-[#1a1d24] sm:bg-transparent">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-white/10 flex justify-between items-center bg-white/5 sticky top-0 z-10 backdrop-blur-xl shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-white">{isEditMode ? 'Artikel bearbeiten' : 'Neuer Artikel'}</h2>
                    <button onClick={() => setShowAiScan(!showAiScan)} className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-400 hover:to-blue-400 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-purple-500/20 transition-all transform hover:scale-105">
                        <Sparkles size={12} /><span>KI-Scan</span>
                    </button>
                    {hasNavigation && onNavigate && (
                        <div className="flex gap-1 ml-2">
                            <button onClick={() => onNavigate('prev')} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white"><ChevronDown size={16} className="rotate-90" /></button>
                            <button onClick={() => onNavigate('next')} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white"><ChevronDown size={16} className="-rotate-90" /></button>
                        </div>
                    )}
                </div>
                <button onClick={onCancel} className="p-2 rounded-full hover:bg-white/5 text-white/60 hover:text-white"><X size={20} /></button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-6 sm:space-y-8 relative">

                {/* INLINE AI SCAN SECTION */}
                {showAiScan && (
                    <div className="bg-[#1a1d24]/95 border border-purple-500/20 rounded-xl p-4 shadow-2xl mb-6">
                        {/* ... AI UI (Simplified for brevity, copying logic structure) */}
                        <div className="flex gap-2 mb-4">
                            <button onClick={() => { setAiMode('image'); setAiAnalysisResult(null); }} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${aiMode === 'image' ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/50'}`}>Bild-Scan</button>
                            <button onClick={() => { setAiMode('link'); setAiAnalysisResult(null); }} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${aiMode === 'link' ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/50'}`}>Link</button>
                        </div>
                        {!aiAnalysisResult ? (
                            <div className="space-y-3">
                                {aiMode === 'image' && (
                                    <div className="flex flex-col gap-2">
                                        <div className="relative w-full aspect-[21/9] rounded-lg border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/50" onClick={() => aiFileInputRef.current?.click()}>
                                            {aiImagePreview ? (
                                                <div className="relative w-full h-full"><img src={aiImagePreview} className="w-full h-full object-contain" /><button onClick={(e) => { e.stopPropagation(); setAiImagePreview(null); setAiSelectedFile(null); }} className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white"><X size={14} /></button></div>
                                            ) : (
                                                <div className="text-center text-white/40"><FileImage className="mx-auto mb-2 opacity-50" size={24} /><span className="text-xs">Bild hier ablegen</span></div>
                                            )}
                                            <input type="file" ref={aiFileInputRef} className="hidden" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) { setAiSelectedFile(e.target.files[0]); const r = new FileReader(); r.onload = x => setAiImagePreview(x.target?.result as string); r.readAsDataURL(e.target.files[0]); } }} />
                                        </div>
                                        {!aiImagePreview && (
                                            <button type="button" onClick={handlePasteAiImage} className="w-full py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white flex items-center justify-center gap-2 hover:bg-white/10 transition-colors">
                                                <Clipboard size={14} /> Aus Zwischenablage einfügen
                                            </button>
                                        )}
                                    </div>
                                )}
                                {aiMode === 'link' && (
                                    <div className="relative"><input className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 text-sm text-white" placeholder="https://..." value={aiUrlInput} onChange={(e) => setAiUrlInput(e.target.value)} /><Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} /></div>
                                )}
                                <Button onClick={analyzeWithGemini} disabled={isAnalyzing} className="w-full h-8 text-xs bg-gradient-to-r from-purple-500 to-blue-500 border-none">{isAnalyzing ? <Loader2 className="animate-spin" /> : 'Analysieren'}</Button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold"><CheckCircle2 size={14} /> <span>Gefunden!</span></div>
                                <button onClick={() => applyAiResult(aiAnalysisResult.name)} className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white">{aiAnalysisResult.name}</button>
                            </div>
                        )}
                    </div>
                )}

                {/* Content Layout - Modernized */}
                <div className="flex flex-col gap-6 pb-20 md:pb-0">

                    {/* FULL WIDTH NAME - Top Position */}
                    <div>
                        <label className="text-xs text-blue-300/70 font-bold uppercase tracking-wider mb-1 block">Bezeichnung</label>
                        <input
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xl font-bold focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-white/20"
                            value={newArticle.name}
                            onChange={e => setNewArticle({ ...newArticle, name: e.target.value })}
                            placeholder="Artikelbezeichnung..."
                        />
                    </div>

                    {/* SECOND ROW: Image & Secondary Info */}
                    <div className="flex flex-col md:flex-row gap-6 items-start">

                        {/* Image Column */}
                        <div className="flex items-center gap-4 shrink-0">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-28 h-28 shrink-0 rounded-2xl border-2 border-dashed border-white/10 bg-white/5 flex items-center justify-center relative overflow-hidden group hover:border-white/20 cursor-pointer transition-all hover:bg-white/10"
                            >
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} onClick={(e) => e.stopPropagation()} />
                                {isUploading ? <Loader2 className="animate-spin text-emerald-400" /> : newArticle.image ? <img src={newArticle.image} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center text-white/30"><ImageIcon size={24} /><span className="text-[10px] mt-1">Bild</span></div>}
                                {newArticle.image && !isUploading && <button onClick={(e) => { e.stopPropagation(); setNewArticle(prev => ({ ...prev, image: '' })); }} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 text-red-300 transition-opacity"><Trash2 size={20} /></button>}
                            </div>
                            <div className="flex flex-col gap-2">
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="md:hidden px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white">Upload</button>
                                {!newArticle.image && !isUploading && (
                                    <button type="button" onClick={handlePasteImage} className="w-10 h-10 md:w-auto md:h-auto md:px-3 md:py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white flex items-center justify-center gap-2 hover:bg-white/10 transition-colors" title="Aus Zwischenablage einfügen">
                                        <Clipboard size={16} />
                                        <span className="hidden md:inline">Einfügen</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Secondary Info Column - EAN & Stock */}
                        <div className="flex-1 w-full space-y-4">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-white/40 mb-1 block">EAN / Barcode</label>
                                    <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white/80 font-mono text-sm focus:ring-1 focus:ring-white/20" value={newArticle.ean} onChange={e => setNewArticle({ ...newArticle, ean: e.target.value })} placeholder="EAN Scannen..." />
                                </div>

                                {/* Stock - Inline for desktop */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-black/20 p-2 rounded-xl border border-white/5 flex flex-col justify-center">
                                        <span className="text-[10px] text-emerald-400 font-bold uppercase mb-0.5">Ist</span>
                                        <input type="number" className="bg-transparent border-none p-0 text-emerald-400 font-bold text-lg w-full focus:ring-0" value={newArticle.stock} onChange={e => setNewArticle({ ...newArticle, stock: parseInt(e.target.value) || 0 })} />
                                    </div>
                                    <div className="bg-black/20 p-2 rounded-xl border border-white/5 flex flex-col justify-center">
                                        <span className="text-[10px] text-blue-400 font-bold uppercase mb-0.5">Soll</span>
                                        <input type="number" className="bg-transparent border-none p-0 text-blue-400 font-bold text-lg w-full focus:ring-0" value={newArticle.targetStock} onChange={e => setNewArticle({ ...newArticle, targetStock: parseInt(e.target.value) || 0 })} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* LOCATION HEADER BAR */}
                    <div className="bg-gradient-to-r from-white/5 to-transparent p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-4 items-center">
                        <div className="flex-1 w-full">
                            <label className="text-xs text-white/40 mb-1.5 block flex items-center gap-1"><Layers size={12} /> Regal / Kategorie</label>
                            {isManualCategory ? (
                                <div className="flex gap-2">
                                    <input className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white" value={newArticle.category} onChange={e => setNewArticle({ ...newArticle, category: e.target.value })} placeholder="Kategorie benennen..." autoFocus />
                                    <button onClick={() => setIsManualCategory(false)} className="p-2 bg-white/10 rounded-xl text-white/60 hover:text-white border border-white/5"><ChevronDown size={20} /></button>
                                </div>
                            ) : (
                                <div className="relative w-full">
                                    <select className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-3 pr-10 text-white appearance-none text-sm font-medium" value={newArticle.category} onChange={e => e.target.value === '___NEW___' ? (setNewArticle({ ...newArticle, category: '' }), setIsManualCategory(true)) : setNewArticle({ ...newArticle, category: e.target.value })}>
                                        <option value="" disabled>Kategorie wählen...</option>
                                        {distinctCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                        <option value="___NEW___" className="text-emerald-400 font-bold">+ Neue Kategorie</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" size={16} />
                                </div>
                            )}
                        </div>

                        <div className="hidden md:block w-px h-10 bg-white/10 mx-2"></div>

                        <div className="flex-1 w-full">
                            <label className="text-xs text-white/40 mb-1.5 block flex items-center gap-1"><Hash size={12} /> Lagerort / Fach</label>
                            <div className="flex gap-2 relative group">
                                <input
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-mono transition-colors group-hover:border-white/20 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                                    value={newArticle.location}
                                    onChange={e => setNewArticle({ ...newArticle, location: e.target.value })}
                                    placeholder="z.B. A-01"
                                />
                                <button
                                    onClick={handleAutoLocation}
                                    className="absolute right-1 top-1 py-1 px-3 h-[calc(100%-8px)] rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 active:scale-95 transition-all text-xs font-bold flex items-center gap-2"
                                    title="Nächstes freies Fach vorschlagen"
                                >
                                    <Wand2 size={14} /> Auto
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* DETAILS GRID */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* SKUs Panel */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                            <label className="text-xs text-white/40 font-bold uppercase tracking-wider flex items-center justify-between">
                                <span>Alternative SKUs</span>
                                <span className="bg-white/10 text-white/60 px-1.5 py-0.5 rounded text-[10px]">{tempSkus.length}</span>
                            </label>

                            <div className="flex gap-2">
                                <input className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-white/20 focus:bg-white/10 transition-colors outline-none" value={tempSkuInput} onChange={e => setTempSkuInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTempSku()} placeholder="Neue SKU..." />
                                <button type="button" onClick={() => addTempSku()} className="px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 hover:text-white transition-colors"><Plus size={18} /></button>
                            </div>

                            <div className="flex flex-wrap gap-2 mt-1">
                                {tempSkus.length === 0 && <div className="text-xs text-white/20 italic p-2">Keine weiteren SKUs</div>}
                                {tempSkus.map((s, idx) => (
                                    <div key={idx} className={`flex items-center gap-2 pl-3 pr-1 py-1.5 rounded-lg border text-xs transition-all ${s.isPreferred ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-white/5 border-white/5 text-white/70 hover:bg-white/10'}`}>
                                        <span className="font-mono">{s.sku}</span>
                                        <div className="flex gap-0.5 border-l border-white/10 ml-1 pl-1">
                                            <button onClick={() => togglePreferredSku(idx)} className={`p-1 hover:text-white rounded ${s.isPreferred ? 'text-emerald-400' : 'text-white/20'}`}><Star size={12} fill={s.isPreferred ? "currentColor" : "none"} /></button>
                                            <button onClick={() => removeTempSku(idx)} className="p-1 hover:text-rose-400 text-white/30 rounded"><X size={12} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Suppliers Panel */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                            <label className="text-xs text-white/40 font-bold uppercase tracking-wider flex items-center justify-between">
                                <span>Lieferanten</span>
                                <span className="bg-white/10 text-white/60 px-1.5 py-0.5 rounded text-[10px]">{tempSuppliers.length}</span>
                            </label>

                            <div className="bg-black/20 p-3 rounded-xl border border-white/5 space-y-2">
                                <div className="flex gap-2">
                                    <select className="flex-1 bg-transparent text-white text-xs outline-none" value={tempSupplierSelect} onChange={e => setTempSupplierSelect(e.target.value)}>
                                        <option value="" className="bg-gray-900 text-gray-400">Lieferant auswählen...</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id} className="bg-gray-900">{s.name}</option>)}
                                    </select>
                                    <button onClick={addTempSupplier} disabled={!tempSupplierSelect} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50" title={editingSupplierIdx !== null ? 'Speichern' : 'Hinzufügen'}>
                                        {editingSupplierIdx !== null ? <CheckCircle2 size={18} /> : <Plus size={18} />}
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-white/20" placeholder="Art-Nr. beim Lieferant" value={tempSupplierSkuInput} onChange={e => setTempSupplierSkuInput(e.target.value)} />
                                    <input className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-white/20" placeholder="Produkt-Link (URL)" value={tempSupplierUrlInput} onChange={e => setTempSupplierUrlInput(e.target.value)} />
                                </div>
                            </div>

                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                                {tempSuppliers.map((s, idx) => (
                                    <div key={idx} className={`relative group p-2.5 rounded-lg border transition-all ${s.isPreferred ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-bold text-xs ${s.isPreferred ? 'text-emerald-300' : 'text-white'}`}>{s.supplierName}</span>
                                                    {s.isPreferred && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 rounded uppercase tracking-wider">Main</span>}
                                                </div>
                                                {s.supplierSku && <div className="text-[10px] text-white/50 font-mono mt-0.5">#{s.supplierSku}</div>}
                                                {s.url && (
                                                    <div className="flex items-center gap-1 text-[10px] text-emerald-400/80 mt-0.5" title={s.url}>
                                                        <Globe size={10} />
                                                        <span className="truncate max-w-[120px]">Link hinterlegt</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => togglePreferredSupplier(idx)} className={`p-1.5 rounded transition-colors ${s.isPreferred ? 'text-emerald-400' : 'text-white/20 hover:text-yellow-400'}`}><Star size={12} fill={s.isPreferred ? "currentColor" : "none"} /></button>
                                                <button onClick={() => startEditSupplier(idx)} className="p-1.5 rounded text-white/30 hover:text-blue-400"><Pencil size={12} /></button>
                                                <button onClick={() => removeTempSupplier(idx)} className="p-1.5 rounded text-white/30 hover:text-rose-400"><Trash2 size={12} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-white/10 flex justify-end gap-3 bg-black/20 rounded-b-2xl sticky bottom-0 z-10 backdrop-blur-xl shrink-0">
                <Button variant="secondary" onClick={onCancel}>Abbrechen</Button>
                {!isEditMode && !hideSaveAndNext && (
                    <Button
                        onClick={() => handleSave(false)}
                        disabled={isSubmitting}
                        className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border-emerald-500/30"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : 'Speichern & Weiter'}
                    </Button>
                )}
                <Button onClick={() => handleSave(true)} disabled={isSubmitting} className="min-w-[120px]">{isSubmitting ? <Loader2 className="animate-spin" /> : 'Speichern'}</Button>
            </div>
        </div>
    );
};
