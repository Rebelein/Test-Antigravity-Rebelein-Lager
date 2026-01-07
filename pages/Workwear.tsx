import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Shirt, Ruler, ShoppingBag, History, Settings, User as UserIcon, Check, X, AlertTriangle, FileText, ChevronRight, ShoppingCart, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { GlassCard, Button, GlassModal } from '../components/UIComponents';
import { toast } from 'sonner';
import { WorkwearRole, WorkwearTemplate, UserSize, WorkwearOrder, WorkwearOrderItem, CartItem } from '../types';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { AdminTemplateEditor } from '../components/workwear/AdminTemplateEditor';
import { UserSizeManager } from '../components/workwear/UserSizeManager';
import { AdminBudgetManager } from '../components/workwear/AdminBudgetManager';
import { CatalogItem } from '../components/workwear/CatalogItem';
import { OrderHistory } from '../components/workwear/OrderHistory';
import { AdminOrderManagement } from '../components/workwear/AdminOrderManagement';

// ... cleaned up top section
// --- COMPONENTS --- (To be extracted later if too large)

const Workwear = () => {
    const { user, profile } = useAuth();
    const [activeTab, setActiveTab] = useState<'catalog' | 'profile' | 'history' | 'admin'>('catalog');
    const [role, setRole] = useState<WorkwearRole | null>(null);

    // Admin Sub-Views
    const [adminView, setAdminView] = useState<'overview' | 'budgets' | 'templates' | 'orders'>('overview');

    // Data State
    const [templates, setTemplates] = useState<WorkwearTemplate[]>([]);
    const [myBudget, setMyBudget] = useState<{ limit: number, used: number, reserved: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [userSizes, setUserSizes] = useState<Record<string, string>>({});

    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [ordering, setOrdering] = useState(false);

    // Initialize Role and Data
    useEffect(() => {
        if (profile) {
            // Default to 'monteur' if not set, or use the one from DB
            setRole(profile.workwear_role || 'monteur');
            fetchData();
        }
    }, [profile]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const currentYear = new Date().getFullYear();

            // Fetch Templates
            const { data: tmpl } = await supabase.from('workwear_templates').select('*').eq('is_active', true);
            if (tmpl) setTemplates(tmpl);

            if (user) {
                // Fetch User Sizes
                const { data: sizesData } = await supabase
                    .from('user_sizes')
                    .select('category, size_value')
                    .eq('user_id', user.id);

                const sizesMap: Record<string, string> = {};
                sizesData?.forEach(s => sizesMap[s.category] = s.size_value);
                setUserSizes(sizesMap);

                // 1. Fetch Budget Limit
                const { data: budgetData } = await supabase
                    .from('workwear_budgets')
                    .select('budget_limit')
                    .eq('user_id', user.id)
                    .eq('year', currentYear)
                    .single();

                const limit = budgetData?.budget_limit || 0;

                // 2. Calculate Used & Reserved
                const { data: orders } = await supabase
                    .from('workwear_orders')
                    .select('status, total_amount')
                    .eq('user_id', user.id);

                let used = 0;
                let reserved = 0;

                orders?.forEach(order => {
                    if (order.status === 'COMPLETED') {
                        used += order.total_amount;
                    } else if (order.status === 'REQUESTED' || order.status === 'ORDERED') {
                        reserved += order.total_amount;
                    }
                });

                setMyBudget({ limit, used, reserved });
            }

        } catch (e) {
            console.error("Error fetching workwear data", e);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (template: WorkwearTemplate, size: string) => {
        setCart(prev => {
            const existing = prev.find(item => item.template.id === template.id && item.size === size);
            if (existing) {
                return prev.map(item => item === existing ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { id: crypto.randomUUID(), template, size, quantity: 1 }];
        });
        toast.success("Zum Warenkorb hinzugefügt");
    };

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.template.price * item.quantity), 0);
    const availableBudget = myBudget ? (myBudget.limit - myBudget.used - myBudget.reserved) : 0;

    const handleCheckout = async () => {
        if (!user || cart.length === 0) return;

        if (cartTotal > availableBudget && role !== 'chef') {
            toast.error(`Budget überschritten! Verfügbar: ${availableBudget.toFixed(2)} €`);
            return;
        }

        try {
            setOrdering(true);

            // 1. Create Order
            const { data: order, error: orderError } = await supabase
                .from('workwear_orders')
                .insert([{
                    user_id: user.id,
                    status: 'REQUESTED',
                    total_amount: cartTotal
                }])
                .select()
                .single();

            if (orderError) throw orderError;

            // 2. Create Items
            const items = cart.map(item => ({
                order_id: order.id,
                template_id: item.template.id,
                size: item.size,
                quantity: item.quantity,
                price_at_order: item.template.price,
                use_logo: item.template.has_logo || false
            }));

            const { error: itemsError } = await supabase
                .from('workwear_order_items')
                .insert(items);

            if (itemsError) throw itemsError;

            toast.success("Bestellung abgeschickt!");
            setCart([]);
            setIsCartOpen(false);
            fetchData(); // Refresh budget

        } catch (error) {
            console.error(error);
            toast.error("Fehler bei der Bestellung");
        } finally {
            setOrdering(false);
        }
    };

    const tabs = [
        { id: 'catalog', label: 'Katalog', icon: <ShoppingBag size={18} /> },
        { id: 'profile', label: 'Meine Größen', icon: <Ruler size={18} /> },
        { id: 'history', label: 'Bestellungen', icon: <History size={18} /> },
    ];

    if ((role === 'chef' || role === 'besteller')) {
        tabs.push({ id: 'admin', label: 'Verwaltung', icon: <Settings size={18} /> });
    }

    // --- RENDER ADMIN VIEWS DIRECTLY ---
    if (activeTab === 'admin' && adminView === 'templates') {
        return <AdminTemplateEditor onBack={() => { setAdminView('overview'); fetchData(); }} />;
    }

    if (activeTab === 'admin' && adminView === 'orders') {
        return <AdminOrderManagement onBack={() => { setAdminView('overview'); fetchData(); }} />;
    }

    if (activeTab === 'admin' && adminView === 'budgets') {
        return <AdminBudgetManager onBack={() => { setAdminView('overview'); fetchData(); }} />;
    }

    return (
        <div className="space-y-6 pb-24 lg:pb-0">
            {/* HEADER */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-200">
                        Arbeitskleidung
                    </h1>
                    <p className="text-white/60 text-sm mt-1">
                        Bestelle deine Ausrüstung oder verwalte das Budget.
                    </p>
                </div>

                <div className="flex items-center gap-4 self-end md:self-auto">
                    {/* Cart Trigger */}
                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="relative p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                    >
                        <ShoppingCart size={20} className="text-white" />
                        {cart.reduce((a, b) => a + b.quantity, 0) > 0 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-black text-xs font-bold flex items-center justify-center">
                                {cart.reduce((a, b) => a + b.quantity, 0)}
                            </div>
                        )}
                    </button>

                    {/* Budget Flag */}
                    <GlassCard className="px-4 py-2 flex items-center gap-4 bg-emerald-500/10 border-emerald-500/20">
                        <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Mein Budget ({new Date().getFullYear()})</div>
                        <div className="text-lg font-mono font-bold text-white">
                            {myBudget ? `${(myBudget.limit - myBudget.used - myBudget.reserved).toFixed(2)} €` : 'Loading...'}
                        </div>
                    </GlassCard>
                </div>
            </header>

            {/* TABS */}
            <div className="flex p-1 gap-1 glass-panel rounded-xl w-full md:w-auto self-start overflow-x-auto">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id as any); setAdminView('overview'); if (tab.id === 'catalog') fetchData(); }}
                        className={clsx(
                            "flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2",
                            activeTab === tab.id
                                ? "bg-emerald-500/20 text-emerald-300 shadow-sm"
                                : "text-white/40 hover:text-white hover:bg-white/5"
                        )}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* CONTENT AREA */}
            <main className="min-h-[400px]">
                <AnimatePresence mode="wait">
                    {activeTab === 'catalog' && (
                        <motion.div
                            key="catalog"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {templates.map((item) => (
                                    <CatalogItem key={item.id} template={item} onAddToCart={addToCart} defaultSize={userSizes[item.category]} />
                                ))}

                                {/* Admin: Add New Template Card */}
                                {(role === 'chef' || role === 'besteller') && (
                                    <button onClick={() => { setActiveTab('admin'); setAdminView('templates'); }} className="border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center min-h-[300px] text-white/30 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group">
                                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <Plus size={32} />
                                        </div>
                                        <span className="font-medium">Neuen Artikel anlegen</span>
                                    </button>
                                )}
                            </div>
                            {templates.length === 0 && !loading && (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                        <Shirt size={40} className="text-white/20" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">Keine Artikel gefunden</h3>
                                    <p className="text-white/50 max-w-sm">
                                        Es wurden noch keine Arbeitskleidungs-Vorlagen erstellt.
                                        {(role === 'chef' || role === 'besteller') && " Wechsle zur Verwaltung, um Artikel anzulegen."}
                                    </p>
                                </div>
                            )}

                        </motion.div>
                    )}

                    {activeTab === 'profile' && (
                        <motion.div
                            key="profile"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <UserSizeManager />
                        </motion.div>
                    )}

                    {activeTab === 'history' && (
                        <motion.div
                            key="history"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <OrderHistory role={role} />
                        </motion.div>
                    )}

                    {activeTab === 'admin' && adminView === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <GlassCard onClick={() => setAdminView('orders')} className="p-6 cursor-pointer hover:border-emerald-500/50 transition-colors group">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                        <FileText size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold">Bestellungen</h3>
                                        <p className="text-white/50 text-sm">Bestellungen prüfen und exportieren.</p>
                                    </div>
                                </div>
                                <Button variant="secondary" className="w-full">Öffnen</Button>
                            </GlassCard>

                            <GlassCard onClick={() => setAdminView('budgets')} className="p-6 cursor-pointer hover:border-emerald-500/50 transition-colors group">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                                        <Settings size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold">Budget & Einstellungen</h3>
                                        <p className="text-white/50 text-sm">Budgets pro Mitarbeiter verwalten.</p>
                                    </div>
                                </div>
                                <Button variant="secondary" className="w-full">Verwalten</Button>
                            </GlassCard>

                            <GlassCard onClick={() => setAdminView('templates')} className="p-6 cursor-pointer hover:border-emerald-500/50 transition-colors group">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                                        <Shirt size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold">Artikel Vorlagen</h3>
                                        <p className="text-white/50 text-sm">Katalog bearbeiten und Preise anpassen.</p>
                                    </div>
                                </div>
                                <Button variant="secondary" className="w-full">Bearbeiten</Button>
                            </GlassCard>
                        </div>
                    )}
                </AnimatePresence>
            </main>

            {/* CART MODAL */}
            <GlassModal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} title="Warenkorb">
                <div className="p-6">
                    {cart.length === 0 ? (
                        <div className="text-center py-8 text-white/50">Der Warenkorb ist leer.</div>
                    ) : (
                        <div className="space-y-4">
                            {cart.map(item => (
                                <div key={item.id} className="flex items-center gap-4 bg-white/5 p-3 rounded-lg border border-white/5">
                                    <div className="w-12 h-12 bg-black/30 rounded flex items-center justify-center shrink-0 overflow-hidden">
                                        {item.template.image_url ? <img src={item.template.image_url} className="w-full h-full object-cover" /> : <Shirt className="text-white/20" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-white truncate">{item.template.name}</div>
                                        <div className="text-xs text-white/50">Größe: {item.size} | Menge: {item.quantity} | {item.template.has_logo ? 'Mit Logo' : 'Ohne Logo'}</div>
                                    </div>
                                    <div className="font-mono text-emerald-300">{(item.template.price * item.quantity).toFixed(2)} €</div>
                                    <button onClick={() => removeFromCart(item.id)} className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-rose-400"><Trash2 size={16} /></button>
                                </div>
                            ))}

                            <div className="border-t border-white/10 pt-4 mt-4 flex justify-between items-center">
                                <div className="text-white/60">Gesamtsumme</div>
                                <div className="text-xl font-bold text-emerald-400 font-mono">{cartTotal.toFixed(2)} €</div>
                            </div>

                            {cartTotal > availableBudget && role !== 'chef' && (
                                <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg text-rose-300 text-sm flex items-center gap-2">
                                    <AlertTriangle size={16} />
                                    <div>
                                        Budget überschritten! (Verfügbar: {availableBudget.toFixed(2)} €)
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 mt-4">
                                <Button variant="ghost" onClick={() => setIsCartOpen(false)} className="flex-1">Zurück</Button>
                                <Button
                                    onClick={handleCheckout}
                                    isLoading={ordering}
                                    className="flex-[2]"
                                    disabled={cartTotal > availableBudget && role !== 'chef'}
                                >
                                    <Send size={18} /> Kostenpflichtig Bestellen
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </GlassModal>
        </div>
    );
};

export default Workwear;
