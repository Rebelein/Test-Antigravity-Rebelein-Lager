import React, { useState, useEffect } from 'react';
import { NavRoute } from '../../types';
import { LayoutDashboard, Package, Drill, ShoppingCart, ScanLine, LogOut, UserCircle, WifiOff, RefreshCw, ClipboardList, ClipboardCheck, PanelLeftClose, PanelLeftOpen, Pin, PinOff, ChevronRight, Download, Share, Check, X, Key as KeyIcon, Shirt, Palette, Sun, Moon, Search } from 'lucide-react';
import { PushNotificationToggle } from './PushNotificationToggle';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useConnection } from '../../contexts/ConnectionContext';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from './UIComponents';
import { GlassLayout } from './GlassLayout';
import { OnboardingTour } from './OnboardingTour';
import { InstallPrompt } from './InstallPrompt';
import { ThemeSelector } from './ThemeSelector';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { usePersistentState } from '../../hooks/usePersistentState';
import NotificationToast from './NotificationToast';
import { useIsIOS } from '../../hooks/useIsIOS';
import { ALL_NAV_ITEMS, DEFAULT_SIDEBAR_ORDER } from './NavConfig';
import { AnimatedBackground } from './ui/AnimatedBackground';
import { useDeviceMode } from '../../hooks/useDeviceMode';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { signOut, profile } = useAuth();
    const { isConnected, checkConnection } = useConnection();
    const { markTourSeen } = useUserPreferences();
    const { theme, isLowPerfMode, colorMode, toggleColorMode } = useTheme();
    const device = useDeviceMode();

    // Sidebar State for Desktop
    const [isSidebarPinned, setIsSidebarPinned] = usePersistentState('sidebar-pinned', false);

    // Theme Selector Modal
    const [showThemeSelector, setShowThemeSelector] = useState(false);

    // Update Banner State
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [showTour, setShowTour] = useState(false);

    // Global Enter Key Safeguard
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                const target = e.target as HTMLElement;
                if (target === document.body || target.tagName === 'DIV' || target.tagName === 'MAIN') {
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    // Determine active route
    const currentPath = location.pathname.substring(1) || 'dashboard';

    // Navigation order state
    const [sidebarOrder] = usePersistentState<string[]>('sidebar-order', []);
    const activeOrder = (sidebarOrder && sidebarOrder.length > 0) ? sidebarOrder : DEFAULT_SIDEBAR_ORDER;

    // Check onboarding tour status
    useEffect(() => {
        if (profile && profile.has_seen_tour === false) {
            setTimeout(() => setShowTour(true), 1000);
        }
    }, [profile]);

    // Service Worker PWA update handler
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            if (r) {
                r.update();
                setInterval(() => {
                    r.update();
                }, 2 * 60 * 1000);
            }
        },
    });

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
            navigate('/stocktaking', { replace: true });
        }
    };

    const handleNavClick = (itemId: string) => {
        if (itemId === 'SCANNER_ACTION') {
            handleCenterButtonClick();
        } else {
            navigate(`/${itemId}`);
        }
    };

    const reloadPage = () => {
        updateServiceWorker(true);
    };

    const completeTour = async () => {
        setShowTour(false);
        await markTourSeen();
    };

    if (!isConnected) {
        return (
            <div className="min-h-screen w-full bg-transparent flex flex-col items-center justify-center p-6 text-center">
                <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center mb-6 animate-pulse">
                    <WifiOff size={48} className="text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Keine Verbindung</h1>
                <p className="text-muted-foreground mb-8 max-w-xs">
                    Um sicherzustellen, dass du immer mit aktuellen Lagerbeständen arbeitest, ist die Nutzung offline deaktiviert.
                </p>
                <Button onClick={() => checkConnection()} icon={<RefreshCw size={18} />}>
                    Verbindung prüfen
                </Button>
            </div>
        );
    }

    const currentNavItem = ALL_NAV_ITEMS.find(i => i.id === currentPath);

    return (
        <GlassLayout>
            {!isLowPerfMode && <AnimatedBackground />}
            <ThemeSelector isOpen={showThemeSelector} onClose={() => setShowThemeSelector(false)} />
            <NotificationToast />

            {/* --- UPDATE BANNER --- */}
            <AnimatePresence>
                {updateAvailable && (
                    <motion.div
                        initial={{ y: -100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -100, opacity: 0 }}
                        className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-card text-card-foreground shadow-sm rounded-xl border border-border px-6 py-3 rounded-full flex items-center gap-4 shadow-2xl border-emerald-500/30"
                    >
                        <div className="flex items-center gap-2 text-sm font-medium dark:text-emerald-400 text-emerald-800">
                            <RefreshCw className="animate-spin" size={18} />
                            <span>Neue Version verfügbar!</span>
                        </div>
                        <button
                            onClick={reloadPage}
                            className="bg-primary text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-primary transition-colors shadow-lg shadow-emerald-500/20"
                        >
                            Aktualisieren
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {showTour && <OnboardingTour onComplete={completeTour} />}
            <InstallPrompt />

            {/* ============================================================================
                1. DESKTOP & TABLET LANDSCAPE SIDEBAR / RAIL
               ============================================================================ */}
            {(device.isDesktop || device.isTabletLandscape) && (
                <motion.aside
                    initial={isLowPerfMode ? { opacity: 0 } : { x: -100, opacity: 0 }}
                    animate={isLowPerfMode ? { opacity: 1 } : { x: 0, opacity: 1 }}
                    transition={{ duration: isLowPerfMode ? 0.2 : 0.4 }}
                    className={clsx(
                        "fixed left-4 top-4 bottom-4 z-50 flex flex-col justify-between",
                        "bg-card text-card-foreground shadow-sm rounded-3xl border border-border shadow-2xl backdrop-blur-md",
                        "transition-all duration-300 ease-in-out",
                        device.isDesktop
                            ? (isSidebarPinned ? 'w-64' : 'w-20')
                            : 'w-20' // Tablet Landscape always icon rail
                    )}
                >
                    <nav className="flex-1 py-6 flex flex-col gap-2 px-3 overflow-y-auto overflow-x-hidden custom-scrollbar">
                        {/* App Logo / Header Badge */}
                        <div className={clsx("flex items-center gap-3 px-2 mb-4", (device.isDesktop && isSidebarPinned) ? '' : 'justify-center')}>
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black shadow-lg shadow-emerald-500/20 shrink-0">
                                R
                            </div>
                            {device.isDesktop && isSidebarPinned && (
                                <div className="flex flex-col min-w-0">
                                    <span className="font-extrabold text-foreground tracking-tight text-base truncate">Rebelein</span>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Lager App</span>
                                </div>
                            )}
                        </div>

                        {activeOrder.map(itemId => {
                            const item = ALL_NAV_ITEMS.find(i => i.id === itemId);
                            if (!item) return null;

                            const isActive = currentPath === item.id;
                            const isScanner = item.id === 'SCANNER_ACTION';
                            const isExpanded = device.isDesktop && isSidebarPinned;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleNavClick(item.id)}
                                    className={clsx(
                                        "relative group flex items-center rounded-2xl transition-all duration-200 cursor-pointer",
                                        isExpanded ? 'px-4 py-3 gap-3' : 'justify-center p-3.5',
                                        isScanner
                                            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 my-3'
                                            : isActive
                                                ? 'bg-primary/10 text-primary dark:text-emerald-400 font-semibold shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                                    )}
                                >
                                    <div className={clsx("transition-transform duration-200", isScanner && !isExpanded && 'scale-110')}>{item.icon}</div>
                                    {isExpanded && <span className={clsx("whitespace-nowrap overflow-hidden text-sm", isScanner ? 'font-bold' : 'font-medium')}>{item.label}</span>}

                                    {/* Tooltip for icon rail */}
                                    {!isExpanded && (
                                        <div className="absolute left-full ml-4 px-3 py-1.5 bg-background/95 backdrop-blur-md border border-border text-foreground text-xs font-semibold rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-2xl flex items-center">
                                            {item.label}
                                            <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-background border-l border-b border-border rotate-45"></div>
                                        </div>
                                    )}
                                    {isExpanded && isActive && !isScanner && (
                                        <motion.div layoutId="active-pill" className="absolute right-3 w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    <div className="p-3 border-t border-border/50 flex flex-col gap-2">
                        {/* Profile Bar */}
                        <div className={clsx("flex items-center rounded-2xl bg-muted/50 border border-border/60", (device.isDesktop && isSidebarPinned) ? 'p-3 gap-3' : 'justify-center p-2.5')}>
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                                {profile?.full_name ? profile.full_name.charAt(0) : <UserCircle size={18} />}
                            </div>
                            {device.isDesktop && isSidebarPinned && (
                                <div className="flex-1 min-w-0 overflow-hidden">
                                    <div className="text-xs font-bold text-foreground truncate">{profile?.full_name?.split(' ')[0] || 'User'}</div>
                                    <div className="text-[10px] text-muted-foreground truncate">Angemeldet</div>
                                </div>
                            )}
                            {device.isDesktop && isSidebarPinned && (
                                <button onClick={handleLogout} className="text-muted-foreground hover:text-rose-500 transition-colors p-1" title="Abmelden">
                                    <LogOut size={16} />
                                </button>
                            )}
                        </div>

                        {!isSidebarPinned && (
                            <button onClick={handleLogout} className="flex justify-center p-3 rounded-2xl text-muted-foreground hover:text-rose-500 hover:bg-muted/70 transition-colors" title="Abmelden">
                                <LogOut size={20} />
                            </button>
                        )}

                        {/* Theme Button */}
                        <button
                            onClick={() => setShowThemeSelector(true)}
                            className={clsx(
                                "flex items-center rounded-2xl transition-colors hover:bg-muted/70 text-muted-foreground hover:text-foreground cursor-pointer",
                                (device.isDesktop && isSidebarPinned) ? 'px-4 py-3 gap-3' : 'justify-center p-3'
                            )}
                            title="Design ändern"
                        >
                            <Palette size={20} />
                            {device.isDesktop && isSidebarPinned && <span className="text-xs font-medium">Design</span>}
                        </button>

                        {/* Light/Dark Toggle */}
                        <button
                            onClick={toggleColorMode}
                            className={clsx(
                                "flex items-center rounded-2xl transition-colors hover:bg-muted/70 text-muted-foreground hover:text-foreground cursor-pointer",
                                (device.isDesktop && isSidebarPinned) ? 'px-4 py-3 gap-3' : 'justify-center p-3'
                            )}
                            title={colorMode === 'dark' ? "Helles Design" : "Dunkles Design"}
                        >
                            {colorMode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                            {device.isDesktop && isSidebarPinned && <span className="text-xs font-medium">Farbschema</span>}
                        </button>

                        {/* Collapse/Expand Sidebar Toggle (Desktop Only) */}
                        {device.isDesktop && (
                            <button
                                onClick={() => setIsSidebarPinned(!isSidebarPinned)}
                                className={clsx("flex items-center rounded-2xl transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/70 cursor-pointer", isSidebarPinned ? 'px-4 py-3 gap-3' : 'justify-center p-3')}
                                title={isSidebarPinned ? "Sidebar einklappen" : "Sidebar fixieren"}
                            >
                                {isSidebarPinned ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                                {isSidebarPinned && <span className="text-xs font-medium">Menü einklappen</span>}
                            </button>
                        )}
                    </div>
                </motion.aside>
            )}

            {/* Top header bar removed per user request for cleaner app layout */}

            {/* ============================================================================
                3. TABLET PORTRAIT / HOCHKANT BOTTOM NAV BAR
               ============================================================================ */}
            {device.isTabletPortrait && (
                <div className="fixed bottom-4 left-4 right-4 z-50 bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-2 flex items-center justify-around">
                    {activeOrder.slice(0, 7).map(itemId => {
                        const item = ALL_NAV_ITEMS.find(i => i.id === itemId);
                        if (!item) return null;

                        const isActive = currentPath === item.id;
                        const isScanner = item.id === 'SCANNER_ACTION';

                        return (
                            <button
                                key={item.id}
                                onClick={() => handleNavClick(item.id)}
                                className={clsx(
                                    "flex flex-col items-center gap-1 p-2 rounded-xl transition-all cursor-pointer",
                                    isScanner
                                        ? "bg-primary text-white p-3 rounded-full shadow-lg shadow-emerald-500/30 -mt-6"
                                        : isActive
                                            ? "text-primary bg-primary/10 font-bold"
                                            : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {item.icon}
                                {!isScanner && <span className="text-[10px] font-medium">{item.label}</span>}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ============================================================================
                4. SMARTPHONE MOBILE TOP BAR & BOTTOM DOCK
               ============================================================================ */}
            {device.isMobile && currentPath === 'dashboard' && (
                <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className={clsx("fixed left-0 right-0 z-40 px-4 py-2 flex justify-end pointer-events-none max-w-4xl mx-auto mt-[env(safe-area-inset-top)]", updateAvailable ? 'top-12' : 'top-0')}
                >
                    <div className="pointer-events-auto flex items-center gap-2">
                        <div className="bg-card text-card-foreground shadow-sm border border-border rounded-full px-3 py-1.5 flex items-center gap-3 shadow-lg">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center text-primary text-xs font-bold">
                                    {profile?.full_name ? profile.full_name.charAt(0) : <UserCircle size={14} />}
                                </div>
                                <span className="text-xs text-muted-foreground hidden sm:inline">{profile?.full_name?.split(' ')[0] || 'User'}</span>
                            </div>
                            <div className="w-px h-4 bg-muted"></div>
                            <button
                                onClick={toggleColorMode}
                                className="text-muted-foreground hover:text-amber-400 transition-colors cursor-pointer"
                                title={colorMode === 'dark' ? "Helles Design" : "Dunkles Design"}
                            >
                                {colorMode === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                            </button>
                            <div className="w-px h-4 bg-muted"></div>
                            <button onClick={handleLogout} className="text-muted-foreground hover:text-rose-500 transition-colors" title="Abmelden">
                                <LogOut size={14} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {device.isMobile && (
                <motion.div
                    initial={isLowPerfMode ? { opacity: 0 } : { y: 100, opacity: 0 }}
                    animate={isLowPerfMode ? { opacity: 1 } : { y: 0, opacity: 1 }}
                    className="fixed bottom-0 left-0 right-0 z-[160] w-full"
                >
                    <div className="w-full bg-card/90 backdrop-blur-md border-t border-border shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
                        <nav className="h-16 flex items-center relative overflow-hidden">
                            <div className="flex items-center justify-between overflow-x-auto w-full h-full px-2 sm:px-6 gap-2">
                                {(() => {
                                    const dockItems = activeOrder.filter(id => id !== 'SCANNER_ACTION').map(id => ALL_NAV_ITEMS.find(i => i.id === id)).filter(Boolean);
                                    const leftItems = dockItems.slice(0, 3);
                                    const rightItems = dockItems.slice(3);

                                    return (
                                        <div className="flex items-center w-full h-full">
                                            <div className="flex-1 flex justify-end gap-1 sm:gap-2 pr-1 items-center">
                                                {leftItems.map((item) => {
                                                    if (!item) return null;
                                                    const isActive = currentPath === item.id;
                                                    return (
                                                        <button key={item.id} onClick={() => navigate(`/${item.id}`)} className={clsx("relative flex flex-col items-center justify-center w-12 h-16 shrink-0 cursor-pointer", isActive ? 'text-primary' : 'text-muted-foreground')}>
                                                            <div className={clsx("p-1.5 rounded-xl transition-all", isActive ? "bg-muted" : "")}>
                                                                {item.icon}
                                                            </div>
                                                            <span className={clsx("text-[10px] mt-0.5", isActive ? "font-bold" : "font-medium")}>{item.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <div className="w-16 shrink-0"></div>

                                            <div className="flex-1 flex justify-start overflow-x-auto gap-1 sm:gap-2 pl-1 items-center">
                                                {rightItems.map((item) => {
                                                    if (!item) return null;
                                                    const isActive = currentPath === item.id;
                                                    return (
                                                        <button key={item.id} onClick={() => navigate(`/${item.id}`)} className={clsx("relative flex flex-col items-center justify-center w-12 h-16 shrink-0 cursor-pointer", isActive ? 'text-primary' : 'text-muted-foreground')}>
                                                            <div className={clsx("p-1.5 rounded-xl transition-all", isActive ? "bg-muted" : "")}>
                                                                {item.icon}
                                                            </div>
                                                            <span className={clsx("text-[10px] mt-0.5", isActive ? "font-bold" : "font-medium")}>{item.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </nav>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleCenterButtonClick}
                            className={clsx(
                                "absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-14 h-14 rounded-full shadow-2xl border-4 border-background transition-all cursor-pointer",
                                currentPath === 'audit' ? 'bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white shadow-purple-500/40' : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-500/40'
                            )}
                        >
                            <ScanLine size={24} />
                        </motion.button>
                    </div>
                </motion.div>
            )}

            {/* ============================================================================
                5. MAIN CONTENT WRAPPER WITH DEVICE-SPECIFIC PADDING
               ============================================================================ */}
            <main
                className={clsx(
                    "relative w-full mx-auto flex-1 min-h-0 transition-all duration-300 ease-in-out flex flex-col h-full overflow-hidden",
                    device.isDesktop
                        ? (isSidebarPinned ? 'pl-[18rem] pt-4 pb-4 px-6' : 'pl-[7rem] pt-4 pb-4 px-6')
                        : device.isTabletLandscape
                            ? 'pl-[7rem] pt-4 pb-4 px-6'
                            : device.isTabletPortrait
                                ? 'pt-4 pb-24 px-6'
                                : clsx('pb-20 px-4', currentPath === 'dashboard' ? 'pt-[calc(4rem+env(safe-area-inset-top))]' : 'pt-4') // Mobile (dashboard clears the floating user pill)
                )}
            >
                <div className="w-full h-full flex flex-col overflow-hidden">
                    {children}
                </div>
            </main>
        </GlassLayout>
    );
};

export default Layout;