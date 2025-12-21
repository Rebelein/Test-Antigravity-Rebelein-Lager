import React, { useState, useRef, useEffect } from 'react';
import { GlassCard, Button, GlassSelect, GlassInput } from './UIComponents';
import { Article, Warehouse, Supplier, ManufacturerSku, ArticleSupplier } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { GoogleGenAI, Type } from "@google/genai";
import {
    Plus, Loader2, Check, X, Link as LinkIcon, Sparkles, Edit, Trash2, ExternalLink,
    Image as ImageIcon, Hash, Wand2, Globe, Clipboard, FileImage, Layers, Type as TypeIcon,
    Paperclip, ChevronDown, CheckCircle2, Star, AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AddArticleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveSuccess: (articleId: string) => void;
    initialData?: Partial<Article>;
    mode: 'add' | 'edit';
    warehouses: Warehouse[];
    suppliers: Supplier[];
    existingCategories: string[]; // For dropdown suggestions
    defaultWarehouseId?: string;
}

// Reusable Image Interface
interface ReusableImage {
    url: string;
    articleNames: string[];
    categories: string[];
    warehouseIds: string[];
    lastUsed: string;
}

export const AddArticleModal: React.FC<AddArticleModalProps> = ({
    isOpen, onClose, onSaveSuccess, initialData, mode, warehouses, suppliers, existingCategories, defaultWarehouseId
}) => {
    const { profile, user } = useAuth();
    const navigate = useNavigate();

    // Form State
    const [newArticle, setNewArticle] = useState<Partial<Article>>({
        name: '', ean: '', category: '', stock: 0, targetStock: 0, location: '', image: ''
    });

    // Duplicate Check State
    const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
    const [duplicateConfirmation, setDuplicateConfirmation] = useState<{
        isOpen: boolean;
        onConfirm: () => void;
        message: string;
    } | null>(null);

    // Helper State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isManualCategory, setIsManualCategory] = useState(false);

    // SKU Lists
    const [tempSkus, setTempSkus] = useState<ManufacturerSku[]>([]);
    const [tempSkuInput, setTempSkuInput] = useState('');
    const [editingSkuIndex, setEditingSkuIndex] = useState<number | null>(null);
    const [editSkuValue, setEditSkuValue] = useState('');

    // Supplier Lists
    const [tempSuppliers, setTempSuppliers] = useState<{
        supplierId: string;
        supplierName: string;
        supplierSku: string;
        url: string;
        isPreferred: boolean;
    }[]>([]);
    const [tempSupplierSelect, setTempSupplierSelect] = useState('');
    const [tempSupplierSkuInput, setTempSupplierSkuInput] = useState('');
    const [tempSupplierUrlInput, setTempSupplierUrlInput] = useState('');
    const [editingSupplierIndex, setEditingSupplierIndex] = useState<number | null>(null);
    const [editSupplierData, setEditSupplierData] = useState({ supplierId: '', supplierSku: '', url: '' });

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);

    // AI Modal State
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiMode, setAiMode] = useState<'image' | 'link'>('image');
    const [aiImagePreview, setAiImagePreview] = useState<string | null>(null);
    const [aiSelectedFile, setAiSelectedFile] = useState<File | null>(null);
    const [aiUrlInput, setAiUrlInput] = useState('');
    const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const aiFileInputRef = useRef<HTMLInputElement>(null);

    // Image Reuse Modal State
    const [isImageReuseModalOpen, setIsImageReuseModalOpen] = useState(false);
    const [recentImages, setRecentImages] = useState<ReusableImage[]>([]);
    const [filteredImages, setFilteredImages] = useState<ReusableImage[]>([]);
    const [reuseSearch, setReuseSearch] = useState('');
    const [reuseFilterWarehouse, setReuseFilterWarehouse] = useState('all');
    const [reuseFilterCategory, setReuseFilterCategory] = useState('all');
    const [reuseCategories, setReuseCategories] = useState<string[]>([]);
    const [warehouseCategoryMap, setWarehouseCategoryMap] = useState<Record<string, string[]>>({});
    const [reuseLoading, setReuseLoading] = useState(false);
    const [showRecent, setShowRecent] = useState(true);

    // Initialization
    useEffect(() => {
        if (isOpen) {
            resetModalForm();
            if (initialData) {
                setNewArticle(prev => ({
                    ...prev,
                    ...initialData,
                    category: initialData.category || '',
                    stock: initialData.stock || 0,
                    targetStock: initialData.targetStock || 0,
                }));
                // Check if category is known
                if (initialData.category && !existingCategories.includes(initialData.category)) {
                    setIsManualCategory(true);
                }
            }
            if (defaultWarehouseId) {
                // If we need to store warehouseId in article state, we can.
                // But mostly it's used during save.
            }

            // If editing, we might need to load existing suppliers/SKUs if not passed in initialData
            // NOTE: For 'edit' mode in Inventory, complex data loading happened before opening modal.
            // Here we assume initialData is populated or handled by parent. 
            // BUT: tempSkus and tempSuppliers need to be set if available.
            if (initialData?.manufacturerSkus) {
                setTempSkus(initialData.manufacturerSkus);
            } else if (initialData?.sku) {
                setTempSkus([{ sku: initialData.sku, isPreferred: true }]);
            }

            // We can't easily sync suppliers here without extra props or fetching.
            // For the IMPORT use case, we manually set tempSuppliers in the parent (Orders/Inventory) or here.
            // Let's assume the parent passes fully populated initialData or we accept separate props for skus/suppliers?
            // To keep it simple, we trust initialData has what we need or we fetch if mode is 'edit' and ID exists.
        }
    }, [isOpen, initialData]);

    const resetModalForm = () => {
        setNewArticle({ name: '', ean: '', category: '', stock: 0, targetStock: 0, location: '', image: '' });
        setTempSkus([]); setTempSuppliers([]); setTempSkuInput(''); setTempSupplierSelect(''); setTempSupplierSkuInput(''); setTempSupplierUrlInput('');
        setIsUploading(false); setEditingSkuIndex(null); setEditingSupplierIndex(null); setIsManualCategory(false);
        setAiAnalysisResult(null);
    };

    // --- LOGIC: SKU & SUPPLIER LISTS (COPIED) ---
    const addTempSku = (sku = tempSkuInput) => {
        if (!sku.trim()) return; if (tempSkus.some(s => s.sku === sku)) return;
        const isFirst = tempSkus.length === 0; setTempSkus(prev => [...prev, { sku: sku, isPreferred: isFirst }]); setTempSkuInput('');
    };

    const removeTempSku = (index: number) => {
        const newSkus = tempSkus.filter((_, i) => i !== index); if (newSkus.length > 0 && !newSkus.some(s => s.isPreferred)) newSkus[0].isPreferred = true; setTempSkus(newSkus); if (editingSkuIndex === index) setEditingSkuIndex(null);
    };

    const togglePreferredSku = (index: number) => {
        const newSkus = tempSkus.map((s, i) => ({ ...s, isPreferred: i === index })); setTempSkus(newSkus);
    };

    const startEditingSku = (index: number) => { setEditingSkuIndex(index); setEditSkuValue(tempSkus[index].sku); };

    const saveEditingSku = () => {
        if (editingSkuIndex !== null && editSkuValue.trim()) { setTempSkus(prev => prev.map((s, i) => i === editingSkuIndex ? { ...s, sku: editSkuValue.trim() } : s)); setEditingSkuIndex(null); setEditSkuValue(''); }
    };

    const addTempSupplier = () => {
        if (!tempSupplierSelect) return; const sObj = suppliers.find(s => s.id === tempSupplierSelect); if (!sObj) return;
        if (tempSuppliers.some(s => s.supplierId === sObj.id)) { alert("Lieferant bereits hinzugefügt."); return; }
        const isFirst = tempSuppliers.length === 0; setTempSuppliers([...tempSuppliers, { supplierId: sObj.id, supplierName: sObj.name, supplierSku: tempSupplierSkuInput, url: tempSupplierUrlInput, isPreferred: isFirst }]);
        setTempSupplierSelect(''); setTempSupplierSkuInput(''); setTempSupplierUrlInput('');
    };

    const removeTempSupplier = (index: number) => {
        const newSups = tempSuppliers.filter((_, i) => i !== index); if (newSups.length > 0 && !newSups.some(s => s.isPreferred)) newSups[0].isPreferred = true; setTempSuppliers(newSups); if (editingSupplierIndex === index) setEditingSupplierIndex(null);
    };

    const togglePreferredSupplier = (index: number) => {
        const newSups = tempSuppliers.map((s, i) => ({ ...s, isPreferred: i === index })); setTempSuppliers(newSups);
    };

    const startEditingSupplier = (index: number) => {
        setEditingSupplierIndex(index); const item = tempSuppliers[index]; setEditSupplierData({ supplierId: item.supplierId, supplierSku: item.supplierSku, url: item.url || '' });
    };

    const saveEditingSupplier = () => {
        if (editingSupplierIndex !== null && editSupplierData.supplierId) {
            const sObj = suppliers.find(s => s.id === editSupplierData.supplierId); if (!sObj) return;
            setTempSuppliers(prev => prev.map((s, i) => i === editingSupplierIndex ? { ...s, supplierId: sObj.id, supplierName: sObj.name, supplierSku: editSupplierData.supplierSku, url: editSupplierData.url } : s));
            setEditingSupplierIndex(null);
        }
    };

    // --- AUTO LOCATION ---
    const handleAutoLocation = async () => {
        // Ideally this needs access to ALL articles to find max location.
        // Since we don't have all articles prop, we can query DB or just omit this feature in modal for now?
        // Or pass a callback prop `onRequestAutoLocation`.
        // Let's implement a quick DB lookup for safety.
        if (!newArticle.category || !defaultWarehouseId) return;

        const { data } = await supabase.from('articles')
            .select('location')
            .eq('warehouse_id', defaultWarehouseId)
            .eq('category', newArticle.category);

        if (data) {
            let maxNum = 0;
            data.forEach((a: any) => {
                const match = a.location?.match(/(\d+)/);
                if (match) { const num = parseInt(match[1]); if (num > maxNum) maxNum = num; }
            });
            setNewArticle({ ...newArticle, location: `Fach ${maxNum + 1}` });
        }
    };

    // --- AI LOGIC (COPIED) ---
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
                    name: { type: Type.STRING, description: "Product name" },
                    compact_name_proposal: { type: Type.STRING, description: "Short SHK name" },
                    pattern_name_proposal: { type: Type.STRING, description: "Pattern name", nullable: true },
                    ean: { type: Type.STRING, description: "EAN" },
                    skus: { type: Type.ARRAY, items: { type: Type.STRING }, description: "SKUs" },
                    supplier_name: { type: Type.STRING, description: "Supplier" },
                    supplier_sku: { type: Type.STRING, description: "Supplier SKU" },
                    product_url: { type: Type.STRING, description: "Product URL", nullable: true }
                }
            };
            const systemPrompt = `Context: Known Suppliers: ${supplierNames}. Extract product data.`;

            let response;
            if (aiMode === 'image' && aiSelectedFile) {
                const reader = new FileReader();
                await new Promise((resolve) => { reader.onload = resolve; reader.readAsDataURL(aiSelectedFile); });
                const base64Data = (reader.result as string).split(',')[1];
                response = await ai.models.generateContent({
                    model: "gemini-3-flash-preview",
                    contents: [{ inlineData: { mimeType: aiSelectedFile.type, data: base64Data } }, { text: systemPrompt }],
                    config: { responseMimeType: "application/json", responseSchema: schema }
                });
            } else if (aiMode === 'link' && aiUrlInput) {
                const searchPrompt = `${systemPrompt} JSON schema: ${JSON.stringify(schema)} Link: ${aiUrlInput}`;
                response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: searchPrompt, config: { tools: [{ googleSearch: {} }] } });
            }

            if (response && response.text) {
                let text = response.text.trim(); if (text.startsWith('```')) text = text.replace(/^```(json)?\s*/, '').replace(/\s*```$/, '');
                setAiAnalysisResult(JSON.parse(text));
            }
        } catch (error: any) { alert("KI-Fehler: " + error.message); } finally { setIsAnalyzing(false); }
    };

    const applyAiResult = (selectedName: string) => {
        if (!aiAnalysisResult) return; const data = aiAnalysisResult;
        setNewArticle(prev => ({ ...prev, name: selectedName || data.name, ean: data.ean || prev.ean }));

        if (data.skus && Array.isArray(data.skus)) {
            setTempSkus(prev => {
                const existing = new Set(prev.map(s => s.sku));
                const newItems: ManufacturerSku[] = [];
                data.skus.forEach((foundSku: string) => { if (!existing.has(foundSku) && foundSku.trim()) { newItems.push({ sku: foundSku, isPreferred: prev.length === 0 && newItems.length === 0 }); existing.add(foundSku); } });
                return [...prev, ...newItems];
            });
        }
        if (data.supplier_name) {
            const match = suppliers.find(s => s.name.toLowerCase().includes(data.supplier_name.toLowerCase()));
            if (match) {
                setTempSuppliers(prev => {
                    if (prev.some(s => s.supplierId === match.id)) return prev;
                    return [...prev, { supplierId: match.id, supplierName: match.name, supplierSku: data.supplier_sku || '', url: data.product_url || (aiMode === 'link' ? aiUrlInput : ''), isPreferred: prev.length === 0 }];
                });
            }
        } else if (aiMode === 'link' && aiUrlInput) { setTempSupplierUrlInput(aiUrlInput); }
        setIsAiModalOpen(false);
    };

    // --- SAVE LOGIC ---
    const handleSaveArticle = async (force: boolean = false) => {
        if (!defaultWarehouseId) { alert("Kein Ziellager definiert."); return; }

        // DUPLICATE CHECK
        if (!force) {
            setIsSubmitting(true);
            const checks: Promise<{ type: string, value: string, id: string } | null>[] = [];

            // 1. Name Check
            if (newArticle.name) {
                checks.push(
                    supabase
                        .from('articles')
                        .select('id, name')
                        .eq('warehouse_id', defaultWarehouseId)
                        .ilike('name', newArticle.name)
                        .maybeSingle()
                        .then(({ data }) => data ? { type: 'Name', value: data.name, id: data.id } : null)
                );
            }

            // 2. Main SKU Check (Check against 'sku' column)
            // We check if ANY of the new SKUs exist as a primary 'sku' in the DB
            const checkSkus = tempSkus.map(s => s.sku).filter(Boolean);
            if (checkSkus.length > 0) {
                checks.push(
                    supabase
                        .from('articles')
                        .select('id, sku')
                        .in('sku', checkSkus) // Check if existing Primary SKU matches any new SKU
                        .maybeSingle() // Just finding one is enough to warn
                        .then(({ data }) => data ? { type: 'Hersteller-Nr.', value: data.sku, id: data.id } : null)
                );
            }

            // 3. Supplier SKU Check
            const checkSupSkus = tempSuppliers.map(s => s.supplierSku).filter(Boolean);
            if (checkSupSkus.length > 0) {
                checks.push(
                    supabase
                        .from('article_suppliers')
                        .select('article_id, supplier_sku')
                        .in('supplier_sku', checkSupSkus)
                        .maybeSingle()
                        .then(({ data }) => data ? { type: 'Lieferanten-Art.Nr.', value: data.supplier_sku, id: data.article_id } : null)
                );
            }

            const results = await Promise.all(checks);
            setIsSubmitting(false);

            const match = results.find(r => r !== null && r.id !== initialData?.id);

            if (match) {
                setDuplicateConfirmation({
                    isOpen: true,
                    onConfirm: () => handleSaveArticle(true),
                    message: `Ein Artikel mit ${match.type === 'Name' ? 'dem Namen' : 'der ' + match.type} "${match.value}" existiert bereits.`
                });
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const primarySup = tempSuppliers.find(s => s.isPreferred) || tempSuppliers[0];
            const primarySku = tempSkus.find(s => s.isPreferred) || tempSkus[0];

            const payload = {
                name: newArticle.name,
                sku: primarySku ? primarySku.sku : '',
                manufacturer_skus: tempSkus,
                ean: newArticle.ean,
                category: newArticle.category || 'Sonstiges',
                stock: Number(newArticle.stock),
                target_stock: Number(newArticle.targetStock),
                location: newArticle.location,
                supplier: primarySup ? primarySup.supplierName : '',
                supplier_sku: primarySup ? primarySup.supplierSku : '',
                product_url: primarySup ? primarySup.url : '',
                image_url: newArticle.image,
                warehouse_id: defaultWarehouseId,
            };

            let currentId = initialData?.id;
            if (mode === 'edit' && currentId) {
                await supabase.from('articles').update(payload).eq('id', currentId);
            } else {
                const { data } = await supabase.from('articles').insert(payload).select('id').single();
                if (data) currentId = data.id;
            }

            if (currentId) {
                await supabase.from('article_suppliers').delete().eq('article_id', currentId);
                const validSuppliers = tempSuppliers.filter(s => s.supplierId);
                if (validSuppliers.length > 0) {
                    const supplierInserts = validSuppliers.map(s => ({
                        article_id: currentId,
                        supplier_id: s.supplierId,
                        supplier_sku: s.supplierSku,
                        url: s.url,
                        is_preferred: !!s.isPreferred
                    }));
                    await supabase.from('article_suppliers').insert(supplierInserts);
                }
                onSaveSuccess(currentId);
                onClose();
            }
        } catch (err: any) { alert("Fehler: " + err.message); } finally { setIsSubmitting(false); }
    };

    // --- OTHER HELPERS ---
    const processFileUpload = async (file: File) => {
        try {
            setIsUploading(true); const fileExt = file.name.split('.').pop(); const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`; const filePath = `${fileName}`;
            const { error } = await supabase.storage.from('article-images').upload(filePath, file); if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from('article-images').getPublicUrl(filePath);
            setNewArticle(prev => ({ ...prev, image: publicUrl }));
        } catch (error: any) { console.error("Upload error:", error); alert("Fehler beim Upload: " + error.message); } finally { setIsUploading(false); }
    };

    // Simplified handlers
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) processFileUpload(e.target.files[0]); };
    const handleClipboardPasteGeneric = async (): Promise<File | null> => {
        try {
            if (!navigator.clipboard) throw new Error("Clipboard API not available");
            const items = await navigator.clipboard.read();
            for (const item of items) { const type = item.types.find(t => t.startsWith('image/')); if (type) { const blob = await item.getType(type); return new File([blob], `clipboard-${Date.now()}.png`, { type }); } }
            return null;
        } catch { return null; }
    };
    const handlePasteProductImage = async (e: React.MouseEvent) => { e.preventDefault(); const f = await handleClipboardPasteGeneric(); if (f) processFileUpload(f); };
    const handlePasteAiImage = async (e: React.MouseEvent) => { e.preventDefault(); const f = await handleClipboardPasteGeneric(); if (f) { setAiSelectedFile(f); const r = new FileReader(); r.onload = (ev) => setAiImagePreview(ev.target?.result as string); r.readAsDataURL(f); } };

    // Image Reuse Logic (Simplified for brevity but functional)
    const handleOpenImageReuse = async () => {
        setIsImageReuseModalOpen(true); setReuseLoading(true);
        // Fetch recent images
        const { data } = await supabase.from('articles').select('image_url, name, category, warehouse_id, updated_at').not('image_url', 'is', null).order('updated_at', { ascending: false }).limit(50);
        if (data) {
            const mapped: ReusableImage[] = data.map((items: any) => ({ url: items.image_url, articleNames: [items.name], categories: [items.category], warehouseIds: [items.warehouse_id], lastUsed: items.updated_at }));
            // Dedupe by URL
            const map = new Map(); mapped.forEach(m => map.set(m.url, m));
            setRecentImages(Array.from(map.values()));
        }
        setReuseLoading(false);
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden">
                <div className="w-full h-full sm:h-auto sm:max-h-[90vh] max-w-2xl bg-[#1a1d24] border-0 sm:border border-white/10 sm:rounded-2xl shadow-2xl flex flex-col">
                    <div className="p-4 sm:p-6 border-b border-white/10 flex justify-between items-center bg-white/5 sticky top-0 z-10 backdrop-blur-xl shrink-0">
                        <div className="flex items-center gap-3"><h2 className="text-xl font-bold text-white">{mode === 'edit' ? 'Artikel bearbeiten' : 'Neuer Artikel'}</h2><button onClick={() => setIsAiModalOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-400 hover:to-blue-400 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-purple-500/20 transition-all transform hover:scale-105"><Sparkles size={12} /><span>KI-Scan</span></button></div><button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 text-white/60 hover:text-white"><X size={20} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex flex-col gap-2 sm:w-32 shrink-0">
                                <div className="w-full h-32 rounded-2xl border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center relative overflow-hidden group hover:border-white/20 transition-all">
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                                    {isUploading ? <Loader2 className="animate-spin text-emerald-400" /> : newArticle.image ? <img src={newArticle.image} className="w-full h-full object-cover" /> : <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 text-white/30 cursor-pointer p-2 text-center"><ImageIcon size={24} /> <span className="text-[10px]">Bild wählen</span></div>}
                                    {newArticle.image && !isUploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2"><button onClick={() => setNewArticle(prev => ({ ...prev, image: '' }))} className="p-1 bg-red-500/20 text-red-300 rounded hover:bg-red-500/40"><Trash2 size={16} /></button></div>}
                                </div>
                                {!newArticle.image && !isUploading && (
                                    <>
                                        <button type="button" onClick={handlePasteProductImage} className="w-full py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-white/60 hover:text-white flex items-center justify-center gap-2 transition-colors"><Clipboard size={14} /> Einfügen</button>
                                        <button type="button" onClick={handleOpenImageReuse} className="w-full py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-white/60 hover:text-white flex items-center justify-center gap-2 transition-colors"><Paperclip size={14} /> Verknüpfen</button>
                                    </>
                                )}
                            </div>
                            <div className="flex-1 space-y-4">
                                <div><label className="text-xs text-white/50 mb-1 block font-medium">Bezeichnung</label><input className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-lg" placeholder="Was liegt im Regal?" value={newArticle.name} onChange={e => setNewArticle({ ...newArticle, name: e.target.value })} /></div>
                                <div><label className="text-xs text-white/50 mb-1 block font-medium">EAN / Barcode (Optional)</label><input className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50" placeholder="z.B. 401234567890" value={newArticle.ean} onChange={e => setNewArticle({ ...newArticle, ean: e.target.value })} /></div>
                            </div>
                        </div>

                        <div className="space-y-2"><label className="text-xs text-white/50 block font-medium flex items-center gap-1"><Hash size={12} /> Hersteller-Nr. / SKUs</label><div className="flex gap-2"><input className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 font-mono" value={tempSkuInput} onChange={e => setTempSkuInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTempSku()} placeholder="z.B. 123-456" /><Button type="button" onClick={() => addTempSku()} className="px-3 py-2 h-auto bg-white/10 hover:bg-white/20 border-white/10"><Plus size={16} /></Button></div><div className="flex flex-wrap gap-2">{tempSkus.map((s, idx) => (<div key={idx} className={`flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg border text-xs ${s.isPreferred ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-white/5 border-white/10 text-white/60'}`}>{editingSkuIndex === idx ? (<div className="flex items-center"><input className="bg-transparent border-b border-white/30 text-white w-20 focus:outline-none" value={editSkuValue} onChange={(e) => setEditSkuValue(e.target.value)} onBlur={saveEditingSku} onKeyDown={(e) => e.key === 'Enter' && saveEditingSku()} autoFocus /></div>) : (<span onClick={() => startEditingSku(idx)} className="cursor-pointer">{s.sku}</span>)}<div className="flex gap-1 ml-1 pl-1 border-l border-white/10"><button type="button" onClick={() => togglePreferredSku(idx)} className={`hover:text-white ${s.isPreferred ? 'text-emerald-400' : 'text-white/20'}`} title="Als Haupt-Nr. setzen"><Star size={10} fill={s.isPreferred ? "currentColor" : "none"} /></button><button type="button" onClick={() => removeTempSku(idx)} className="hover:text-rose-400 text-white/40"><X size={10} /></button></div></div>))}</div></div>

                        <div className="h-px bg-white/5 w-full" />
                        <div className="grid grid-cols-2 gap-4 sm:gap-6">
                            <div><label className="text-xs text-white/50 block mb-1">Regal (Kategorie)</label>{isManualCategory ? <div className="flex gap-2"><input className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white" value={newArticle.category} onChange={e => setNewArticle({ ...newArticle, category: e.target.value })} placeholder="Neues Regal benennen..." autoFocus />{existingCategories.length > 0 && <button type="button" onClick={() => setIsManualCategory(false)} className="p-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-white/60 hover:text-white" title="Aus Liste wählen"><Layers size={20} /></button>}</div> : <div className="flex gap-2"><div className="relative w-full group"><select className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-10 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-teal-500/50" value={newArticle.category} onChange={(e) => { if (e.target.value === '___NEW___') { setNewArticle({ ...newArticle, category: '' }); setIsManualCategory(true); } else { setNewArticle({ ...newArticle, category: e.target.value }); } }}><option value="" disabled className="bg-gray-900">Wählen...</option>{existingCategories.map(c => <option key={c} value={c} className="bg-gray-900 text-white">{c}</option>)}<option value="___NEW___" className="bg-gray-900 text-emerald-400 font-bold">+ Neues Regal erstellen</option></select><div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/50"><ChevronDown size={16} /></div></div></div>}</div>
                            <div><label className="text-xs text-white/50 block mb-1">Fach (Ort)</label><div className="flex gap-2"><input className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white" value={newArticle.location} onChange={e => setNewArticle({ ...newArticle, location: e.target.value })} placeholder="z.B. A-01" /><button type="button" onClick={handleAutoLocation} className="px-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-emerald-400 hover:text-emerald-300 transition-colors" title="Nächstes freies Fach generieren"><Wand2 size={18} /></button></div></div>
                            <div><label className="text-xs text-white/50 block mb-1 text-emerald-400">Ist-Bestand</label><input type="number" className="w-full bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 text-white font-bold" value={newArticle.stock} onChange={e => setNewArticle({ ...newArticle, stock: parseInt(e.target.value) || 0 })} /></div>
                            <div><label className="text-xs text-white/50 block mb-1 text-blue-400">Soll-Bestand</label><input type="number" className="w-full bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-white font-bold" value={newArticle.targetStock} onChange={e => setNewArticle({ ...newArticle, targetStock: parseInt(e.target.value) || 0 })} /></div>
                        </div>

                        <div className="h-px bg-white/5 w-full" />
                        <div className="space-y-4">
                            <div className="flex justify-between items-center"><label className="text-xs text-white/50 font-bold uppercase tracking-wider">Lieferanten & Preise</label></div>
                            <div className="bg-black/20 p-3 rounded-xl border border-white/5 space-y-3"><div className="flex gap-2"><GlassSelect className="flex-1 py-2 text-sm" value={tempSupplierSelect} onChange={(e) => setTempSupplierSelect(e.target.value)}><option value="" className="bg-gray-900 text-white">Lieferant wählen...</option>{suppliers.map(s => <option key={s.id} value={s.id} className="bg-gray-900 text-white">{s.name}</option>)}</GlassSelect><Button type="button" onClick={addTempSupplier} disabled={!tempSupplierSelect} className="px-4 py-2 h-auto text-xs">Hinzufügen</Button></div><div className="grid grid-cols-2 gap-2"><input className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" placeholder="Artikel-Nr. beim Händler" value={tempSupplierSkuInput} onChange={e => setTempSupplierSkuInput(e.target.value)} /><input className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" placeholder="URL zum Produkt" value={tempSupplierUrlInput} onChange={e => setTempSupplierUrlInput(e.target.value)} /></div></div>
                            <div className="space-y-2">{tempSuppliers.length === 0 && <div className="text-center text-xs text-white/30 py-2">Keine Lieferanten verknüpft.</div>}{tempSuppliers.map((s, idx) => (<div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${s.isPreferred ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/10'}`}><div className="flex-1 min-w-0 mr-4"><div className="flex items-center gap-2"><span className="font-bold text-sm text-white">{s.supplierName}</span>{s.isPreferred && <span className="text-[9px] bg-blue-500 text-white px-1.5 rounded-sm">Primär</span>}</div>{editingSupplierIndex === idx ? (<div className="grid grid-cols-2 gap-2 mt-2"><input className="bg-black/30 border border-white/20 rounded px-2 py-1 text-xs text-white" value={editSupplierData.supplierSku} onChange={e => setEditSupplierData({ ...editSupplierData, supplierSku: e.target.value })} placeholder="Art-Nr." /><input className="bg-black/30 border border-white/20 rounded px-2 py-1 text-xs text-white" value={editSupplierData.url} onChange={e => setEditSupplierData({ ...editSupplierData, url: e.target.value })} placeholder="URL" /><div className="col-span-2 flex justify-end gap-2"><button onClick={saveEditingSupplier} className="text-xs text-emerald-400 hover:underline">Speichern</button><button onClick={() => setEditingSupplierIndex(null)} className="text-xs text-white/50 hover:underline">Abbruch</button></div></div>) : (<div className="text-xs text-white/50 flex flex-col sm:flex-row sm:gap-3 mt-0.5"><span className="truncate">Art-Nr: {s.supplierSku || '-'}</span>{s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 hover:underline truncate max-w-[150px]"><LinkIcon size={10} /> Link</a>}</div>)}</div><div className="flex items-center gap-1">{editingSupplierIndex !== idx && (<><button type="button" onClick={() => startEditingSupplier(idx)} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white"><Edit size={14} /></button><button type="button" onClick={() => togglePreferredSupplier(idx)} className={`p-2 hover:bg-white/10 rounded-lg ${s.isPreferred ? 'text-blue-400' : 'text-white/20 hover:text-white'}`} title="Als Hauptlieferant setzen"><Star size={14} fill={s.isPreferred ? "currentColor" : "none"} /></button><button type="button" onClick={() => removeTempSupplier(idx)} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-rose-400"><Trash2 size={14} /></button></>)}</div></div>))}</div>
                        </div>
                    </div>
                    <div className="p-4 sm:p-6 border-t border-white/10 flex justify-end gap-3 bg-gray-900/95 sm:bg-black/20 rounded-none sm:rounded-b-2xl sticky bottom-0 z-10 backdrop-blur-xl shrink-0">
                        <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
                        <Button onClick={() => handleSaveArticle()} disabled={isSubmitting} className="min-w-[120px]">{isSubmitting ? <Loader2 className="animate-spin" /> : 'Speichern'}</Button>
                    </div>
                </div>
            </div>

            {/* AI SCAN MODAL */}
            {isAiModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-in fade-in zoom-in-95">
                    <GlassCard className="w-full max-w-lg flex flex-col p-0 overflow-hidden">
                        <div className="p-5 border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-blue-500/10 flex justify-between items-center">
                            <div className="flex items-center gap-2"><Sparkles size={20} className="text-purple-300" /><h3 className="text-lg font-bold text-white">KI-Artikel-Scan</h3></div>
                            <button onClick={() => setIsAiModalOpen(false)} className="text-white/50 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="p-6 flex flex-col gap-4">
                            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                                <button onClick={() => { setAiMode('image'); setAiAnalysisResult(null); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${aiMode === 'image' ? 'bg-white/10 text-white shadow' : 'text-white/40 hover:text-white'}`}>Bild</button>
                                <button onClick={() => { setAiMode('link'); setAiAnalysisResult(null); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${aiMode === 'link' ? 'bg-white/10 text-white shadow' : 'text-white/40 hover:text-white'}`}>Link / Text</button>
                            </div>
                            {!aiAnalysisResult ? (
                                <>
                                    {aiMode === 'image' && (
                                        <div className="relative w-full aspect-square rounded-xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center overflow-hidden group">
                                            {aiImagePreview ? (<><img src={aiImagePreview} className="w-full h-full object-contain p-2" /><div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setAiImagePreview(null); setAiSelectedFile(null); }} className="p-2 bg-red-500/20 text-red-200 rounded-full hover:bg-red-500/40"><Trash2 size={20} /></button></div></>) : (<div className="flex flex-col items-center gap-3 text-white/30"><FileImage size={40} strokeWidth={1.5} /><div className="flex flex-col gap-2 items-center"><button onClick={() => aiFileInputRef.current?.click()} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors">Datei wählen</button><span className="text-xs">oder</span><button onClick={handlePasteAiImage} className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-sm transition-colors flex items-center gap-2"><Clipboard size={14} /> Aus Zwischenablage</button></div></div>)}
                                            <input type="file" ref={aiFileInputRef} className="hidden" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) { setAiSelectedFile(e.target.files[0]); const r = new FileReader(); r.onload = (ev) => setAiImagePreview(ev.target?.result as string); r.readAsDataURL(e.target.files[0]); } }} />
                                        </div>
                                    )}
                                    {aiMode === 'link' && (
                                        <div className="space-y-3 py-6">
                                            <div className="text-sm text-white/60 mb-2">Füge einen Produktlink oder Text zur Analyse ein:</div>
                                            <div className="relative"><input className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pl-12 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="https://shop.lieferant.de/produkt/..." value={aiUrlInput} onChange={(e) => setAiUrlInput(e.target.value)} /><Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20} /></div>
                                        </div>
                                    )}
                                    <Button onClick={analyzeWithGemini} disabled={(aiMode === 'image' && !aiSelectedFile) || (aiMode === 'link' && !aiUrlInput.trim()) || isAnalyzing} className={`w-full bg-gradient-to-r from-purple-500 to-blue-500 border-none mt-4`}>{isAnalyzing ? <div className="flex items-center gap-2"><Loader2 className="animate-spin" /> Analysiere...</div> : <div className="flex items-center gap-2"><Wand2 size={18} /> Daten ausfüllen</div>}</Button>
                                </>
                            ) : (
                                <div className="space-y-4 animate-in fade-in">
                                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3"><CheckCircle2 size={24} className="text-emerald-400" /><div className="text-sm text-white">Analyse erfolgreich! Wähle einen Namen:</div></div>
                                    <div className="space-y-2">
                                        <div onClick={() => applyAiResult(aiAnalysisResult.name)} className="p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"><div className="text-[10px] text-white/40 uppercase font-bold mb-1">Original (gefunden)</div><div className="font-bold text-white">{aiAnalysisResult.name}</div></div>
                                        {aiAnalysisResult.compact_name_proposal && (<div onClick={() => applyAiResult(aiAnalysisResult.compact_name_proposal)} className="p-3 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 cursor-pointer transition-colors relative overflow-hidden"><div className="absolute top-0 right-0 p-1 bg-purple-500 text-white text-[9px] font-bold rounded-bl-lg">Empfohlen</div><div className="text-[10px] text-purple-200 uppercase font-bold mb-1 flex items-center gap-1"><TypeIcon size={10} /> Kurz & Knapp</div><div className="font-bold text-white">{aiAnalysisResult.compact_name_proposal}</div></div>)}
                                    </div>
                                    <button onClick={() => setAiAnalysisResult(null)} className="w-full py-2 text-xs text-white/40 hover:text-white mt-2">Zurück</button>
                                </div>
                            )}
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* REUSE IMAGE MODAL */}
            {isImageReuseModalOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in-95">
                    <GlassCard className="w-full max-w-3xl flex flex-col h-[80vh] p-0 overflow-hidden">
                        <div className="p-5 border-b border-white/10 bg-white/5 flex justify-between items-center">
                            <div><h3 className="text-lg font-bold text-white">Bild wiederverwenden</h3></div><button onClick={() => setIsImageReuseModalOpen(false)} className="text-white/50 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="p-4 border-b border-white/5 space-y-3">
                            <div className="text-sm text-white/40">Zuletzt verwendete Bilder werden angezeigt. (Vereinfachter Modus)</div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {reuseLoading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-emerald-400" /></div> : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                    {recentImages.map((img, idx) => (
                                        <button key={idx} onClick={() => { setNewArticle(prev => ({ ...prev, image: img.url })); setIsImageReuseModalOpen(false); }} className="aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-emerald-500/50 transition-all">
                                            <img src={img.url} className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* DUPLICATE WARNING MODAL */}
            {duplicateConfirmation && duplicateConfirmation.isOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95">
                    <GlassCard className="w-full max-w-sm p-6 border-l-4 border-l-amber-500 flex flex-col gap-4 shadow-2xl">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-amber-500/10 rounded-full text-amber-500 shrink-0">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Artikel existiert bereits!</h3>
                                <p className="text-sm text-white/60 mt-1">
                                    {duplicateConfirmation.message}
                                </p>
                                <p className="text-sm text-white/60 mt-2">
                                    Möchtest du ihn trotzdem als Duplikat anlegen?
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-2">
                            <Button variant="secondary" onClick={() => setDuplicateConfirmation(null)} className="text-xs">Abbrechen</Button>
                            <Button
                                onClick={() => {
                                    setDuplicateConfirmation(null);
                                    duplicateConfirmation.onConfirm();
                                }}
                                className="bg-amber-600 hover:bg-amber-500 text-white border-none text-xs"
                            >
                                Trotzdem anlegen
                            </Button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </>
    );
};
