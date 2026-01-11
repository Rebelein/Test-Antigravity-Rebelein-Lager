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

    const resetForm = () => {
        setNewArticle({ name: '', ean: '', category: '', stock: 0, targetStock: 0, location: '', image: '' });
        setTempSkus([]);
        setTempSuppliers([]);
        setIsManualCategory(false);
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
                resetForm();
                // Optional: Success Toast or Feedback here
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
            const systemPrompt = `Extract product data. Context Suppliers: ${supplierNames}. Rules: Extract EXACT supplier name if found. Extract SKUs.`;

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
                    model: "gemini-2.5-flash-lite",
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
            const match = suppliers.find(s => s.name.toLowerCase().includes(data.supplier_name.toLowerCase()));
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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        setIsUploading(true);
        try {
            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const { error } = await supabase.storage.from('article-images').upload(fileName, file);
            if (error) throw error;
            const { data } = supabase.storage.from('article-images').getPublicUrl(fileName);
            setNewArticle(prev => ({ ...prev, image: data.publicUrl }));
        } catch (e: any) { alert("Upload failed: " + e.message); } finally { setIsUploading(false); }
    };

    const handleAutoLocation = async () => { /* Mock */ };

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
                                    <div className="relative w-full aspect-[21/9] rounded-lg border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/50" onClick={() => aiFileInputRef.current?.click()}>
                                        {aiImagePreview ? (
                                            <div className="relative w-full h-full"><img src={aiImagePreview} className="w-full h-full object-contain" /><button onClick={(e) => { e.stopPropagation(); setAiImagePreview(null); setAiSelectedFile(null); }} className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white"><X size={14} /></button></div>
                                        ) : (
                                            <div className="text-center text-white/40"><FileImage className="mx-auto mb-2 opacity-50" size={24} /><span className="text-xs">Bild hier ablegen</span></div>
                                        )}
                                        <input type="file" ref={aiFileInputRef} className="hidden" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) { setAiSelectedFile(e.target.files[0]); const r = new FileReader(); r.onload = x => setAiImagePreview(x.target?.result as string); r.readAsDataURL(e.target.files[0]); } }} />
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

                {/* Content Layout */}
                <div className="md:grid md:grid-cols-2 md:gap-8 h-full pb-20 md:pb-0">

                    {/* LEFT COLUMN: Image & Basic Info */}
                    <div className="flex flex-col gap-6">
                        {/* Image Section */}
                        <div className="flex gap-4">
                            <div className="w-24 h-24 shrink-0 rounded-2xl border-2 border-dashed border-white/10 bg-white/5 flex items-center justify-center relative overflow-hidden group hover:border-white/20">
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                                {isUploading ? <Loader2 className="animate-spin text-emerald-400" /> : newArticle.image ? <img src={newArticle.image} className="w-full h-full object-cover" /> : <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center cursor-pointer text-white/30"><ImageIcon size={20} /><span className="text-[9px]">Bild</span></div>}
                                {newArticle.image && !isUploading && <button onClick={() => setNewArticle(prev => ({ ...prev, image: '' }))} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 text-red-300"><Trash2 size={16} /></button>}
                            </div>
                            <div className="flex flex-col justify-center gap-2">
                                {!newArticle.image && !isUploading && (
                                    <button type="button" onClick={() => { }} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white flex items-center gap-2"><Clipboard size={14} /> Einfügen</button>
                                )}
                            </div>
                        </div>

                        {/* Main Fields */}
                        <div className="space-y-4">
                            <div><label className="text-xs text-white/50 mb-1 block">Bezeichnung</label><input className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-base font-medium focus:ring-1 focus:ring-emerald-500/50" value={newArticle.name} onChange={e => setNewArticle({ ...newArticle, name: e.target.value })} placeholder="Artikelname" /></div>
                            <div><label className="text-xs text-white/50 mb-1 block">EAN / Barcode</label><input className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-emerald-500/50" value={newArticle.ean} onChange={e => setNewArticle({ ...newArticle, ean: e.target.value })} placeholder="EAN" /></div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Stock, Location, Suppliers */}
                    <div className="flex flex-col gap-6 mt-6 md:mt-0">
                        {/* Stock Grid */}
                        <div className="grid grid-cols-2 gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
                            <div><label className="text-[10px] text-emerald-400 block mb-1 font-bold">Ist</label><input type="number" className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 text-white font-bold" value={newArticle.stock} onChange={e => setNewArticle({ ...newArticle, stock: parseInt(e.target.value) || 0 })} /></div>
                            <div><label className="text-[10px] text-blue-400 block mb-1 font-bold">Soll</label><input type="number" className="w-full bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 text-white font-bold" value={newArticle.targetStock} onChange={e => setNewArticle({ ...newArticle, targetStock: parseInt(e.target.value) || 0 })} /></div>
                        </div>

                        {/* Location */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-white/50 block mb-1">Regal</label>
                                {isManualCategory ? (
                                    <div className="flex gap-2">
                                        <input className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white" value={newArticle.category} onChange={e => setNewArticle({ ...newArticle, category: e.target.value })} placeholder="Regal" />
                                        {distinctCategories.length > 0 && <button onClick={() => setIsManualCategory(false)} className="p-3 bg-white/10 rounded-xl text-white/60 hover:text-white"><Layers size={20} /></button>}
                                    </div>
                                ) : (
                                    <div className="relative w-full">
                                        <select className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-10 text-white appearance-none" value={newArticle.category} onChange={e => e.target.value === '___NEW___' ? (setNewArticle({ ...newArticle, category: '' }), setIsManualCategory(true)) : setNewArticle({ ...newArticle, category: e.target.value })}>
                                            <option value="" disabled className="bg-gray-900">Wählen...</option>
                                            {distinctCategories.map(c => <option key={c} value={c} className="bg-gray-900">{c}</option>)}
                                            <option value="___NEW___" className="bg-gray-900 text-emerald-400 font-bold">+ Neu</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50" size={16} />
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="text-xs text-white/50 block mb-1">Fach</label>
                                <div className="flex gap-2">
                                    <input className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white" value={newArticle.location} onChange={e => setNewArticle({ ...newArticle, location: e.target.value })} placeholder="A-01" />
                                    <button onClick={handleAutoLocation} className="px-3 bg-white/10 rounded-xl text-emerald-400 hover:text-emerald-300"><Wand2 size={18} /></button>
                                </div>
                            </div>
                        </div>

                        {/* Suppliers & SKUs */}
                        <div className="space-y-6 pt-2 border-t border-white/5">
                            <div className="space-y-2">
                                <label className="text-xs text-white/50 block flex items-center gap-1"><Hash size={12} /> SKUs</label>
                                <div className="flex gap-2">
                                    <input className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono" value={tempSkuInput} onChange={e => setTempSkuInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTempSku()} placeholder="123-456" />
                                    <button type="button" onClick={() => addTempSku()} className="px-3 bg-white/10 hover:bg-white/20 rounded-lg"><Plus size={16} /></button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {tempSkus.map((s, idx) => (
                                        <div key={idx} className={`flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg border text-xs ${s.isPreferred ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-white/5 border-white/10 text-white/60'}`}>
                                            <span>{s.sku}</span>
                                            <div className="flex gap-1 ml-1 pl-1 border-l border-white/10">
                                                <button onClick={() => togglePreferredSku(idx)} className={`hover:text-white ${s.isPreferred ? 'text-emerald-400' : 'text-white/20'}`}><Star size={10} fill={s.isPreferred ? "currentColor" : "none"} /></button>
                                                <button onClick={() => removeTempSku(idx)} className="hover:text-rose-400 text-white/40"><X size={10} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-white/50 font-bold uppercase">Lieferanten</label>
                                <div className="bg-black/20 p-3 rounded-xl border border-white/5 space-y-3">
                                    <div className="flex gap-2">
                                        <select className="flex-1 bg-white/5 border border-white/10 rounded-lg text-white text-sm p-2 appearance-none" value={tempSupplierSelect} onChange={e => setTempSupplierSelect(e.target.value)}>
                                            <option value="" className="bg-gray-900">Lieferant...</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id} className="bg-gray-900">{s.name}</option>)}
                                        </select>
                                        <div className="flex gap-1">
                                            {editingSupplierIdx !== null && (
                                                <Button onClick={cancelEditSupplier} variant="secondary" className="px-3 py-2 h-auto text-xs">Cancel</Button>
                                            )}
                                            <Button onClick={addTempSupplier} disabled={!tempSupplierSelect} className="px-3 py-2 h-auto text-xs">{editingSupplierIdx !== null ? 'Update' : 'Add'}</Button>
                                        </div>
                                    </div>
                                    <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" placeholder="Art-Nr." value={tempSupplierSkuInput} onChange={e => setTempSupplierSkuInput(e.target.value)} />
                                    <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" placeholder="Produkt-Link (URL)" value={tempSupplierUrlInput} onChange={e => setTempSupplierUrlInput(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    {tempSuppliers.map((s, idx) => (
                                        <div key={idx} className={`relative group p-3 rounded-xl border transition-all duration-300 ${s.isPreferred ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20' : 'bg-gradient-to-br from-white/10 to-white/5 border-white/10 hover:border-white/20'}`}>
                                            <div className="flex justify-between items-start">
                                                <div className="overflow-hidden mr-3 flex-1">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <span className={`font-bold text-sm leading-none ${s.isPreferred ? 'text-emerald-300' : 'text-white'}`}>{s.supplierName}</span>
                                                        {s.isPreferred && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">Main</span>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col gap-1">
                                                        {s.supplierSku && (
                                                            <div className="flex items-center gap-1.5 text-xs text-white/50">
                                                                <Hash size={10} className="stroke-[2.5]" />
                                                                <span className="font-mono tracking-wide">{s.supplierSku}</span>
                                                            </div>
                                                        )}
                                                        {s.url && (
                                                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-400/80 hover:text-blue-300 transition-colors w-full group/link">
                                                                <Globe size={10} className="shrink-0 stroke-[2.5]" />
                                                                <span className="truncate underline decoration-blue-500/30 underline-offset-2 group-hover/link:decoration-blue-400/50">{s.url}</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex gap-1 shrink-0">
                                                    <button onClick={() => togglePreferredSupplier(idx)} className={`p-2 rounded-lg transition-colors ${s.isPreferred ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20' : 'text-white/20 hover:text-yellow-400 hover:bg-white/10'}`} title={s.isPreferred ? "Hauptlieferant" : "Als Hauptlieferant setzen"}>
                                                        <Star size={14} fill={s.isPreferred ? "currentColor" : "none"} />
                                                    </button>
                                                    <button onClick={() => startEditSupplier(idx)} className="p-2 rounded-lg text-white/30 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button onClick={() => removeTempSupplier(idx)} className="p-2 rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
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
