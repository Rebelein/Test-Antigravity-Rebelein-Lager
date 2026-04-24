import React, { useMemo } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { GlassModal } from './UIComponents';
import { X, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MasterDetailLayoutProps {
    /** The title shown in mobile header when details are open */
    title?: string;
    /** The list view (always visible on desktop, visible when no detail on mobile) */
    listContent: React.ReactNode;
    /** The detail view (side panel on desktop, modal/full page on mobile) */
    detailContent: React.ReactNode;
    /** Whether the detail view is currently active */
    isOpen: boolean;
    /** Function to close the detail view */
    onClose: () => void;
    /** Optional class name for the wrapper */
    className?: string;
    /** Optional children (e.g. global modals) */
    children?: React.ReactNode;
    /** Optional: Hide the default header (useful if content has its own header) */
    hideHeader?: boolean;
    /** Optional: Custom class for content wrapper (default: "p-6 overflow-y-auto custom-scrollbar") */
    contentClassName?: string;
    /** width of the side panel (default: "35%") - use valid CSS string */
    panelWidth?: string;
}

export const MasterDetailLayout: React.FC<MasterDetailLayoutProps> = ({
    title,
    listContent,
    detailContent,
    isOpen,
    onClose,
    className = '',
    children,
    hideHeader = false,
    contentClassName = "p-6 overflow-y-auto custom-scrollbar",
    panelWidth: initialPanelWidth = "35%"
}) => {
    const isMobile = useIsMobile();

    // RESIZABLE LOGIC
    // Initialize width from localStorage or default
    const [sidebarWidth, setSidebarWidth] = React.useState<number>(() => {
        const saved = localStorage.getItem('sidebar_width');
        return saved ? parseInt(saved, 10) : 450; // Default to 450px if nothing saved
    });

    // Fallback if not saved: use initialPanelWidth only if explicitly provided/different? 
    // Actually simplicity: we prioritize localStorage over props for resizing feature.

    const [isResizing, setIsResizing] = React.useState(false);

    const startResizing = React.useCallback((e: React.MouseEvent | React.TouchEvent) => {
        setIsResizing(true);
        // Prevent scrolling while dragging
        if (e.type === 'touchstart') {
            // e.preventDefault() is often passive in React 18+, but usually not needed for simple start
        } else {
            e.preventDefault();
        }
    }, []);

    const stopResizing = React.useCallback(() => {
        setIsResizing(false);
        localStorage.setItem('sidebar_width', sidebarWidth.toString());
    }, [sidebarWidth]);

    const resize = React.useCallback((e: MouseEvent | TouchEvent) => {
        if (isResizing) {
            let clientX;
            if (window.TouchEvent && e instanceof TouchEvent) {
                clientX = e.touches[0].clientX;
            } else if (e instanceof MouseEvent) {
                clientX = e.clientX;
            } else {
                return;
            }

            // Calculate new width: Total Window Width - X Position
            const newWidth = window.innerWidth - clientX;
            // Limits: Min 300px, Max 80% screen
            if (newWidth > 300 && newWidth < window.innerWidth * 0.8) {
                setSidebarWidth(newWidth);
            }
        }
    }, [isResizing]);

    React.useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
            window.addEventListener('touchmove', resize);
            window.addEventListener('touchend', stopResizing);
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            window.removeEventListener('touchmove', resize);
            window.removeEventListener('touchend', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            window.removeEventListener('touchmove', resize);
            window.removeEventListener('touchend', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);


    // Calculate list width
    const listWidth = useMemo(() => {
        if (!isOpen) return "100%";
        // On desktop, we use the specific pixel width
        if (!isMobile) return `calc(100% - ${sidebarWidth}px)`;
        return "0%"; // Should not happen in Split View
    }, [isOpen, sidebarWidth, isMobile]);

    // MOBILE LAYOUT: Use Modal or Slide-Over behavior
    if (isMobile) {
        return (
            <div className="w-full h-full relative bg-black">
                {/* Wrap list in a motion div to create iOS/Vaul scale down effect */}
                <motion.div 
                    animate={{ 
                        scale: isOpen ? 0.93 : 1, 
                        opacity: isOpen ? 0.5 : 1,
                        borderRadius: isOpen ? '1.5rem' : '0rem',
                        y: isOpen ? '10px' : '0px'
                    }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className={`w-full h-full flex flex-col overflow-hidden bg-background origin-top ${className}`}
                >
                    {listContent}
                </motion.div>

                <AnimatePresence>
                    {isOpen && (
                        <>
                            {/* Mobile Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={onClose}
                                className="fixed inset-0 z-[170] bg-black/40 backdrop-blur-[2px]"
                            />
                            
                            {/* Mobile Bottom Sheet */}
                            <motion.div
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "100%" }}
                                transition={{ type: "spring", damping: 25, stiffness: 300, mass: 0.8 }}
                                // We use drag="y" to allow swiping down to close
                                drag="y"
                                dragConstraints={{ top: 0 }}
                                dragElastic={0.2}
                                onDragEnd={(e, info) => {
                                    if (info.offset.y > 100 || info.velocity.y > 500) {
                                        onClose();
                                    }
                                }}
                                className="fixed inset-x-0 bottom-0 z-[180] bg-card text-card-foreground shadow-[0_-10px_40px_rgba(0,0,0,0.3)] rounded-t-[2rem] flex flex-col h-[90vh] ring-1 ring-white/10"
                            >
                                {/* Drag Handle */}
                                <div className="w-full flex justify-center py-3 shrink-0 cursor-grab active:cursor-grabbing">
                                    <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
                                </div>

                                {/* Sheet Header */}
                                {!hideHeader && title && (
                                    <div className="flex items-center justify-between px-6 pb-4 border-b border-border/50 shrink-0">
                                        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 truncate pr-4">
                                            {title}
                                        </h2>
                                        <button
                                            onClick={onClose}
                                            className="p-2 -mr-2 rounded-full hover:bg-white/10 text-muted-foreground hover:text-white transition-all focus:outline-none"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                )}

                                {/* Content */}
                                <div className={`flex-1 overflow-y-auto custom-scrollbar relative z-0 ${contentClassName}`}>
                                    {detailContent}
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
                {children}
            </div>
        );
    }

    // DESKTOP LAYOUT: Split View with Slide Animation
    return (
        <div className={`relative h-[calc(100vh-2rem)] overflow-hidden flex ${className}`}>
            {/* LIST CONTENT (Animates Width) */}
            <motion.div
                initial={false}
                animate={{ width: !isOpen ? "100%" : `calc(100% - ${sidebarWidth}px)` }}
                transition={{ type: "spring", damping: 30, stiffness: 350 }}
                className="h-full overflow-hidden"
            >
                <div className="h-full w-full overflow-y-auto custom-scrollbar pr-2">
                    {listContent}
                </div>
            </motion.div>

            {/* DETAIL DRAWER (Slides in from right, Absolute to allow slide effect) */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ x: "100%", opacity: 0.5 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "100%", opacity: 0.5 }}
                        transition={{ type: "spring", damping: 30, stiffness: 350, mass: 0.8 }}
                        style={{ width: sidebarWidth }}
                        className="absolute top-0 right-0 h-full bg-card/95 backdrop-blur-3xl shadow-[-20px_0_50px_-10px_rgba(0,0,0,0.5)] z-50 flex flex-col border-l border-border ring-1 ring-white/5"
                    >
                        {/* Highlight Overlay (Left side) */}
                        <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent pointer-events-none" />

                        {/* RESIZE HANDLE */}
                        <div
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/20 transition-colors z-[60] -ml-[4px] group flex items-center justify-center"
                            onMouseDown={startResizing}
                            onTouchStart={startResizing}
                        >
                            <div className="h-12 w-1 bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        {/* Drawer Header */}
                        {!hideHeader && (
                            <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 shrink-0 bg-transparent z-10 relative">
                                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 truncate pr-4">
                                    {title || 'Details'}
                                </h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 -mr-2 rounded-full hover:bg-white/10 text-muted-foreground hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        )}

                        {/* Detail Content */}
                        <div className={`flex-1 relative z-0 ${contentClassName}`}>
                            {detailContent}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            {children}
        </div>
    );
};
