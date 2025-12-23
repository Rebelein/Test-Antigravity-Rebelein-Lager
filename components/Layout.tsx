

import React, { useState, useEffect } from 'react';
import { NavRoute } from '../types';
import { LayoutDashboard, Package, Drill, ShoppingCart, ScanLine, LogOut, UserCircle, WifiOff, RefreshCw, ClipboardList, ClipboardCheck, PanelLeftClose, PanelLeftOpen, Pin, PinOff, ChevronRight, Download, Share, Check, X, Key as KeyIcon } from 'lucide-react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, GlassCard } from './UIComponents';
import { OnboardingTour } from './OnboardingTour';
import { InstallPrompt } from './InstallPrompt';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import NotificationToast from './NotificationToast';
import { LastWorkingDaySign } from './LastWorkingDaySign';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { signOut, profile, isConnected, checkConnection, markTourSeen } = useAuth();

    // Sidebar State for Desktop
    const [isSidebarPinned, setIsSidebarPinned] = useState(() => {
        // Vibe Coding: Persist sidebar state
        const saved = localStorage.getItem('sidebar-pinned');
        return saved === 'true';
    });

    // Save sidebar state to local storage whenever it changes
    useEffect(() => {
        localStorage.setItem('sidebar-pinned', isSidebarPinned.toString());
    }, [isSidebarPinned]);

    // --- NEW FEATURES STATE ---
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [showTour, setShowTour] = useState(false);

    // Determine active tab based on current path
    const currentPath = location.pathname.substring(1) || 'dashboard';

    // Navigation Items Configuration
    const navItemsLeft = [
        { id: 'dashboard', icon: <LayoutDashboard size={24} />, label: 'Home' },
        { id: 'inventory', icon: <Package size={24} />, label: 'Lager' },
        { id: 'commissions', icon: <ClipboardCheck size={24} />, label: 'Kom.' },
    ];

    const navItemsRight = [
        { id: 'audit', icon: <ClipboardList size={24} />, label: 'Inventur' },
        { id: 'machines', icon: <Drill size={24} />, label: 'Tools' },
        { id: 'orders', icon: <ShoppingCart size={24} />, label: 'Bestellen' },
        { id: 'keys', icon: <KeyIcon size={24} />, label: 'Schlüssel' },
    ];

    const sidebarItems = [
        ...navItemsLeft,
        { id: 'SCANNER_ACTION', icon: <ScanLine size={24} />, label: 'Scanner', isSpecial: true },
        ...navItemsRight
    ];

    // --- EFFECT: CHECK TOUR STATUS (DATABASE BASED) ---
    useEffect(() => {
        // Wait until profile is loaded
        if (profile && profile.has_seen_tour === false) {
            // Small delay to not overwhelm user immediately
            setTimeout(() => setShowTour(true), 1000);
        }
    }, [profile]);

    // --- PWA UPDATE HANDLING ---
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered:', r);
            if (r) {
                // Check for updates every 15 minutes
                setInterval(() => {
                    r.update();
                    console.log("Checking for App Updates...");
                }, 15 * 60 * 1000);
            }
        },
        onRegisterError(error) {
            console.log('SW registration error', error);
        },
    });

    // Sync local state with hook state
    useEffect(() => {
        if (needRefresh) {
            setUpdateAvailable(true);
        }
    }, [needRefresh]);

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    const handleCenterButtonClick = () => {
        if (currentPath === 'audit') {
            window.dispatchEvent(new CustomEvent('open-audit-scanner'));
        } else {
            navigate('/stocktaking');
        }
    };

    const handleNavClick = (itemId: string) => {
        if (itemId === 'SCANNER_ACTION') {
            handleCenterButtonClick();
        } else {
            navigate(`/${itemId}`);
        }
    };

    // --- ACTION: UPDATE APP ---
    const reloadPage = () => {
        updateServiceWorker(true);
    };

    const completeTour = async () => {
        setShowTour(false);
        await markTourSeen();
    };

    // --- STRICT OFFLINE MODE ---
    if (!isConnected) {
        return (
            <div className="min-h-screen w-full bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center mb-6 animate-pulse">
                    <WifiOff size={48} className="text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Keine Verbindung</h1>
                <p className="text-white/50 mb-8 max-w-xs">
                    Um sicherzustellen, dass du immer mit aktuellen Lagerbeständen arbeitest, ist die Nutzung offline deaktiviert.
                </p>
                <Button onClick={() => checkConnection()} icon={<RefreshCw size={18} />}>
                    Verbindung prüfen
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full relative overflow-hidden bg-gray-950 text-white selection:bg-emerald-500/30 flex">

            {/* --- Living Background --- */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-emerald-600/10 rounded-full blur-[120px] animate-blob mix-blend-screen" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-teal-600/10 rounded-full blur-[100px] animate-blob animation-delay-2000 mix-blend-screen" />
                <div className="absolute top-[40%] left-[40%] w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-[80px] animate-blob animation-delay-4000 mix-blend-screen" />
            </div>

            {/* --- GLOBAL NOTIFICATIONS --- */}
            <NotificationToast />

            {/* --- GIMMICK: LAST WORKING DAY SIGN --- */}
            <LastWorkingDaySign />

            {/* --- UPDATE BANNER --- */}
            <AnimatePresence>
                {updateAvailable && (
                    <motion.div
                        initial={{ y: -100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -100, opacity: 0 }}
                        className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] glass-panel px-6 py-3 rounded-full flex items-center gap-4 shadow-2xl border-emerald-500/30"
                    >
                        <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                            <RefreshCw className="animate-spin" size={18} />
                            <span>Neue Version verfügbar!</span>
                        </div>
                        <button
                            onClick={reloadPage}
                            className="bg-emerald-500 text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
                        >
                            Aktualisieren
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- ONBOARDING TOUR --- */}
            {showTour && <OnboardingTour onComplete={completeTour} />}

            {/* --- INSTALL PROMPT --- */}
            <InstallPrompt />

            {/* ============================================================================
          DESKTOP SIDEBAR (Floating Glass)
         ============================================================================ */}
            <motion.aside
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className={clsx(
                    "hidden lg:flex flex-col justify-between fixed left-4 top-4 bottom-4 z-50",
                    "glass-panel rounded-3xl border-white/10",
                    "transition-all duration-300 ease-spring",
                    isSidebarPinned ? 'w-64' : 'w-20'
                )}
            >
                <nav className="flex-1 py-6 flex flex-col gap-2 px-3 overflow-y-auto overflow-x-hidden custom-scrollbar">
                    {sidebarItems.map((item) => {
                        const isActive = currentPath === item.id;
                        const isScanner = item.id === 'SCANNER_ACTION';
                        return (
                            <button
                                key={item.id}
                                onClick={() => handleNavClick(item.id)}
                                className={clsx(
                                    "relative group flex items-center rounded-xl transition-all duration-200",
                                    isSidebarPinned ? 'px-4 py-3 gap-3' : 'justify-center p-3',
                                    isScanner
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 mt-4 mb-4'
                                        : isActive
                                            ? 'bg-white/10 text-emerald-400 shadow-inner'
                                            : 'text-white/50 hover:text-white hover:bg-white/5'
                                )}
                            >
                                <div className={clsx("transition-transform duration-200", isScanner && !isSidebarPinned && 'scale-110')}>{item.icon}</div>
                                {isSidebarPinned && <span className={clsx("font-medium whitespace-nowrap overflow-hidden text-sm", isScanner && 'font-bold')}>{item.label}</span>}

                                {/* Tooltip for collapsed state */}
                                {!isSidebarPinned && (
                                    <div className="absolute left-full ml-4 px-3 py-1.5 bg-gray-900/90 backdrop-blur-md border border-white/10 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl flex items-center">
                                        {item.label}
                                        <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900/90 border-l border-b border-white/10 rotate-45"></div>
                                    </div>
                                )}
                                {isSidebarPinned && isActive && !isScanner && <motion.div layoutId="active-pill" className="absolute right-3 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-3 border-t border-white/5 flex flex-col gap-2">
                    <div className={clsx("flex items-center rounded-xl bg-black/20 border border-white/5", isSidebarPinned ? 'p-3 gap-3' : 'justify-center p-2')}>
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold shrink-0">
                            {profile?.full_name ? profile.full_name.charAt(0) : <UserCircle size={18} />}
                        </div>
                        {isSidebarPinned && (
                            <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="text-xs font-bold text-white truncate">{profile?.full_name?.split(' ')[0] || 'User'}</div>
                                <div className="text-[10px] text-white/40 truncate">Angemeldet</div>
                            </div>
                        )}
                        {isSidebarPinned && <button onClick={handleLogout} className="text-white/40 hover:text-rose-400 transition-colors p-1"><LogOut size={16} /></button>}
                    </div>
                    {!isSidebarPinned && <button onClick={handleLogout} className="flex justify-center p-3 rounded-xl text-white/40 hover:text-rose-400 hover:bg-white/5 transition-colors"><LogOut size={20} /></button>}
                    <button onClick={() => setIsSidebarPinned(!isSidebarPinned)} className={clsx("flex items-center rounded-xl transition-colors text-white/30 hover:text-white hover:bg-white/5", isSidebarPinned ? 'px-4 py-3 gap-3' : 'justify-center p-3')} title={isSidebarPinned ? "Einklappen" : "Menü fixieren"}>
                        {isSidebarPinned ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                        {isSidebarPinned && <span className="text-xs font-medium">Menü einklappen</span>}
                    </button>
                </div>
            </motion.aside>

            {/* ============================================================================
          MOBILE TOP BAR (Floating Glass)
         ============================================================================ */}
            <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className={clsx("lg:hidden fixed left-0 right-0 z-40 px-4 py-2 flex justify-end pointer-events-none max-w-4xl mx-auto", updateAvailable ? 'top-12' : 'top-0')}
            >
                <div className="pointer-events-auto flex items-center gap-2">
                    <div className="glass-panel rounded-full px-3 py-1.5 flex items-center gap-3 shadow-lg">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-500/30 flex items-center justify-center text-emerald-300 text-xs font-bold">
                                {profile?.full_name ? profile.full_name.charAt(0) : <UserCircle size={14} />}
                            </div>
                            <span className="text-xs text-white/70 hidden sm:inline">{profile?.full_name?.split(' ')[0] || 'User'}</span>
                        </div>
                        <div className="w-px h-4 bg-white/10"></div>
                        <button onClick={handleLogout} className="text-white/40 hover:text-rose-400 transition-colors" title="Abmelden">
                            <LogOut size={14} />
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* --- Main Content Area --- */}
            <main
                className={clsx(
                    "relative pb-32 px-4 pt-16 w-full mx-auto",
                    "transition-all duration-300 ease-in-out",
                    "lg:pb-8 lg:pt-8",
                    isSidebarPinned ? 'lg:pl-[18rem]' : 'lg:pl-[7rem]', // Adjusted for floating sidebar margin
                    "lg:max-w-none",
                    updateAvailable ? 'mt-12' : ''
                )}
            >
                <div className="max-w-7xl mx-auto">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 20, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.98 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                            {children}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>

            {/* ============================================================================
          MOBILE BOTTOM NAVIGATION (iOS Dock Style)
         ============================================================================ */}
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="lg:hidden fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none"
            >
                <div className="pointer-events-auto relative max-w-lg w-full mx-4">
                    <nav className="glass-panel rounded-full h-16 flex items-center relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] border-white/15">
                        <div className="flex items-center justify-between overflow-x-auto w-full h-full px-2 sm:px-6 gap-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                            <div className="flex gap-2 sm:gap-4 shrink-0">
                                {navItemsLeft.map((item) => {
                                    const isActive = currentPath === item.id;
                                    return (
                                        <button key={item.id} onClick={() => navigate(`/${item.id}`)} className={clsx("relative flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full transition-all duration-300", isActive ? 'text-emerald-400' : 'text-white/50 hover:text-white/80')}>
                                            {item.icon}
                                            {isActive && <motion.span layoutId="nav-dot" className="absolute bottom-1 w-1 h-1 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="w-16 shrink-0"></div>
                            <div className="flex gap-2 sm:gap-4 shrink-0">
                                {navItemsRight.map((item) => {
                                    const isActive = currentPath === item.id;
                                    return (
                                        <button key={item.id} onClick={() => navigate(`/${item.id}`)} className={clsx("relative flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full transition-all duration-300", isActive ? 'text-emerald-400' : 'text-white/50 hover:text-white/80')}>
                                            {item.icon}
                                            {isActive && <motion.span layoutId="nav-dot" className="absolute bottom-1 w-1 h-1 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </nav>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleCenterButtonClick}
                        className={clsx(
                            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[60%] flex items-center justify-center w-16 h-16 rounded-full shadow-2xl border-4 border-gray-900 transition-all duration-300",
                            currentPath === 'audit' ? 'bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white shadow-purple-500/40' : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-500/40'
                        )}
                    >
                        <ScanLine size={28} />
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
};

export default Layout;