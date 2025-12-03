

import React, { useState, useEffect } from 'react';
import { NavRoute } from '../types';
import { LayoutDashboard, Package, Drill, ShoppingCart, ScanLine, LogOut, UserCircle, WifiOff, RefreshCw, ClipboardList, ClipboardCheck, PanelLeftClose, PanelLeftOpen, Pin, PinOff, ChevronRight, Download, Share, Check, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button, GlassCard } from './UIComponents';
import { OnboardingTour } from './OnboardingTour';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { signOut, profile, isConnected, checkConnection, markTourSeen } = useAuth();
    const { theme } = useTheme();

    // Sidebar State for Desktop
    const [isSidebarPinned, setIsSidebarPinned] = useState(false);

    // --- NEW FEATURES STATE ---
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isIOS, setIsIOS] = useState(false);
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

    // --- EFFECT: SERVICE WORKER UPDATE HANDLING ---
    useEffect(() => {
        // 1. Listen for the update found event from index.html
        const handleUpdateAvailable = () => setUpdateAvailable(true);
        window.addEventListener('sw-update-available', handleUpdateAvailable);

        // 2. ACTIVE CHECK LOGIC (For long-running sessions)
        const checkForSwUpdate = () => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then((registration) => {
                    // This triggers the browser to check the server for a new sw.js
                    registration.update();
                    console.log("Checking for App Updates...");
                });
            }
        };

        // Check every 15 minutes
        const intervalId = setInterval(checkForSwUpdate, 15 * 60 * 1000);

        // Check immediately when the user comes back to the tab (visibility change)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkForSwUpdate();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('sw-update-available', handleUpdateAvailable);
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // --- EFFECT: INSTALL PROMPT ---
    useEffect(() => {
        // Check if iOS
        const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(isIosDevice);

        // Check if already installed (standalone mode)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        if (isStandalone) return; // Already installed

        // Chrome/Android Event
        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);

            // Check if user has already declined recently
            const declined = localStorage.getItem('install_declined_timestamp');
            if (declined) {
                const diff = Date.now() - parseInt(declined);
                if (diff < 7 * 24 * 60 * 60 * 1000) return; // Don't ask for 7 days
            }

            setTimeout(() => setShowInstallPrompt(true), 3000); // Delay prompt
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        // iOS Logic (Manual Check)
        if (isIosDevice && !isStandalone) {
            const declined = localStorage.getItem('install_declined_timestamp');
            if (!declined) {
                setTimeout(() => setShowInstallPrompt(true), 3000);
            }
        }

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    }, []);

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
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
            });
        } else {
            window.location.reload();
        }
    };

    // --- ACTION: INSTALL APP ---
    const installApp = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setShowInstallPrompt(false);
            }
            setDeferredPrompt(null);
        }
    };

    const dismissInstall = () => {
        setShowInstallPrompt(false);
        localStorage.setItem('install_declined_timestamp', Date.now().toString());
    };

    const completeTour = async () => {
        setShowTour(false);
        await markTourSeen();
    };

    // --- STRICT OFFLINE MODE ---
    if (!isConnected) {
        return (
            <div className="min-h-screen w-full bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
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
        <div className="min-h-screen w-full relative overflow-hidden bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white selection:bg-teal-500/30 flex">

            {/* --- Background Blobs (Dark Mode Only) --- */}
            <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-600/20 rounded-full blur-[120px] animate-pulse-slow pointer-events-none z-0 hidden dark:block" />
            <div className="fixed bottom-[-10%] right-[-20%] w-[500px] h-[500px] bg-teal-600/20 rounded-full blur-[100px] pointer-events-none z-0 hidden dark:block" />
            <div className="fixed top-[40%] left-[30%] w-[300px] h-[300px] bg-cyan-600/10 rounded-full blur-[80px] pointer-events-none z-0 hidden dark:block" />

            {/* --- UPDATE BANNER (Very prominent) --- */}
            {updateAvailable && (
                <div className="fixed top-0 left-0 right-0 z-[100] bg-emerald-600 text-white px-4 py-3 shadow-xl flex items-center justify-between animate-in slide-in-from-top">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <RefreshCw className="animate-spin" size={18} />
                        <span>Neue Version verfügbar!</span>
                    </div>
                    <button
                        onClick={reloadPage}
                        className="bg-white text-emerald-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors"
                    >
                        Aktualisieren
                    </button>
                </div>
            )}

            {/* --- ONBOARDING TOUR --- */}
            {showTour && <OnboardingTour onComplete={completeTour} />}

            {/* --- INSTALL PROMPT MODAL --- */}
            {showInstallPrompt && (
                <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <GlassCard className="w-full max-w-md relative">
                        <button onClick={dismissInstall} className="absolute top-3 right-3 text-white/30 hover:text-white"><X size={20} /></button>
                        <div className="text-center mb-4">
                            <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-400 border border-emerald-500/30">
                                <Download size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-white">App installieren</h2>
                            <p className="text-white/60 text-sm mt-2">
                                Installiere die LagerApp auf deinem Home-Bildschirm für schnelleren Zugriff und Vollbild-Modus.
                            </p>
                        </div>

                        {isIOS ? (
                            <div className="bg-white/5 rounded-xl p-4 text-sm text-white/80 mb-4 border border-white/10">
                                <ol className="list-decimal list-inside space-y-2">
                                    <li>Tippe unten auf <strong>Teilen</strong> <Share size={14} className="inline mx-1" /></li>
                                    <li>Scrolle runter und wähle <strong>Zum Home-Bildschirm</strong></li>
                                    <li>Tippe oben rechts auf <strong>Hinzufügen</strong></li>
                                </ol>
                            </div>
                        ) : (
                            <Button onClick={installApp} className="w-full bg-emerald-600 hover:bg-emerald-500 mb-3">
                                Jetzt installieren
                            </Button>
                        )}

                        <button onClick={dismissInstall} className="w-full py-2 text-xs text-white/40 hover:text-white">
                            Vielleicht später
                        </button>
                    </GlassCard>
                </div>
            )}

            {/* ============================================================================
          DESKTOP SIDEBAR
         ============================================================================ */}
            <aside
                className={`
            hidden lg:flex flex-col justify-between
            fixed left-0 top-0 h-full z-50
            bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-r border-gray-200 dark:border-white/10 shadow-2xl
            transition-all duration-300 ease-in-out
            ${isSidebarPinned ? 'w-64' : 'w-20'}
            ${updateAvailable ? 'pt-12' : ''} /* Push down if update banner */
        `}
            >
                <nav className="flex-1 py-6 flex flex-col gap-2 px-3 overflow-y-auto overflow-x-hidden">
                    {sidebarItems.map((item) => {
                        const isActive = currentPath === item.id;
                        const isScanner = item.id === 'SCANNER_ACTION';
                        return (
                            <button
                                key={item.id}
                                onClick={() => handleNavClick(item.id)}
                                className={`
                              relative group flex items-center rounded-xl transition-all duration-200
                              ${isSidebarPinned ? 'px-4 py-3 gap-3' : 'justify-center p-3'}
                              ${isScanner
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 mt-4 mb-4'
                                        : isActive
                                            ? 'bg-gray-100 dark:bg-white/10 text-emerald-600 dark:text-emerald-400'
                                            : 'text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                                    }
                          `}
                            >
                                <div className={`${isScanner && !isSidebarPinned ? 'scale-110' : ''}`}>{item.icon}</div>
                                {isSidebarPinned && <span className={`font-medium whitespace-nowrap overflow-hidden text-sm ${isScanner ? 'font-bold' : ''}`}>{item.label}</span>}
                                {!isSidebarPinned && (
                                    <div className="absolute left-full ml-4 px-3 py-1.5 bg-gray-800 border border-white/10 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl flex items-center">
                                        {item.label}
                                        <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-800 border-l border-b border-white/10 rotate-45"></div>
                                    </div>
                                )}
                                {isSidebarPinned && isActive && !isScanner && <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-3 border-t border-gray-200 dark:border-white/5 flex flex-col gap-2">
                    <div className={`flex items-center rounded-xl bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/5 ${isSidebarPinned ? 'p-3 gap-3' : 'justify-center p-2'}`}>
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold shrink-0">
                            {profile?.full_name ? profile.full_name.charAt(0) : <UserCircle size={18} />}
                        </div>
                        {isSidebarPinned && (
                            <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="text-xs font-bold text-gray-900 dark:text-white truncate">{profile?.full_name?.split(' ')[0] || 'User'}</div>
                                <div className="text-[10px] text-gray-500 dark:text-white/40 truncate">Angemeldet</div>
                            </div>
                        )}
                        {isSidebarPinned && <button onClick={handleLogout} className="text-gray-400 hover:text-rose-500 dark:text-white/40 dark:hover:text-rose-400 transition-colors p-1"><LogOut size={16} /></button>}
                    </div>
                    {!isSidebarPinned && <button onClick={handleLogout} className="flex justify-center p-3 rounded-xl text-gray-400 hover:text-rose-500 hover:bg-gray-100 dark:text-white/40 dark:hover:text-rose-400 dark:hover:bg-white/5 transition-colors"><LogOut size={20} /></button>}
                    <button onClick={() => setIsSidebarPinned(!isSidebarPinned)} className={`flex items-center rounded-xl transition-colors text-gray-400 hover:text-gray-900 hover:bg-gray-100 dark:text-white/30 dark:hover:text-white dark:hover:bg-white/5 ${isSidebarPinned ? 'px-4 py-3 gap-3' : 'justify-center p-3'}`} title={isSidebarPinned ? "Einklappen" : "Menü fixieren"}>
                        {isSidebarPinned ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                        {isSidebarPinned && <span className="text-xs font-medium">Menü einklappen</span>}
                    </button>
                </div>
            </aside>

            {/* ============================================================================
          MOBILE TOP BAR
         ============================================================================ */}
            <div className={`lg:hidden fixed left-0 right-0 z-40 px-4 py-2 flex justify-end pointer-events-none max-w-4xl mx-auto ${updateAvailable ? 'top-12' : 'top-0'}`}>
                <div className="pointer-events-auto flex items-center gap-2">
                    <div className="bg-white/80 dark:bg-black/20 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-3 border border-gray-200 dark:border-white/5 shadow-lg dark:shadow-none">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-500/30 flex items-center justify-center text-emerald-300 text-xs font-bold">
                                {profile?.full_name ? profile.full_name.charAt(0) : <UserCircle size={14} />}
                            </div>
                            <span className="text-xs text-gray-700 dark:text-white/70 hidden sm:inline">{profile?.full_name?.split(' ')[0] || 'User'}</span>
                        </div>
                        <div className="w-px h-4 bg-gray-300 dark:bg-white/10"></div>
                        <button onClick={handleLogout} className="text-gray-500 hover:text-rose-500 dark:text-white/40 dark:hover:text-rose-400 transition-colors" title="Abmelden">
                            <LogOut size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* --- Main Content Area --- */}
            <main
                className={`
            relative pb-32 px-4 pt-16 w-full mx-auto
            transition-all duration-300 ease-in-out
            lg:pb-8 lg:pt-8
            ${isSidebarPinned ? 'lg:pl-72' : 'lg:pl-28'} 
            lg:max-w-none
            ${updateAvailable ? 'mt-12' : ''}
        `}
            >
                <div className="max-w-6xl mx-auto">
                    {children}
                </div>
            </main>

            {/* ============================================================================
          MOBILE BOTTOM NAVIGATION
         ============================================================================ */}
            <div className="lg:hidden fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none">
                <div className="pointer-events-auto relative max-w-lg w-full mx-4">
                    <nav className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-full shadow-2xl h-14 sm:h-16 flex items-center relative overflow-hidden">
                        <div className="flex items-center justify-between overflow-x-auto w-full h-full px-2 sm:px-6 gap-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                            <div className="flex gap-2 sm:gap-4 shrink-0">
                                {navItemsLeft.map((item) => {
                                    const isActive = currentPath === item.id;
                                    return (
                                        <button key={item.id} onClick={() => navigate(`/${item.id}`)} className={`relative flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full transition-all duration-300 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-white/50 hover:text-gray-900 dark:hover:text-white/80'}`}>
                                            {item.icon}
                                            {isActive && <span className="absolute bottom-1 w-1 h-1 bg-emerald-600 dark:bg-emerald-400 rounded-full" />}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="w-16 shrink-0"></div>
                            <div className="flex gap-2 sm:gap-4 shrink-0">
                                {navItemsRight.map((item) => {
                                    const isActive = currentPath === item.id;
                                    return (
                                        <button key={item.id} onClick={() => navigate(`/${item.id}`)} className={`relative flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full transition-all duration-300 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-white/50 hover:text-gray-900 dark:hover:text-white/80'}`}>
                                            {item.icon}
                                            {isActive && <span className="absolute bottom-1 w-1 h-1 bg-emerald-600 dark:bg-emerald-400 rounded-full" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </nav>
                    <button onClick={handleCenterButtonClick} className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[60%] flex items-center justify-center w-16 h-16 rounded-full shadow-lg border-4 border-gray-50 dark:border-gray-900 transition-all duration-300 transform hover:scale-105 active:scale-95 ${currentPath === 'audit' ? 'bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white shadow-purple-500/30' : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-500/30'}`}>
                        <ScanLine size={28} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Layout;