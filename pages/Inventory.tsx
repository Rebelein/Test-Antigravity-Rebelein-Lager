
import React, { useState, useEffect, useRef } from 'react';
import { GlassCard, Button, GlassSelect, GlassInput } from '../components/UIComponents';
import { Article, Warehouse, Supplier, ManufacturerSku, ArticleSupplier } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { 
  Search, Plus, Loader2, Check, X, Link as LinkIcon, Sparkles, Edit, Trash2, ExternalLink, History, Minus, Image as ImageIcon, Hash, Wand2, Globe, Clipboard, FileImage, Printer, Layers, Type as TypeIcon, ListChecks, Copy, CheckSquare, Square, Paperclip, User, ChevronDown, ArrowUpDown, MapPin, Building2, Star, MoreHorizontal, CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI, Type } from "@google/genai";

interface StockMovement {
    id: string;
    amount: number;
    created_at: string;
    type: string;
    reference?: string;
    profiles: {
        full_name: string;
    } | null;
}

interface ReusableImage {
    url: string;
    articleNames: string[];
    categories: string[];
    warehouseIds: string[];
    lastUsed: string;
}

const Inventory: React.FC = () => {
  const { profile, user, loading: authLoading, updateWarehousePreference, toggleCategoryCollapse } = useAuth();
  const navigate = useNavigate();

  const [articles, setArticles] = useState<Article[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('Alle');
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: 'location' | 'name'; direction: 'asc' | 'desc' }>({ key: 'location', direction: 'asc' });
  
  // 'primary' = Lager, 'secondary' = Favorit
  const [viewMode, setViewMode] = useState<'primary' | 'secondary'>('primary');
  
  // Dropdown State
  const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ADD/EDIT MODAL STATE
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Category Selection State (Fix for Mobile)
  const [isManualCategory, setIsManualCategory] = useState(false);

  // DELETE MODAL STATE
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // IMAGE UPLOAD & AI STATE
  const [isUploading, setIsUploading] = useState(false);
  
  // IMAGE REUSE STATE
  const [isImageReuseModalOpen, setIsImageReuseModalOpen] = useState(false);
  const [reuseImages, setReuseImages] = useState<ReusableImage[]>([]);
  const [reuseLoading, setReuseLoading] = useState(false);
  const [reuseSearch, setReuseSearch] = useState('');
  const [reuseFilterWarehouse, setReuseFilterWarehouse] = useState('all');
  const [reuseFilterCategory, setReuseFilterCategory] = useState('all');
  const [warehouseCategoryMap, setWarehouseCategoryMap] = useState<Record<string, string[]>>({}); // Map WarehouseID -> [Categories]
  
  // AI MODAL STATE
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'image' | 'link'>('image');
  const [aiUrlInput, setAiUrlInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiImagePreview, setAiImagePreview] = useState<string | null>(null);
  const [aiSelectedFile, setAiSelectedFile] = useState<File | null>(null);
  
  // AI RESULT STATE (For selection before applying)
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  // MODAL LIST STATES (For arrays of data)
  const [tempSkus, setTempSkus] = useState<ManufacturerSku[]>([]);
  const [tempSkuInput, setTempSkuInput] = useState('');
  
  // Inline Editing State for SKUs
  const [editingSkuIndex, setEditingSkuIndex] = useState<number | null>(null);
  const [editSkuValue, setEditSkuValue] = useState('');

  const [tempSuppliers, setTempSuppliers] = useState<ArticleSupplier[]>([]);
  const [tempSupplierSelect, setTempSupplierSelect] = useState('');
  const [tempSupplierSkuInput, setTempSupplierSkuInput] = useState('');
  const [tempSupplierUrlInput, setTempSupplierUrlInput] = useState('');

  // Inline Editing State for Suppliers
  const [editingSupplierIndex, setEditingSupplierIndex] = useState<number | null>(null);
  const [editSupplierData, setEditSupplierData] = useState<{supplierId: string, supplierSku: string, url: string}>({ supplierId: '', supplierSku: '', url: '' });

  // DETAIL MODAL STATE
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingArticle, setViewingArticle] = useState<Article | null>(null);
  const [articleHistory, setArticleHistory] = useState<StockMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // LOCATION CONTENT MODAL STATE (New for Shelf Scanning)
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationModalTitle, setLocationModalTitle] = useState('');
  const [locationArticles, setLocationArticles] = useState<Article[]>([]);

  // QUICK BOOKING CARD STATE
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);
  const [quickStockAmount, setQuickStockAmount] = useState<number>(0);
  const [isBooking, setIsBooking] = useState(false);

  // CONTEXT MENU STATE (Fixed Positioning)
  const [contextMenu, setContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  
  // Derived State for Shelf Suggestions
  const [availableShelves, setAvailableShelves] = useState<string[]>([]);
  const distinctCategories = Array.from(new Set(articles.map(a => a.category))).filter(Boolean).sort();

  // --- SELECTION & COPY STATES ---
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(new Set());
  
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copyConfig, setCopyConfig] = useState({
      targetWarehouseId: '',
      targetCategory: '',
      targetLocation: '',
      stock: 0,
      targetStock: 0
  });
  // New states for Target Categories fetching
  const [targetWarehouseCategories, setTargetWarehouseCategories] = useState<string[]>([]);
  const [isManualTargetCategory, setIsManualTargetCategory] = useState(false);

  const [newArticle, setNewArticle] = useState({
    name: '',
    ean: '',
    category: '', // Acts as "Regal"
    stock: 0,
    targetStock: 0, // "Soll"
    location: '', // Acts as "Fach"
    image: ''
  });

  useEffect(() => {
    // Click outside listener for dropdowns
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsWarehouseDropdownOpen(false);
      }
      
      // Close context menu if clicking outside
      if (contextMenu && !(event.target as Element).closest('.context-menu-container')) {
        setContextMenu(null);
      }
    }

    // Close menu on scroll to prevent floating artifacts
    function handleScroll() {
        if (contextMenu) setContextMenu(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true); // Capture phase for nested scrolls
    
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("scroll", handleScroll, true);
    };
  }, [contextMenu]);

  // --- GLOBAL SCAN DETECTION ---
  useEffect(() => {
      // Detect Location QR Codes (Prefix: "LOC:") in search term
      if (searchTerm.startsWith('LOC:')) {
          const locName = searchTerm.substring(4).trim();
          // Open modal with content of this location
          handleLocationScan(locName);
          // Clear search to prevent filtering list by "LOC:..."
          setSearchTerm('');
      }
  }, [searchTerm]);
  
  // Reset Reuse Category when Warehouse changes
  useEffect(() => {
      setReuseFilterCategory('all');
  }, [reuseFilterWarehouse]);

  const handleLocationScan = (locationName: string) => {
      const articlesInShelf = articles.filter(a => a.location === locationName);
      
      if (articlesInShelf.length === 0) {
          alert(`Keine Artikel im Fach "${locationName}" gefunden.`);
          return;
      }

      setLocationModalTitle(locationName);
      setLocationArticles(articlesInShelf);
      setLocationModalOpen(true);
  };

  // Paste Event Listener for Image Upload
  useEffect(() => {
      const handleGlobalPaste = (e: ClipboardEvent) => {
          if (!isAddModalOpen && !isAiModalOpen) return;
          
          // Only handle if no input is focused
          if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) {
             return;
          }

          if (e.clipboardData && e.clipboardData.items) {
              const items = e.clipboardData.items;
              for (let i = 0; i < items.length; i++) {
                  if (items[i].type.indexOf('image') !== -1) {
                      e.preventDefault();
                      const blob = items[i].getAsFile();
                      if (blob) {
                          if (isAiModalOpen) {
                              setAiMode('image');
                              handleAiFileSelection(blob);
                          } else {
                              processFileUpload(blob);
                          }
                      }
                      break;
                  }
              }
          }
      };

      window.addEventListener('paste', handleGlobalPaste);
      return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [isAddModalOpen, isAiModalOpen]);

  // --- DATA FETCHING & REALTIME ---

  // Fetch initial data
  useEffect(() => {
    if (!authLoading) {
        fetchWarehouses();
        fetchSuppliers();
    }
  }, [authLoading]);

  // Fetch Articles
  useEffect(() => {
      if (!authLoading) {
          fetchArticles();
      }
  }, [authLoading, viewMode, profile?.primary_warehouse_id, profile?.secondary_warehouse_id]);

  // Fetch Target Categories when target changes in Copy Modal
  useEffect(() => {
    const fetchTargetCategories = async () => {
        if (!copyConfig.targetWarehouseId) {
            setTargetWarehouseCategories([]);
            return;
        }
        try {
            const { data } = await supabase
                .from('articles')
                .select('category')
                .eq('warehouse_id', copyConfig.targetWarehouseId);
            
            if (data) {
                const uniqueCats = Array.from(new Set(data.map((a: any) => a.category))).filter(Boolean).sort() as string[];
                setTargetWarehouseCategories(uniqueCats);
                setIsManualTargetCategory(uniqueCats.length === 0);
            }
        } catch (e) {
            console.error("Error fetching target categories", e);
        }
    };

    if (isCopyModalOpen) {
        fetchTargetCategories();
    }
  }, [copyConfig.targetWarehouseId, isCopyModalOpen]);

  // Realtime Subscription for Articles
  useEffect(() => {
      const channel = supabase
      .channel('articles-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'articles' },
        (payload) => {
            if (payload.eventType === 'INSERT') {
                 setArticles((prev) => [...prev, mapArticleFromDB(payload.new)]);
            } else if (payload.eventType === 'UPDATE') {
                setArticles((prev) => prev.map((a) => a.id === payload.new.id ? mapArticleFromDB(payload.new) : a));
            } else if (payload.eventType === 'DELETE') {
                setArticles((prev) => prev.filter((a) => a.id !== payload.old.id));
            }
        }
      )
      .subscribe();

      return () => {
          supabase.removeChannel(channel);
      };
  }, []);

  // Extract unique shelves
  useEffect(() => {
    if (articles.length > 0) {
      const shelves = Array.from(new Set(articles.map(a => a.category))).filter(Boolean).sort();
      setAvailableShelves(shelves);
    }
  }, [articles]);

  const mapArticleFromDB = (item: any): Article => ({
      id: item.id,
      name: item.name,
      sku: item.sku, // Legacy fallback
      manufacturerSkus: item.manufacturer_skus || [],
      stock: item.stock,
      targetStock: item.target_stock || item.min_stock || 0,
      location: item.location,
      category: item.category,
      price: item.price,
      supplier: item.supplier,
      warehouseId: item.warehouse_id,
      ean: item.ean,
      supplierSku: item.supplier_sku,
      productUrl: item.product_url,
      image: item.image_url,
      onOrderDate: item.on_order_date
  });

  const fetchWarehouses = async () => {
    const { data } = await supabase.from('warehouses').select('*').order('name');
    if (data) {
      setWarehouses(data.map((w: any) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        location: w.location
      })));
    }
  };

  const fetchSuppliers = async () => {
      const { data } = await supabase.from('suppliers').select('*').order('name');
      if (data) {
          setSuppliers(data);
      }
  };

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const activeWarehouseId = viewMode === 'primary' 
        ? profile?.primary_warehouse_id 
        : profile?.secondary_warehouse_id;

      let query = supabase.from('articles').select('*');
      
      if (activeWarehouseId) {
          query = query.eq('warehouse_id', activeWarehouseId);
      } else {
          query = query.eq('id', '00000000-0000-0000-0000-000000000000'); 
      }

      const { data, error } = await query;
      if (error) { console.error('Error fetching articles:', error); return; }
      if (data) setArticles(data.map(mapArticleFromDB));
    } catch (error) { console.error('Unexpected error:', error); } finally { setLoading(false); }
  };

  const fetchHistory = async (articleId: string) => {
      setHistoryLoading(true);
      try {
          const { data, error } = await supabase
              .from('stock_movements')
              .select('*, profiles:user_id (full_name)')
              .eq('article_id', articleId)
              .order('created_at', { ascending: false })
              .limit(5);
          
          if (error) throw error;
          setArticleHistory(data as any[]);
      } catch (err) { console.error("Error fetching history:", err); } finally { setHistoryLoading(false); }
  };

  const handleWarehouseChange = async (warehouseId: string) => {
    await updateWarehousePreference(viewMode, warehouseId);
    setIsWarehouseDropdownOpen(false);
  };

  const handleCopy = (text: string, field: string) => {
      if (!text || text === '-') return;
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
  };

  // --- IMAGE REUSE LOGIC ---
  
  const fetchReusableImages = async () => {
      setReuseLoading(true);
      setReuseSearch('');
      setReuseFilterWarehouse('all');
      setReuseFilterCategory('all');
      setWarehouseCategoryMap({});
      
      try {
          // Fetch ALL articles with images globally
          const { data, error } = await supabase
              .from('articles')
              .select('id, name, image_url, warehouse_id, category, created_at')
              .neq('image_url', null)
              .order('created_at', { ascending: false });
          
          if (error) throw error;
          
          // Deduplicate by URL & Build Warehouse Map
          const uniqueMap = new Map<string, ReusableImage>();
          const whCatMap: Record<string, Set<string>> = {};
          
          data.forEach((item: any) => {
              if (!item.image_url) return;
              
              // Build Warehouse -> Category Map
              if (item.warehouse_id && item.category) {
                  if (!whCatMap[item.warehouse_id]) whCatMap[item.warehouse_id] = new Set();
                  whCatMap[item.warehouse_id].add(item.category);
              }

              // Process Image Info
              if (uniqueMap.has(item.image_url)) {
                  const existing = uniqueMap.get(item.image_url)!;
                  // Merge info
                  if (!existing.articleNames.includes(item.name)) existing.articleNames.push(item.name);
                  if (item.category && !existing.categories.includes(item.category)) existing.categories.push(item.category);
                  if (item.warehouse_id && !existing.warehouseIds.includes(item.warehouse_id)) existing.warehouseIds.push(item.warehouse_id);
                  // Keep latest date
                  if (new Date(item.created_at) > new Date(existing.lastUsed)) existing.lastUsed = item.created_at;
              } else {
                  uniqueMap.set(item.image_url, {
                      url: item.image_url,
                      articleNames: [item.name],
                      categories: item.category ? [item.category] : [],
                      warehouseIds: item.warehouse_id ? [item.warehouse_id] : [],
                      lastUsed: item.created_at
                  });
              }
          });
          
          setReuseImages(Array.from(uniqueMap.values()));
          
          // Convert Set to Array for State
          const finalWhCatMap: Record<string, string[]> = {};
          Object.keys(whCatMap).forEach(key => {
              finalWhCatMap[key] = Array.from(whCatMap[key]).sort();
          });
          setWarehouseCategoryMap(finalWhCatMap);

      } catch (e) {
          console.error("Fetch reusable images failed", e);
      } finally {
          setReuseLoading(false);
      }
  };

  const handleOpenImageReuse = () => {
      setIsImageReuseModalOpen(true);
      fetchReusableImages();
  };

  const handleSelectReuseImage = (url: string) => {
      setNewArticle(prev => ({ ...prev, image: url }));
      setIsImageReuseModalOpen(false);
  };

  // Filtered Images logic
  const getFilteredReuseImages = () => {
      return reuseImages.filter(img => {
          const matchSearch = !reuseSearch || img.articleNames.some(n => n.toLowerCase().includes(reuseSearch.toLowerCase()));
          const matchWarehouse = reuseFilterWarehouse === 'all' || img.warehouseIds.includes(reuseFilterWarehouse);
          // If category filter is on, check if the image is used in that category
          const matchCategory = reuseFilterCategory === 'all' || img.categories.includes(reuseFilterCategory);
          
          return matchSearch && matchWarehouse && matchCategory;
      });
  };

  const filteredImages = getFilteredReuseImages();
  const showRecent = reuseSearch === '' && reuseFilterWarehouse === 'all' && reuseFilterCategory === 'all';
  const recentImages = showRecent ? filteredImages.slice(0, 5) : [];
  const displayImages = showRecent ? filteredImages : filteredImages;
  
  // Derived categories for filter based on loaded images AND selected warehouse
  const reuseCategories = Array.from(new Set(reuseImages.flatMap(i => i.categories))).sort();
  
  const currentReuseCategories = reuseFilterWarehouse === 'all' 
      ? reuseCategories 
      : (warehouseCategoryMap[reuseFilterWarehouse] || []);


  // --- SELECTION LOGIC ---

  const toggleSelectionMode = () => {
      if (isSelectionMode) {
          setIsSelectionMode(false);
          setSelectedArticleIds(new Set());
      } else {
          setIsSelectionMode(true);
      }
  };

  const toggleArticleSelection = (id: string) => {
      const newSet = new Set(selectedArticleIds);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      setSelectedArticleIds(newSet);
  };

  const toggleCategorySelection = (categoryArticles: Article[]) => {
      const newSet = new Set(selectedArticleIds);
      const allSelected = categoryArticles.every(a => newSet.has(a.id));
      categoryArticles.forEach(a => {
          if (allSelected) newSet.delete(a.id); else newSet.add(a.id);
      });
      setSelectedArticleIds(newSet);
  };

  const handleOpenCopyModal = () => {
      if (selectedArticleIds.size === 0) return;
      setCopyConfig({ targetWarehouseId: '', targetCategory: '', targetLocation: '', stock: 0, targetStock: 0 });
      setIsManualTargetCategory(false);
      setTargetWarehouseCategories([]);
      setIsCopyModalOpen(true);
  };

  const handleAutoLocationForCopy = async () => {
      if (!copyConfig.targetWarehouseId || !copyConfig.targetCategory) return;
      const { data } = await supabase.from('articles').select('location').eq('warehouse_id', copyConfig.targetWarehouseId).eq('category', copyConfig.targetCategory);
      if (data) {
          let maxNum = 0;
          data.forEach((a: any) => {
              const match = a.location?.match(/(\d+)/);
              if (match) { const num = parseInt(match[1]); if (num > maxNum) maxNum = num; }
          });
          setCopyConfig(prev => ({ ...prev, targetLocation: `Fach ${maxNum + 1}` }));
      }
  };

  const executeBulkCopy = async () => {
      if (!copyConfig.targetWarehouseId || !copyConfig.targetCategory || !copyConfig.targetLocation) { alert("Bitte Lager, Regal und Fach angeben."); return; }
      setIsSubmitting(true);
      try {
          const selectedArticles = articles.filter(a => selectedArticleIds.has(a.id));
          for (const article of selectedArticles) {
              const payload = {
                  name: article.name, sku: article.sku, manufacturer_skus: article.manufacturerSkus, ean: article.ean,
                  category: copyConfig.targetCategory, stock: copyConfig.stock, target_stock: copyConfig.targetStock, location: copyConfig.targetLocation,
                  supplier: article.supplier, supplier_sku: article.supplierSku, product_url: article.productUrl, image_url: article.image, warehouse_id: copyConfig.targetWarehouseId,
              };
              const { data: newArt, error } = await supabase.from('articles').insert(payload).select('id').single();
              if (error) throw error;
              if (newArt) {
                  const { data: existingSuppliers } = await supabase.from('article_suppliers').select('*').eq('article_id', article.id);
                  if (existingSuppliers && existingSuppliers.length > 0) {
                      const newSupplierLinks = existingSuppliers.map(s => ({ article_id: newArt.id, supplier_id: s.supplier_id, supplier_sku: s.supplier_sku, url: s.url, is_preferred: s.is_preferred }));
                      await supabase.from('article_suppliers').insert(newSupplierLinks);
                  }
              }
          }
          alert(`${selectedArticles.length} Artikel erfolgreich kopiert!`);
          setIsCopyModalOpen(false); setIsSelectionMode(false); setSelectedArticleIds(new Set());
      } catch (e: any) { alert("Fehler beim Kopieren: " + e.message); } finally { setIsSubmitting(false); }
  };


  // --- MODAL HELPERS ---

  const resetModalForm = () => {
    setNewArticle({ name: '', ean: '', category: '', stock: 0, targetStock: 0, location: '', image: '' });
    setTempSkus([]); setTempSuppliers([]); setTempSkuInput(''); setTempSupplierSelect(''); setTempSupplierSkuInput(''); setTempSupplierUrlInput('');
    setIsUploading(false); setEditingSkuIndex(null); setEditingSupplierIndex(null); setIsManualCategory(false);
  };

  const openNewArticleModal = () => {
    setIsEditMode(false); setEditingId(null); resetModalForm(); setIsAddModalOpen(true);
  };

  const handleQuickAddToCategory = (e: React.MouseEvent, categoryName: string) => {
    e.stopPropagation(); setIsEditMode(false); setEditingId(null); resetModalForm();
    setNewArticle(prev => ({ ...prev, category: categoryName })); setIsManualCategory(false); setIsAddModalOpen(true);
  };

  const openEditArticleModal = async (article: Article) => {
      setContextMenu(null); 
      setIsEditMode(true); 
      setEditingId(article.id);
      
      setNewArticle({ 
          name: article.name, 
          ean: article.ean || '', 
          category: article.category || '', 
          stock: article.stock, 
          targetStock: article.targetStock, 
          location: article.location || '', 
          image: article.image || '' 
      });
      
      const exists = distinctCategories.includes(article.category || ''); 
      setIsManualCategory(!exists && !!article.category);
      
      if (article.manufacturerSkus && article.manufacturerSkus.length > 0) {
          setTempSkus(article.manufacturerSkus); 
      } else if (article.sku) {
          setTempSkus([{ sku: article.sku, isPreferred: true }]); 
      } else {
          setTempSkus([]);
      }

      // Load Suppliers from article_suppliers
      const { data: supData } = await supabase.from('article_suppliers').select('*, suppliers(name)').eq('article_id', article.id);
      
      if (supData && supData.length > 0) {
          setTempSuppliers(supData.map((s: any) => ({ 
              supplierId: s.supplier_id, 
              supplierName: s.suppliers?.name, 
              supplierSku: s.supplier_sku, 
              url: s.url, 
              isPreferred: !!s.is_preferred  // FIX: Force boolean
          })));
      } else if (article.supplier) {
          // Legacy fallback
          const sObj = suppliers.find(s => s.name === article.supplier);
          if (sObj) setTempSuppliers([{ 
              supplierId: sObj.id, 
              supplierName: sObj.name, 
              supplierSku: article.supplierSku || '', 
              url: article.productUrl || '', 
              isPreferred: true 
          }]);
      } else {
          setTempSuppliers([]);
      }
      
      setIsAddModalOpen(true);
  };

  const openDetailModal = (article: Article) => {
      setContextMenu(null); setViewingArticle(article); setIsDetailModalOpen(true); fetchHistory(article.id);
  };

  const openAiScanModal = () => {
      setAiImagePreview(null); setAiSelectedFile(null); setAiAnalysisResult(null); setAiUrlInput(''); setAiMode('image'); setIsAnalyzing(false); setIsAiModalOpen(true);
  };

  // --- LOGIC: SKU & SUPPLIER LISTS ---
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

  const handleAutoLocation = () => {
      const categoryArticles = articles.filter(a => a.category === newArticle.category); let maxNum = 0;
      categoryArticles.forEach(a => { const match = a.location?.match(/(\d+)/); if (match) { const num = parseInt(match[1]); if (num > maxNum) maxNum = num; } });
      setNewArticle({ ...newArticle, location: `Fach ${maxNum + 1}` });
  };

  // --- AI AUTO FILL (UPDATED) ---

  const handleAiFileSelection = (file: File) => {
      setAiSelectedFile(file); const reader = new FileReader(); reader.onload = (e) => setAiImagePreview(e.target?.result as string); reader.readAsDataURL(file);
  };

  const getApiKey = () => {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
      try { if (process.env.API_KEY) return process.env.API_KEY; } catch (e) {} return '';
  };

  const analyzeWithGemini = async () => {
      setIsAnalyzing(true); setAiAnalysisResult(null); const apiKey = getApiKey();
      if (!apiKey) { alert("Fehler: API Key nicht gefunden."); setIsAnalyzing(false); return; }
      try {
          // Inject known suppliers list for context
          const supplierNames = suppliers.map(s => s.name).join(', ');
          const existingNames = articles.slice(-50).map(a => a.name).join('\n');
          
          const ai = new GoogleGenAI({ apiKey: apiKey });
          
          // Schema: Removed image_url
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
          
          const systemPrompt = `
            Context:
            Known Suppliers: ${supplierNames}.
            Recent Articles: ${existingNames}
            Extract product data.
            Rules:
            1. If a supplier from the list is detected (name/logo), return its EXACT name in 'supplier_name'.
            2. For 'supplier_sku' (Vendor Article Number), prioritize numbers labeled "OEG-Nr.", "Art-Nr.", "Bestell-Nr." or similar. Check near price/buy button.
            3. "skus" should contain manufacturer part numbers.
            4. Do NOT extract images.
          `;

          let response;
          if (aiMode === 'image' && aiSelectedFile) {
               const reader = new FileReader();
               await new Promise((resolve) => { reader.onload = resolve; reader.readAsDataURL(aiSelectedFile); });
               const base64Data = (reader.result as string).split(',')[1];
               response = await ai.models.generateContent({ 
                   model: "gemini-2.5-flash", 
                   contents: [
                       { inlineData: { mimeType: aiSelectedFile.type, data: base64Data } }, 
                       { text: systemPrompt }
                   ], 
                   config: { responseMimeType: "application/json", responseSchema: schema } 
               });
          } else if (aiMode === 'link' && aiUrlInput) {
               const searchPrompt = `${systemPrompt} JSON schema: ${JSON.stringify(schema)} Link: ${aiUrlInput}`;
               response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: searchPrompt, config: { tools: [{ googleSearch: {} }] } });
          }

          if (response && response.text) {
              let text = response.text.trim(); if (text.startsWith('```')) text = text.replace(/^```(json)?\s*/, '').replace(/\s*```$/, '');
              setAiAnalysisResult(JSON.parse(text));
          }
      } catch (error: any) { alert("KI-Fehler: " + error.message); } finally { setIsAnalyzing(false); }
  };

  const applyAiResult = (selectedName: string) => {
      if (!aiAnalysisResult) return; const data = aiAnalysisResult;
      
      // Removed AI Image logic completely as requested
      // We keep existing image if present, or user adds manually
      
      setNewArticle(prev => ({ 
          ...prev, 
          name: selectedName || data.name, 
          ean: data.ean || prev.ean, 
          // Keep existing image
      }));
      
      if (data.skus && Array.isArray(data.skus)) {
          setTempSkus(prev => { const existing = new Set(prev.map(s => s.sku)); const newItems: ManufacturerSku[] = []; data.skus.forEach((foundSku: string) => { if (!existing.has(foundSku) && foundSku.trim()) { newItems.push({ sku: foundSku, isPreferred: prev.length === 0 && newItems.length === 0 }); existing.add(foundSku); } }); return [...prev, ...newItems]; });
      }
      
      // Auto-Link Supplier if found
      if (data.supplier_name) {
          // Fuzzy match against known suppliers list
          const match = suppliers.find(s => s.name.toLowerCase().includes(data.supplier_name.toLowerCase()));
          
          if (match) { 
              setTempSuppliers(prev => { 
                  // Avoid duplicates
                  if (prev.some(s => s.supplierId === match.id)) return prev; 
                  
                  return [...prev, { 
                      supplierId: match.id, 
                      supplierName: match.name, 
                      supplierSku: data.supplier_sku || '', 
                      url: data.product_url || (aiMode === 'link' ? aiUrlInput : ''), 
                      isPreferred: prev.length === 0 
                  }]; 
              }); 
          }
      } else if (aiMode === 'link' && aiUrlInput) {
          // Fallback: If no supplier detected but link present, set it as temp URL
          setTempSupplierUrlInput(aiUrlInput);
      }
      
      setIsAiModalOpen(false);
  };

  // --- IMAGE UPLOAD LOGIC ---
  const processFileUpload = async (file: File) => {
      try {
          setIsUploading(true); const fileExt = file.name.split('.').pop(); const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`; const filePath = `${fileName}`;
          const { error } = await supabase.storage.from('article-images').upload(filePath, file); if (error) throw error;
          const { data: { publicUrl } } = supabase.storage.from('article-images').getPublicUrl(filePath);
          setNewArticle(prev => ({ ...prev, image: publicUrl }));
      } catch (error: any) { console.error("Upload error:", error); if (!isAnalyzing) alert("Fehler beim Upload: " + error.message); } finally { setIsUploading(false); }
  };

  const handleClipboardPasteGeneric = async (): Promise<File | null> => {
      try {
          if (typeof navigator === 'undefined' || !navigator.clipboard) throw new Error("Clipboard API not available");
          const clipboardItems = await navigator.clipboard.read();
          for (const item of clipboardItems) { const imageType = item.types.find(type => type.startsWith('image/')); if (imageType) { const blob = await item.getType(imageType); return new File([blob], `clipboard-${Date.now()}.png`, { type: imageType }); } }
          alert("Kein Bild gefunden."); return null;
      } catch (err: any) { console.error("Clipboard failed:", err); return null; }
  };

  const handlePasteProductImage = async (e: React.MouseEvent) => { e.preventDefault(); const file = await handleClipboardPasteGeneric(); if (file) processFileUpload(file); };
  const handlePasteAiImage = async (e: React.MouseEvent) => { e.preventDefault(); const file = await handleClipboardPasteGeneric(); if (file) handleAiFileSelection(file); };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0) processFileUpload(e.target.files[0]); };
  const handleAiFileSelectInput = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0) handleAiFileSelection(e.target.files[0]); };
  const handleImageRemove = (e: React.MouseEvent) => { e.stopPropagation(); setNewArticle(prev => ({ ...prev, image: '' })); if (fileInputRef.current) fileInputRef.current.value = ''; };


  // --- QUICK BOOKING ACTIONS ---
  const handleCardClick = (article: Article) => {
    if (isSelectionMode) { toggleArticleSelection(article.id); return; }
    if (expandedArticleId === article.id) { setExpandedArticleId(null); return; }
    setContextMenu(null); setExpandedArticleId(article.id); setQuickStockAmount(0);
  };

  const handleCancelQuickBook = (e: React.MouseEvent) => { e.stopPropagation(); setExpandedArticleId(null); };

  const handleQuickSave = async (e: React.MouseEvent, articleId: string) => {
      e.stopPropagation(); setIsBooking(true);
      try {
          if (!user) throw new Error("Kein Benutzer"); const article = articles.find(a => a.id === articleId); if (!article) throw new Error("Artikel fehlt");
          const newStock = article.stock + quickStockAmount; const updates: any = { stock: newStock }; if (quickStockAmount > 0 && article.onOrderDate) updates.on_order_date = null;
          setArticles(prev => prev.map(a => a.id === articleId ? { ...a, stock: newStock, onOrderDate: quickStockAmount > 0 ? null : a.onOrderDate } : a));
          await supabase.from('articles').update(updates).eq('id', articleId);
          if (quickStockAmount !== 0) { await supabase.from('stock_movements').insert({ article_id: articleId, user_id: user.id, amount: quickStockAmount, type: quickStockAmount > 0 ? 'manual_add' : 'manual_remove', reference: 'Schnellbuchung' }); }
          setExpandedArticleId(null); setQuickStockAmount(0);
      } catch (err: any) { alert("Fehler: " + err.message); } finally { setIsBooking(false); }
  };

  const incrementStock = (e: React.MouseEvent) => { e.stopPropagation(); setQuickStockAmount(prev => prev + 1); };
  const decrementStock = (e: React.MouseEvent) => { e.stopPropagation(); setQuickStockAmount(prev => prev - 1); };

  const handleContextMenuClick = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      
      // Align the right edge of the menu with the right edge of the button
      // Assuming w-48 (12rem) = approx 192px
      const MENU_WIDTH = 192; 
      let x = rect.right - MENU_WIDTH;
      
      // Safety check for small screens (don't go off the left edge)
      if (x < 10) x = 10;

      setContextMenu({ 
          id, 
          x: x, 
          y: rect.bottom + 5 
      });
  };

  const handleDeleteArticle = (id: string) => { setContextMenu(null); setDeleteTargetId(id); setShowDeleteModal(true); };

  const executeDelete = async () => {
      if (!deleteTargetId) return;
      try { const { error } = await supabase.from('articles').delete().eq('id', deleteTargetId); if (error) throw error; setShowDeleteModal(false); setDeleteTargetId(null); } catch (err: any) { alert("Fehler: " + err.message); }
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault(); 
    const targetWarehouseId = viewMode === 'primary' ? profile?.primary_warehouse_id : profile?.secondary_warehouse_id;
    if (!targetWarehouseId) { alert("Bitte Lager wählen."); return; }
    
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
            warehouse_id: targetWarehouseId, 
        };
        
        let currentId = editingId;
        if (isEditMode && editingId) { 
            await supabase.from('articles').update(payload).eq('id', editingId); 
        } else { 
            const { data } = await supabase.from('articles').insert(payload).select('id').single(); 
            if(data) currentId = data.id; 
        }
        
        if (currentId) { 
            // Delete existing suppliers for this article
            await supabase.from('article_suppliers').delete().eq('article_id', currentId); 
            
            // Filter out invalid items (e.g. missing ID)
            const validSuppliers = tempSuppliers.filter(s => s.supplierId);
            
            if (validSuppliers.length > 0) { 
                const supplierInserts = validSuppliers.map(s => ({ 
                    article_id: currentId, 
                    supplier_id: s.supplierId,  // Mapping: supplierId (state) -> supplier_id (DB)
                    supplier_sku: s.supplierSku, // Mapping: supplierSku (state) -> supplier_sku (DB)
                    url: s.url, 
                    is_preferred: !!s.isPreferred // FIX: Explicit boolean cast to prevent null
                })); 
                
                const { error } = await supabase.from('article_suppliers').insert(supplierInserts); 
                if (error) console.error("Error saving suppliers:", error);
            } 
        }
        setIsAddModalOpen(false);
    } catch (err: any) { 
        alert("Fehler: " + err.message); 
    } finally { 
        setIsSubmitting(false); 
    }
  };
  
  const handlePrintLabel = (article: Article) => { setContextMenu(null); navigate('/labels'); };

  // --- SORTING HELPER ---
  const sortArticles = (a: Article, b: Article) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      if (sortConfig.key === 'location') {
          // Natural sort for strings with numbers (e.g., "Fach 2" before "Fach 10")
          const locA = a.location || '';
          const locB = b.location || '';
          return locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' }) * dir;
      } else {
          // Name sort
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) * dir;
      }
  };

  const groupedArticles = articles
    .filter(a => { if (activeFilter === 'Unter Soll') return a.stock < a.targetStock; if (activeFilter === 'Bestellt') return !!a.onOrderDate; return true; })
    .filter(article => article.name.toLowerCase().includes(searchTerm.toLowerCase()) || article.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort(sortArticles) // Apply Sorting
    .reduce((acc, article) => { const cat = article.category || 'Sonstiges'; if (!acc[cat]) acc[cat] = []; acc[cat].push(article); return acc; }, {} as Record<string, Article[]>);

  const currentWarehouseId = viewMode === 'primary' ? profile?.primary_warehouse_id : profile?.secondary_warehouse_id;
  const currentWarehouse = warehouses.find(w => w.id === currentWarehouseId);
  const contextMenuArticle = contextMenu ? articles.find(a => a.id === contextMenu.id) : null;

  if (loading || authLoading) return <div className="flex flex-col items-center justify-center h-[60vh] text-white/50"><Loader2 size={40} className="animate-spin mb-4 text-emerald-400" /><p>Lade Lagerbestand...</p></div>;

  return (
    <div className="space-y-6 pb-24 relative">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-200">Lagerbestand</h1>
        <div className="flex gap-3">
          <Button variant={isSelectionMode ? 'secondary' : 'primary'} className={`transition-colors ${isSelectionMode ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70 hover:text-white'}`} onClick={toggleSelectionMode} icon={isSelectionMode ? <CheckSquare size={18}/> : <ListChecks size={18} />}>{isSelectionMode ? 'Fertig' : 'Auswahl'}</Button>
          <Button variant="primary" icon={<Plus size={18} />} onClick={openNewArticleModal}>Neu</Button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex flex-col gap-4 shadow-lg sticky top-0 z-30">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
            <div className="flex items-center gap-2 w-full sm:w-auto bg-black/20 p-1 rounded-xl border border-white/5">
                <button onClick={() => setViewMode('primary')} className={`px-4 py-2 rounded-lg text-sm font-medium ${viewMode === 'primary' ? 'bg-emerald-600 text-white' : 'text-white/50'}`}>Lager</button>
                <button onClick={() => setViewMode('secondary')} className={`px-4 py-2 rounded-lg text-sm font-medium ${viewMode === 'secondary' ? 'bg-blue-600 text-white' : 'text-white/50'}`}>Favorit</button>
            </div>
            <div className="relative flex-1 sm:flex-none min-w-[140px]" ref={dropdownRef}>
                 <button onClick={() => setIsWarehouseDropdownOpen(!isWarehouseDropdownOpen)} className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#1a1d24] border border-white/10 text-sm text-white shadow-lg backdrop-blur-xl hover:bg-white/5 transition-colors"><span className="truncate font-medium">{currentWarehouse ? currentWarehouse.name : 'Wählen...'}</span><ChevronDown size={14} className={`transition-transform duration-200 ${isWarehouseDropdownOpen ? 'rotate-180' : ''}`} /></button>
                {isWarehouseDropdownOpen && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-[#1a1d24] border border-white/10 rounded-xl z-50 shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in zoom-in-95 origin-top-left">
                        <div className="max-h-60 overflow-y-auto p-1 space-y-1">
                            {warehouses.map(w => (
                                <button key={w.id} onClick={() => handleWarehouseChange(w.id)} className={`w-full text-left px-3 py-2.5 text-sm rounded-lg flex items-center justify-between group ${currentWarehouseId === w.id ? 'bg-emerald-500/10 text-emerald-400 font-medium' : 'text-white hover:bg-white/5'}`}><span>{w.name}</span>{currentWarehouseId === w.id && <Check size={14}/>}</button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <div className="flex items-center bg-black/20 border border-white/5 rounded-xl px-3 py-2 flex-1 w-full">
                <Search size={16} className="text-white/40 mr-2" />
                <input type="text" placeholder="Suchen... (oder 'LOC:...' scannen)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-sm text-white w-full" />
            </div>
        </div>
        
        {/* Filters & Sorting Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 overflow-x-auto no-scrollbar pb-1">
            <div className="flex items-center gap-2">
                {['Alle', 'Unter Soll', 'Bestellt'].map((filter) => (
                    <button key={filter} onClick={() => setActiveFilter(filter)} className={`px-3 py-1.5 rounded-lg text-sm border whitespace-nowrap ${activeFilter === filter ? 'bg-white/10 text-white border-white/10' : 'text-white/50 border-transparent hover:text-white'}`}>{filter}</button>
                ))}
            </div>
            
            <div className="w-full sm:w-auto">
                <GlassSelect 
                    icon={<ArrowUpDown size={14} />} 
                    value={`${sortConfig.key}-${sortConfig.direction}`} 
                    onChange={(e) => {
                        const [key, direction] = e.target.value.split('-');
                        setSortConfig({ key: key as any, direction: direction as any });
                    }}
                    className="w-full sm:w-auto text-xs py-1.5 pl-9 pr-8 bg-black/20 border-white/5"
                >
                    <option value="location-asc" className="bg-gray-900">Fach Nr. (Aufsteigend)</option>
                    <option value="location-desc" className="bg-gray-900">Fach Nr. (Absteigend)</option>
                    <option value="name-asc" className="bg-gray-900">Name (A-Z)</option>
                    <option value="name-desc" className="bg-gray-900">Name (Z-A)</option>
                </GlassSelect>
            </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-6">
        {Object.entries(groupedArticles).map(([category, grpArticles]: [string, Article[]]) => {
          const isCollapsed = profile?.collapsed_categories?.includes(category) || false;
          const isCatSelected = isSelectionMode && grpArticles.every(a => selectedArticleIds.has(a.id));
          return (
            <div key={category} className="space-y-3">
              <div className="flex items-center justify-between px-2 pt-2 cursor-pointer hover:bg-white/5 rounded-lg transition-colors group">
                <div className="flex items-center gap-3 w-full" onClick={() => toggleCategoryCollapse(category)}>
                    {isSelectionMode && <div onClick={(e) => { e.stopPropagation(); toggleCategorySelection(grpArticles); }} className="text-white/50 hover:text-white">{isCatSelected ? <CheckSquare size={20} className="text-emerald-400" /> : <Square size={20} />}</div>}
                    <div className="flex items-center gap-2"><ChevronDown size={18} className={`transition-transform duration-300 ${isCollapsed ? '-rotate-90' : ''} text-white/50`} /><h2 className="text-base font-semibold text-white/90">{category}</h2><span className="text-[10px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded-md">{grpArticles.length}</span></div>
                </div>
                {!isSelectionMode && <button onClick={(e) => handleQuickAddToCategory(e, category)} className="p-2 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 rounded-full transition-colors opacity-0 group-hover:opacity-100" title={`Neu in ${category}`}><Plus size={20} /></button>}
              </div>
              <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}>
                <div className="overflow-hidden">
                    <div className="flex flex-col gap-2 pb-2">
                        {grpArticles.map((article) => {
                            const isOrdered = !!article.onOrderDate; const isTargetReached = article.stock >= article.targetStock; const isExpanded = expandedArticleId === article.id; const isSelected = selectedArticleIds.has(article.id);
                            if (isExpanded) {
                                return (
                                    <div key={article.id} onClick={() => handleCardClick(article)} className="flex flex-col gap-4 p-3 rounded-xl bg-white/5 border shadow-lg cursor-pointer border-emerald-500/20">
                                         <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 flex-1">
                                                <button onClick={decrementStock} className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 text-white"><Minus size={18} /></button>
                                                <input type="number" className="w-full h-10 text-center bg-white/5 rounded-lg text-white" value={quickStockAmount} onChange={(e) => setQuickStockAmount(Number(e.target.value))} onClick={(e) => e.stopPropagation()}/>
                                                <button onClick={incrementStock} className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 text-white"><Plus size={18} /></button>
                                            </div>
                                            <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                                                <button onClick={handleCancelQuickBook} className="w-10 h-10 flex items-center justify-center text-white/40"><X size={20} /></button>
                                                <button onClick={(e) => handleQuickSave(e, article.id)} className="px-4 h-10 rounded-lg bg-emerald-500 text-white text-sm">{isBooking ? <Loader2 className="animate-spin" /> : 'Buchen'}</button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <div key={article.id} onClick={() => handleCardClick(article)} className={`group relative flex items-center gap-3 p-2 pr-4 rounded-xl transition-all border cursor-pointer ${isSelectionMode && isSelected ? 'bg-emerald-500/20 border-emerald-500/50' : isTargetReached ? 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/20'}`}>
                                    {isSelectionMode && <div className={`shrink-0 mr-1 text-white/50 ${isSelected ? 'text-emerald-400' : ''}`}>{isSelected ? <CheckSquare size={24} /> : <Square size={24} />}</div>}
                                    <div onClick={(e) => { e.stopPropagation(); openDetailModal(article); }} className="w-12 h-12 shrink-0 rounded-lg bg-black/20 overflow-hidden relative border border-white/5 cursor-pointer hover:opacity-80 transition-opacity"><img src={article.image || `https://picsum.photos/seed/${article.id}/200/200`} className="w-full h-full object-cover opacity-80" /></div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <h3 className="font-medium text-white text-sm truncate">{article.name}</h3>
                                        <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                                            <span className="font-mono tracking-tight">{article.sku}</span>
                                            <span className="truncate text-white/50 flex items-center gap-1"><MapPin size={10} /> {article.location}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                                            {/* Supplier Name Badge */}
                                            {article.supplier && (
                                                <div 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        if (article.productUrl) window.open(article.productUrl, '_blank');
                                                    }}
                                                    className={`
                                                        flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-all
                                                        ${article.productUrl ? 'cursor-pointer hover:bg-blue-500/20' : ''}
                                                        bg-blue-500/10 border-blue-500/20 text-blue-200
                                                    `}
                                                    title={article.productUrl ? "Zum Shop öffnen" : "Lieferant"}
                                                >
                                                    <Building2 size={10} />
                                                    <span className="truncate max-w-[100px]">{article.supplier}</span>
                                                    {article.productUrl && <ExternalLink size={8} className="opacity-70" />}
                                                </div>
                                            )}

                                            {/* Supplier SKU Badge */}
                                            {article.supplierSku && (
                                                <div 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCopy(article.supplierSku!, `${article.id}-suppSku`);
                                                    }}
                                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-purple-500/10 border-purple-500/20 text-purple-200 cursor-pointer hover:bg-purple-500/20 transition-all"
                                                    title="Artikelnummer kopieren"
                                                >
                                                    {copiedField === `${article.id}-suppSku` ? <Check size={10} /> : <Hash size={10} />}
                                                    <span className="font-mono">{article.supplierSku}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right flex flex-col items-end">
                                            <div className="flex items-baseline gap-1">
                                                <span className={`text-sm font-bold ${isTargetReached ? 'text-emerald-400' : 'text-rose-400'}`}>{article.stock}</span>
                                                <span className="text-[10px] text-white/30">/ {article.targetStock}</span>
                                            </div>
                                        </div>
                                        {!isSelectionMode && <button onClick={(e) => handleContextMenuClick(e, article.id)} className="p-1.5 text-white/20 hover:text-white rounded-lg hover:bg-white/10"><MoreHorizontal size={16} /></button>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* SELECTION ACTIONS */}
      {isSelectionMode && selectedArticleIds.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 p-4 z-[90] flex justify-center animate-in slide-in-from-bottom-5">
              <div className="bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-3 flex items-center gap-4 max-w-lg w-full">
                  <div className="pl-2 font-bold text-white whitespace-nowrap">{selectedArticleIds.size} Ausgewählt</div>
                  <div className="h-6 w-px bg-white/20"></div>
                  <Button onClick={handleOpenCopyModal} icon={<Copy size={16} />} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-xs sm:text-sm whitespace-nowrap">In anderes Lager kopieren</Button>
              </div>
          </div>
      )}

      {/* COPY MODAL */}
      {isCopyModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in zoom-in-95">
              <GlassCard className="w-full max-w-lg">
                  <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-white flex items-center gap-2"><Copy size={20} /> Artikel kopieren</h2><button onClick={() => setIsCopyModalOpen(false)} className="text-white/50 hover:text-white"><X size={20}/></button></div>
                  <div className="space-y-4">
                      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-200 mb-4">Du kopierst <b>{selectedArticleIds.size}</b> Artikel. Stammdaten (Name, EAN, Lieferanten) werden übernommen. Bitte definiere den neuen Lagerort.</div>
                      <div><label className="text-xs text-white/50 block mb-1">Ziel-Lager</label><GlassSelect value={copyConfig.targetWarehouseId} onChange={(e) => setCopyConfig({...copyConfig, targetWarehouseId: e.target.value})}><option value="" className="bg-gray-900">Bitte wählen...</option>{warehouses.filter(w => w.id !== currentWarehouseId).map(w => <option key={w.id} value={w.id} className="bg-gray-900">{w.name}</option>)}{warehouses.length > 0 && currentWarehouseId && <option value={currentWarehouseId} className="bg-gray-900">{currentWarehouse?.name} (Duplizieren)</option>}</GlassSelect></div>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-xs text-white/50 block mb-1">Neues Regal (Kategorie)</label>{isManualTargetCategory ? <div className="flex gap-2"><GlassInput value={copyConfig.targetCategory} onChange={(e) => setCopyConfig({...copyConfig, targetCategory: e.target.value})} placeholder="Neues Regal benennen..." autoFocus/>{targetWarehouseCategories.length > 0 && <button type="button" onClick={() => setIsManualTargetCategory(false)} className="p-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-white/60 hover:text-white" title="Aus Liste wählen"><Layers size={20} /></button>}</div> : <div className="relative w-full group"><select className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-10 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-teal-500/50" value={copyConfig.targetCategory} onChange={(e) => { if (e.target.value === '___NEW___') { setCopyConfig({...copyConfig, targetCategory: ''}); setIsManualTargetCategory(true); } else { setCopyConfig({...copyConfig, targetCategory: e.target.value}); } }}><option value="" disabled className="bg-gray-900">Wählen...</option>{targetWarehouseCategories.map(c => <option key={c} value={c} className="bg-gray-900 text-white">{c}</option>)}<option value="___NEW___" className="bg-gray-900 text-emerald-400 font-bold">+ Neues Regal erstellen</option></select><div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/50"><ChevronDown size={16} /></div></div>}</div>
                          <div><label className="text-xs text-white/50 block mb-1">Neues Fach (Ort)</label><div className="flex gap-2"><GlassInput value={copyConfig.targetLocation} onChange={(e) => setCopyConfig({...copyConfig, targetLocation: e.target.value})} placeholder="z.B. A-01"/><button type="button" onClick={handleAutoLocationForCopy} disabled={!copyConfig.targetWarehouseId || !copyConfig.targetCategory} className="px-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Nächstes freies Fach generieren"><Wand2 size={18} /></button></div></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 bg-black/20 p-3 rounded-xl border border-white/5"><div><label className="text-xs text-emerald-400 block mb-1 font-bold">Startbestand (Ist)</label><input type="number" className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 text-white" value={copyConfig.stock} onChange={(e) => setCopyConfig({...copyConfig, stock: Number(e.target.value)})}/></div><div><label className="text-xs text-blue-400 block mb-1 font-bold">Sollbestand (Ziel)</label><input type="number" className="w-full bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 text-white" value={copyConfig.targetStock} onChange={(e) => setCopyConfig({...copyConfig, targetStock: Number(e.target.value)})}/></div></div>
                  </div>
                  <div className="flex justify-end gap-3 mt-8"><Button variant="secondary" onClick={() => setIsCopyModalOpen(false)}>Abbrechen</Button><Button onClick={executeBulkCopy} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : 'Kopieren starten'}</Button></div>
              </GlassCard>
          </div>
      )}

      {/* CONTEXT MENU */}
      {contextMenu && contextMenuArticle && (
          <div className="fixed bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-[9999] overflow-hidden w-48 context-menu-container" style={{ top: contextMenu.y, left: contextMenu.x }}>
             <div className="py-1"><button onClick={() => openDetailModal(contextMenuArticle)} className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 flex gap-3 items-center"><History size={16} /> Verlauf</button><button onClick={() => handlePrintLabel(contextMenuArticle)} className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 flex gap-3 items-center"><Printer size={16} /> Etikett</button><button onClick={() => openEditArticleModal(contextMenuArticle)} className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 flex gap-3 items-center"><Edit size={16} /> Bearbeiten</button><div className="h-px bg-white/10 my-1"></div><button onClick={() => handleDeleteArticle(contextMenuArticle.id)} className="w-full text-left px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 flex gap-3 items-center"><Trash2 size={16} /> Löschen</button></div>
          </div>
      )}

      {/* ADD/EDIT MODAL */}
      {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden">
             <div className="w-full h-full sm:h-auto sm:max-h-[90vh] max-w-2xl bg-[#1a1d24] border-0 sm:border border-white/10 sm:rounded-2xl shadow-2xl flex flex-col">
                  <div className="p-4 sm:p-6 border-b border-white/10 flex justify-between items-center bg-white/5 sticky top-0 z-10 backdrop-blur-xl shrink-0">
                      <div className="flex items-center gap-3"><h2 className="text-xl font-bold text-white">{isEditMode ? 'Artikel bearbeiten' : 'Neuer Artikel'}</h2><button onClick={openAiScanModal} className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-400 hover:to-blue-400 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-purple-500/20 transition-all transform hover:scale-105"><Sparkles size={12} /><span>KI-Scan</span></button></div><button onClick={()=>setIsAddModalOpen(false)} className="p-2 rounded-full hover:bg-white/5 text-white/60 hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
                       <div className="flex flex-col md:flex-row gap-6">
                          <div className="flex flex-col gap-2 sm:w-32 shrink-0">
                              <div className="w-full h-32 rounded-2xl border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center relative overflow-hidden group hover:border-white/20 transition-all">
                                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                                  {isUploading ? <Loader2 className="animate-spin text-emerald-400"/> : newArticle.image ? <img src={newArticle.image} className="w-full h-full object-cover"/> : <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 text-white/30 cursor-pointer p-2 text-center"><ImageIcon size={24}/> <span className="text-[10px]">Bild wählen</span></div>}
                                  {newArticle.image && !isUploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2"><button onClick={handleImageRemove} className="p-1 bg-red-500/20 text-red-300 rounded hover:bg-red-500/40"><Trash2 size={16}/></button></div>}
                              </div>
                              {!newArticle.image && !isUploading && (
                                <>
                                    <button type="button" onClick={handlePasteProductImage} className="w-full py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-white/60 hover:text-white flex items-center justify-center gap-2 transition-colors"><Clipboard size={14} /> Einfügen</button>
                                    <button type="button" onClick={handleOpenImageReuse} className="w-full py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-white/60 hover:text-white flex items-center justify-center gap-2 transition-colors"><Paperclip size={14} /> Verknüpfen</button>
                                </>
                              )}
                          </div>
                          <div className="flex-1 space-y-4">
                              <div><label className="text-xs text-white/50 mb-1 block font-medium">Bezeichnung</label><input className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-lg" placeholder="Was liegt im Regal?" value={newArticle.name} onChange={e=>setNewArticle({...newArticle, name: e.target.value})} /></div>
                              <div><label className="text-xs text-white/50 mb-1 block font-medium">EAN / Barcode (Optional)</label><input className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50" placeholder="z.B. 401234567890" value={newArticle.ean} onChange={e=>setNewArticle({...newArticle, ean: e.target.value})} /></div>
                          </div>
                       </div>
                       <div className="space-y-2"><label className="text-xs text-white/50 block font-medium flex items-center gap-1"><Hash size={12}/> Hersteller-Nr. / SKUs</label><div className="flex gap-2"><input className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 font-mono" value={tempSkuInput} onChange={e => setTempSkuInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTempSku()} placeholder="z.B. 123-456"/><Button type="button" onClick={() => addTempSku()} className="px-3 py-2 h-auto bg-white/10 hover:bg-white/20 border-white/10"><Plus size={16}/></Button></div><div className="flex flex-wrap gap-2">{tempSkus.map((s, idx) => (<div key={idx} className={`flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg border text-xs ${s.isPreferred ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-white/5 border-white/10 text-white/60'}`}>{editingSkuIndex === idx ? (<div className="flex items-center"><input className="bg-transparent border-b border-white/30 text-white w-20 focus:outline-none" value={editSkuValue} onChange={(e) => setEditSkuValue(e.target.value)} onBlur={saveEditingSku} onKeyDown={(e) => e.key === 'Enter' && saveEditingSku()} autoFocus/></div>) : (<span onClick={() => startEditingSku(idx)} className="cursor-pointer">{s.sku}</span>)}<div className="flex gap-1 ml-1 pl-1 border-l border-white/10"><button type="button" onClick={() => togglePreferredSku(idx)} className={`hover:text-white ${s.isPreferred ? 'text-emerald-400' : 'text-white/20'}`} title="Als Haupt-Nr. setzen"><Star size={10} fill={s.isPreferred ? "currentColor" : "none"}/></button><button type="button" onClick={() => removeTempSku(idx)} className="hover:text-rose-400 text-white/40"><X size={10}/></button></div></div>))}</div></div>
                       <div className="h-px bg-white/5 w-full" />
                       <div className="grid grid-cols-2 gap-4 sm:gap-6">
                            <div><label className="text-xs text-white/50 block mb-1">Regal (Kategorie)</label>{isManualCategory ? <div className="flex gap-2"><input className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white" value={newArticle.category} onChange={e=>setNewArticle({...newArticle, category: e.target.value})} placeholder="Neues Regal benennen..." autoFocus/>{distinctCategories.length > 0 && <button type="button" onClick={() => setIsManualCategory(false)} className="p-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-white/60 hover:text-white" title="Aus Liste wählen"><Layers size={20} /></button>}</div> : <div className="flex gap-2"><div className="relative w-full group"><select className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-10 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-teal-500/50" value={newArticle.category} onChange={(e) => { if (e.target.value === '___NEW___') { setNewArticle({...newArticle, category: ''}); setIsManualCategory(true); } else { setNewArticle({...newArticle, category: e.target.value}); } }}><option value="" disabled className="bg-gray-900">Wählen...</option>{distinctCategories.map(c => <option key={c} value={c} className="bg-gray-900 text-white">{c}</option>)}<option value="___NEW___" className="bg-gray-900 text-emerald-400 font-bold">+ Neues Regal erstellen</option></select><div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/50"><ChevronDown size={16} /></div></div></div>}</div>
                            <div><label className="text-xs text-white/50 block mb-1">Fach (Ort)</label><div className="flex gap-2"><input className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white" value={newArticle.location} onChange={e=>setNewArticle({...newArticle, location: e.target.value})} placeholder="z.B. A-01" /><button type="button" onClick={handleAutoLocation} className="px-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-emerald-400 hover:text-emerald-300 transition-colors" title="Nächstes freies Fach generieren"><Wand2 size={18} /></button></div></div>
                            <div><label className="text-xs text-white/50 block mb-1 text-emerald-400">Ist-Bestand</label><input type="number" className="w-full bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 text-white font-bold" value={newArticle.stock} onChange={e=>setNewArticle({...newArticle, stock: parseInt(e.target.value) || 0})} /></div>
                            <div><label className="text-xs text-white/50 block mb-1 text-blue-400">Soll-Bestand</label><input type="number" className="w-full bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-white font-bold" value={newArticle.targetStock} onChange={e=>setNewArticle({...newArticle, targetStock: parseInt(e.target.value) || 0})} /></div>
                       </div>
                       <div className="h-px bg-white/5 w-full" />
                       <div className="space-y-4">
                           <div className="flex justify-between items-center"><label className="text-xs text-white/50 font-bold uppercase tracking-wider">Lieferanten & Preise</label><button type="button" onClick={() => navigate('/suppliers')} className="text-[10px] text-blue-400 hover:underline">Verwalten</button></div>
                           <div className="bg-black/20 p-3 rounded-xl border border-white/5 space-y-3"><div className="flex gap-2"><GlassSelect className="flex-1 py-2 text-sm" value={tempSupplierSelect} onChange={(e) => setTempSupplierSelect(e.target.value)}><option value="" className="bg-gray-900 text-white">Lieferant wählen...</option>{suppliers.map(s => <option key={s.id} value={s.id} className="bg-gray-900 text-white">{s.name}</option>)}</GlassSelect><Button type="button" onClick={addTempSupplier} disabled={!tempSupplierSelect} className="px-4 py-2 h-auto text-xs">Hinzufügen</Button></div><div className="grid grid-cols-2 gap-2"><input className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" placeholder="Artikel-Nr. beim Händler" value={tempSupplierSkuInput} onChange={e => setTempSupplierSkuInput(e.target.value)}/><input className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" placeholder="URL zum Produkt" value={tempSupplierUrlInput} onChange={e => setTempSupplierUrlInput(e.target.value)}/></div></div>
                           <div className="space-y-2">{tempSuppliers.length === 0 && <div className="text-center text-xs text-white/30 py-2">Keine Lieferanten verknüpft.</div>}{tempSuppliers.map((s, idx) => (<div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${s.isPreferred ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/10'}`}><div className="flex-1 min-w-0 mr-4"><div className="flex items-center gap-2"><span className="font-bold text-sm text-white">{s.supplierName}</span>{s.isPreferred && <span className="text-[9px] bg-blue-500 text-white px-1.5 rounded-sm">Primär</span>}</div>{editingSupplierIndex === idx ? (<div className="grid grid-cols-2 gap-2 mt-2"><input className="bg-black/30 border border-white/20 rounded px-2 py-1 text-xs text-white" value={editSupplierData.supplierSku} onChange={e => setEditSupplierData({...editSupplierData, supplierSku: e.target.value})} placeholder="Art-Nr."/><input className="bg-black/30 border border-white/20 rounded px-2 py-1 text-xs text-white" value={editSupplierData.url} onChange={e => setEditSupplierData({...editSupplierData, url: e.target.value})} placeholder="URL"/><div className="col-span-2 flex justify-end gap-2"><button onClick={saveEditingSupplier} className="text-xs text-emerald-400 hover:underline">Speichern</button><button onClick={() => setEditingSupplierIndex(null)} className="text-xs text-white/50 hover:underline">Abbruch</button></div></div>) : (<div className="text-xs text-white/50 flex flex-col sm:flex-row sm:gap-3 mt-0.5"><span className="truncate">Art-Nr: {s.supplierSku || '-'}</span>{s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 hover:underline truncate max-w-[150px]"><LinkIcon size={10}/> Link</a>}</div>)}</div><div className="flex items-center gap-1">{editingSupplierIndex !== idx && (<><button type="button" onClick={() => startEditingSupplier(idx)} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white"><Edit size={14}/></button><button type="button" onClick={() => togglePreferredSupplier(idx)} className={`p-2 hover:bg-white/10 rounded-lg ${s.isPreferred ? 'text-blue-400' : 'text-white/20 hover:text-white'}`} title="Als Hauptlieferant setzen"><Star size={14} fill={s.isPreferred ? "currentColor" : "none"}/></button><button type="button" onClick={() => removeTempSupplier(idx)} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-rose-400"><Trash2 size={14}/></button></>)}</div></div>))}</div>
                       </div>
                  </div>
                  <div className="p-4 sm:p-6 border-t border-white/10 flex justify-end gap-3 bg-gray-900/95 sm:bg-black/20 rounded-none sm:rounded-b-2xl sticky bottom-0 z-10 backdrop-blur-xl shrink-0">
                      <Button variant="secondary" onClick={()=>setIsAddModalOpen(false)}>Abbrechen</Button>
                      <Button onClick={handleSaveArticle} disabled={isSubmitting} className="min-w-[120px]">{isSubmitting ? <Loader2 className="animate-spin" /> : 'Speichern'}</Button>
                  </div>
               </div>
          </div>
      )}

      {/* REUSE IMAGE MODAL */}
      {isImageReuseModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in-95">
              <GlassCard className="w-full max-w-3xl flex flex-col h-[80vh] p-0 overflow-hidden">
                  <div className="p-5 border-b border-white/10 bg-white/5 flex justify-between items-center">
                      <div>
                          <h3 className="text-lg font-bold text-white">Bild wiederverwenden</h3>
                          <p className="text-xs text-white/50">Wählen Sie ein bereits vorhandenes Artikelbild aus.</p>
                      </div>
                      <button onClick={() => setIsImageReuseModalOpen(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                  </div>
                  
                  <div className="p-4 border-b border-white/5 space-y-3">
                      <div className="relative">
                          <Search className="absolute left-3 top-3 text-white/30" size={16}/>
                          <input className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/30" placeholder="Suchen..." value={reuseSearch} onChange={e => setReuseSearch(e.target.value)}/>
                      </div>
                      <div className="flex gap-2">
                          <GlassSelect className="text-xs py-2" value={reuseFilterWarehouse} onChange={e => setReuseFilterWarehouse(e.target.value)}>
                              <option value="all" className="bg-gray-900">Alle Lagerorte</option>
                              {warehouses.map(w => <option key={w.id} value={w.id} className="bg-gray-900">{w.name}</option>)}
                          </GlassSelect>
                          <GlassSelect className="text-xs py-2" value={reuseFilterCategory} onChange={e => setReuseFilterCategory(e.target.value)}>
                              <option value="all" className="bg-gray-900">Alle Kategorien</option>
                              {reuseFilterWarehouse === 'all' 
                                ? reuseCategories.map(c => <option key={c} value={c} className="bg-gray-900">{c}</option>)
                                : (warehouseCategoryMap[reuseFilterWarehouse] || []).map(c => <option key={c} value={c} className="bg-gray-900">{c}</option>)
                              }
                          </GlassSelect>
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                      {reuseLoading ? (
                          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-emerald-400"/></div>
                      ) : (
                          <div className="space-y-6">
                              {showRecent && recentImages.length > 0 && (
                                  <div>
                                      <h4 className="text-xs font-bold text-white/40 uppercase mb-2 px-1">Zuletzt verwendet</h4>
                                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                          {recentImages.map((img, idx) => (
                                              <button key={idx} onClick={() => handleSelectReuseImage(img.url)} className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-emerald-500/50 transition-all">
                                                  <img src={img.url} className="w-full h-full object-cover" />
                                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                      <span className="text-xs text-white font-medium px-2 text-center">{img.articleNames[0]}</span>
                                                  </div>
                                              </button>
                                          ))}
                                      </div>
                                      <div className="h-px bg-white/5 w-full my-4"></div>
                                  </div>
                              )}
                              
                              <div>
                                  <h4 className="text-xs font-bold text-white/40 uppercase mb-2 px-1">{showRecent ? 'Alle Bilder' : `Gefunden: ${filteredImages.length}`}</h4>
                                  {filteredImages.length === 0 ? (
                                      <div className="text-center text-white/30 py-8">Keine Bilder gefunden.</div>
                                  ) : (
                                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                          {displayImages.map((img, idx) => (
                                              <button key={idx} onClick={() => handleSelectReuseImage(img.url)} className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-emerald-500/50 transition-all">
                                                  <img src={img.url} className="w-full h-full object-cover" loading="lazy" />
                                                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1 text-[9px] text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                                      {img.articleNames[0]}
                                                  </div>
                                              </button>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          </div>
                      )}
                  </div>
              </GlassCard>
          </div>
      )}

      {/* AI SCAN MODAL */}
      {isAiModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-in fade-in zoom-in-95">
               <GlassCard className="w-full max-w-lg flex flex-col p-0 overflow-hidden">
                   <div className="p-5 border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-blue-500/10 flex justify-between items-center">
                        <div className="flex items-center gap-2"><Sparkles size={20} className="text-purple-300" /><h3 className="text-lg font-bold text-white">KI-Artikel-Scan</h3></div>
                        <button onClick={() => setIsAiModalOpen(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
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
                                        {aiImagePreview ? ( <><img src={aiImagePreview} className="w-full h-full object-contain p-2" /><div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setAiImagePreview(null); setAiSelectedFile(null); }} className="p-2 bg-red-500/20 text-red-200 rounded-full hover:bg-red-500/40"><Trash2 size={20} /></button></div></>) : (<div className="flex flex-col items-center gap-3 text-white/30"><FileImage size={40} strokeWidth={1.5} /><div className="flex flex-col gap-2 items-center"><button onClick={() => aiFileInputRef.current?.click()} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors">Datei wählen</button><span className="text-xs">oder</span><button onClick={handlePasteAiImage} className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-sm transition-colors flex items-center gap-2"><Clipboard size={14} /> Aus Zwischenablage</button></div></div>)}
                                        <input type="file" ref={aiFileInputRef} className="hidden" accept="image/*" onChange={handleAiFileSelectInput} />
                                    </div>
                                )}
                                {aiMode === 'link' && (
                                    <div className="space-y-3 py-6">
                                        <div className="text-sm text-white/60 mb-2">Füge einen Produktlink oder Text zur Analyse ein:</div>
                                        <div className="relative"><input className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pl-12 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="https://shop.lieferant.de/produkt/..." value={aiUrlInput} onChange={(e) => setAiUrlInput(e.target.value)}/><Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20} /></div>
                                    </div>
                                )}
                                <Button onClick={analyzeWithGemini} disabled={(aiMode === 'image' && !aiSelectedFile) || (aiMode === 'link' && !aiUrlInput.trim()) || isAnalyzing} className={`w-full bg-gradient-to-r from-purple-500 to-blue-500 border-none mt-4`}>{isAnalyzing ? <div className="flex items-center gap-2"><Loader2 className="animate-spin"/> Analysiere...</div> : <div className="flex items-center gap-2"><Wand2 size={18}/> Daten ausfüllen</div>}</Button>
                            </>
                        ) : (
                            <div className="space-y-4 animate-in fade-in">
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3"><CheckCircle2 size={24} className="text-emerald-400" /><div className="text-sm text-white">Analyse erfolgreich! Wähle einen Namen:</div></div>
                                <div className="space-y-2">
                                    <div onClick={() => applyAiResult(aiAnalysisResult.name)} className="p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"><div className="text-[10px] text-white/40 uppercase font-bold mb-1">Original (gefunden)</div><div className="font-bold text-white">{aiAnalysisResult.name}</div></div>
                                    {aiAnalysisResult.compact_name_proposal && (<div onClick={() => applyAiResult(aiAnalysisResult.compact_name_proposal)} className="p-3 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 cursor-pointer transition-colors relative overflow-hidden"><div className="absolute top-0 right-0 p-1 bg-purple-500 text-white text-[9px] font-bold rounded-bl-lg">Empfohlen</div><div className="text-[10px] text-purple-200 uppercase font-bold mb-1 flex items-center gap-1"><TypeIcon size={10}/> Kurz & Knapp</div><div className="font-bold text-white">{aiAnalysisResult.compact_name_proposal}</div></div>)}
                                    {aiAnalysisResult.pattern_name_proposal && (<div onClick={() => applyAiResult(aiAnalysisResult.pattern_name_proposal)} className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 cursor-pointer transition-colors"><div className="text-[10px] text-blue-200 uppercase font-bold mb-1 flex items-center gap-1"><Layers size={10}/> Muster-Match (Aus Bestand)</div><div className="font-bold text-white">{aiAnalysisResult.pattern_name_proposal}</div></div>)}
                                </div>
                                <button onClick={() => setAiAnalysisResult(null)} className="w-full py-2 text-xs text-white/40 hover:text-white mt-2">Zurück</button>
                            </div>
                        )}
                   </div>
               </GlassCard>
          </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && deleteTargetId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95">
            <GlassCard className="w-full max-w-sm p-6 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-400 border border-red-500/20"><Trash2 size={32} /></div>
                <h3 className="text-xl font-bold text-white mb-2">Artikel löschen?</h3>
                <p className="text-sm text-white/60 mb-6">Möchtest du <span className="text-white font-bold">"{articles.find(a => a.id === deleteTargetId)?.name}"</span> wirklich löschen? Dies kann nicht rückgängig gemacht werden.</p>
                <div className="flex gap-3 w-full"><Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="flex-1">Abbrechen</Button><Button variant="danger" onClick={executeDelete} className="flex-1">Löschen</Button></div>
            </GlassCard>
        </div>
      )}

      {/* ARTICLE DETAIL MODAL */}
      {isDetailModalOpen && viewingArticle && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in zoom-in-95">
              <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl flex flex-col bg-[#1a1d24] border border-white/10 sm:rounded-2xl shadow-2xl overflow-hidden">
                  {/* Header */}
                  <div className="shrink-0 p-5 border-b border-white/10 bg-gradient-to-b from-white/10 to-white/5 flex justify-between items-start">
                      <div>
                          <h2 className="text-xl font-bold text-white line-clamp-2 leading-snug">{viewingArticle.name}</h2>
                          <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${viewingArticle.stock >= viewingArticle.targetStock ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'}`}>
                                  {viewingArticle.stock >= viewingArticle.targetStock ? 'Bestand OK' : 'Unterbestand'}
                              </span>
                              {viewingArticle.onOrderDate && <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">Bestellt</span>}
                          </div>
                      </div>
                      <button onClick={() => setIsDetailModalOpen(false)} className="p-2 rounded-full bg-black/20 hover:bg-black/40 text-white/60 hover:text-white transition-colors"><X size={20}/></button>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-6 min-h-0">
                      {/* Image Section */}
                      <div className="w-full h-48 sm:h-64 rounded-2xl bg-black/40 border border-white/10 overflow-hidden relative group">
                          <img src={viewingArticle.image || `https://picsum.photos/seed/${viewingArticle.id}/400/300`} className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"/>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                              <div className="text-white/40 text-xs font-medium mb-1">Lagerbestand</div>
                              <div className="flex items-baseline gap-1">
                                  <span className={`text-3xl font-bold ${viewingArticle.stock < viewingArticle.targetStock ? 'text-rose-400' : 'text-emerald-400'}`}>{viewingArticle.stock}</span>
                                  <span className="text-white/30 text-sm">/ {viewingArticle.targetStock} Soll</span>
                              </div>
                              {/* Simple Progress Bar */}
                              <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                                  <div className={`h-full rounded-full ${viewingArticle.stock < viewingArticle.targetStock ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min((viewingArticle.stock / (viewingArticle.targetStock || 1)) * 100, 100)}%` }}></div>
                              </div>
                          </div>
                          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                              <div className="text-white/40 text-xs font-medium mb-1">Lagerort</div>
                              <div className="text-lg font-bold text-white">{viewingArticle.location || '-'}</div>
                              <div className="text-sm text-white/50 mt-1 flex items-center gap-1"><Layers size={12}/> {viewingArticle.category}</div>
                          </div>
                      </div>

                      {/* Detail List */}
                      <div className="space-y-3">
                          <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider px-1">Stammdaten</h3>
                          <div className="bg-white/5 rounded-xl border border-white/10 divide-y divide-white/5">
                              <div className="p-3 flex justify-between text-sm"><span className="text-white/50">Hersteller-Nr.</span><span className="text-white font-mono">{viewingArticle.sku || '-'}</span></div>
                              <div className="p-3 flex justify-between text-sm"><span className="text-white/50">EAN / GTIN</span><span className="text-white font-mono">{viewingArticle.ean || '-'}</span></div>
                              <div className="p-3 flex justify-between text-sm"><span className="text-white/50">Lieferant</span><span className="text-white">{viewingArticle.supplier || '-'}</span></div>
                              
                              <div 
                                  onClick={() => handleCopy(viewingArticle.supplierSku || '', 'supplierSku')}
                                  className={`p-3 flex justify-between text-sm cursor-pointer transition-colors ${copiedField === 'supplierSku' ? 'bg-emerald-500/10' : 'hover:bg-white/5'}`}
                              >
                                  <span className="text-white/50">Lieferant Art-Nr.</span>
                                  <span className={`font-mono flex items-center gap-2 ${copiedField === 'supplierSku' ? 'text-emerald-400' : 'text-white'}`}>
                                      {viewingArticle.supplierSku || '-'}
                                      {viewingArticle.supplierSku && (
                                          copiedField === 'supplierSku' ? <Check size={14} /> : <Copy size={14} className="opacity-50" />
                                      )}
                                  </span>
                              </div>

                              {viewingArticle.productUrl && (
                                  <div className="p-3 flex justify-between text-sm">
                                      <span className="text-white/50">Produkt-Link</span>
                                      <a href={viewingArticle.productUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                                          Öffnen <ExternalLink size={12}/>
                                      </a>
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* History Section */}
                      <div>
                          <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider px-1 mb-3 flex justify-between items-center">
                              <span>Verlauf (Letzte 5)</span>
                              {historyLoading && <Loader2 className="animate-spin w-3 h-3"/>}
                          </h3>
                          <div className="space-y-2">
                              {articleHistory.length === 0 && !historyLoading && <div className="text-center text-white/20 py-4 text-xs italic">Keine Bewegungen.</div>}
                              {articleHistory.map(move => (
                                  <div key={move.id} className="bg-white/5 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                                      <div>
                                          <div className="text-xs text-white/30 mb-0.5">{new Date(move.created_at).toLocaleDateString()} • {new Date(move.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                          <div className="text-sm text-white">{move.reference || 'Manuelle Buchung'}</div>
                                          <div className="text-[10px] text-white/40 flex items-center gap-1"><User size={10}/> {move.profiles?.full_name || 'Unbekannt'}</div>
                                      </div>
                                      <div className={`font-bold font-mono ${move.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                          {move.amount > 0 ? '+' : ''}{move.amount}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
                  
                  {/* Footer Actions */}
                  <div className="shrink-0 p-4 border-t border-white/10 bg-black/20 flex gap-3">
                      <Button variant="secondary" onClick={() => handlePrintLabel(viewingArticle)} className="flex-1" icon={<Printer size={16}/>}>Etikett</Button>
                      <Button variant="secondary" onClick={() => { setIsDetailModalOpen(false); openEditArticleModal(viewingArticle); }} className="flex-1" icon={<Edit size={16}/>}>Bearbeiten</Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Inventory;
