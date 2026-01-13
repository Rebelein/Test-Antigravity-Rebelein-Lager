import React, { useMemo } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
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

    const startResizing = React.useCallback((e: React.MouseEvent) => {
        setIsResizing(true);
        e.preventDefault();
    }, []);

    const stopResizing = React.useCallback(() => {
        setIsResizing(false);
        localStorage.setItem('sidebar_width', sidebarWidth.toString());
    }, [sidebarWidth]);

    const resize = React.useCallback((e: MouseEvent) => {
        if (isResizing) {
            // Calculate new width: Total Window Width - Mouse X Position
            const newWidth = window.innerWidth - e.clientX;
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
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
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
            <>
                <div className={`w-full min-h-screen pb-20 ${className}`}>
                    {listContent}
                </div>

                <AnimatePresence>
                    {isOpen && (
                        <GlassModal
                            isOpen={isOpen}
                            onClose={onClose}
                            title={title || 'Details'}
                            fullScreen={true}
                        >
                            {detailContent}
                        </GlassModal>
                    )}
                </AnimatePresence>
                {children}
            </>
        );
    }

    // DESKTOP LAYOUT: Split View with Slide Animation
    return (
        <div className={`relative h-[calc(100vh-2rem)] overflow-hidden flex ${className}`}>
            {/* LIST CONTENT (Animates Width) */}
            <motion.div
                initial={false}
                animate={{ width: !isOpen ? "100%" : `calc(100% - ${sidebarWidth}px)` }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
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
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        style={{ width: sidebarWidth }}
                        className="absolute top-0 right-0 h-full bg-[#1a1d24] border-l border-white/10 shadow-2xl z-50 flex flex-col"
                    >
                        {/* RESIZE HANDLE */}
                        <div
                            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/50 transition-colors z-[60] -ml-[3px]"
                            onMouseDown={startResizing}
                        />

                        {/* Drawer Header */}
                        {!hideHeader && (
                            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5 shrink-0">
                                <h2 className="text-lg font-semibold text-white/90 truncate pr-4">
                                    {title || 'Details'}
                                </h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        )}

                        {/* Detail Content */}
                        <div className={`flex-1 ${contentClassName}`}>
                            {detailContent}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            {children}
        </div>
    );
};
