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
    panelWidth = "35%"
}) => {
    const isMobile = useIsMobile();

    // Calculate list width
    const listWidth = useMemo(() => {
        if (!isOpen) return "100%";
        return `calc(100% - ${panelWidth})`;
    }, [isOpen, panelWidth]);

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
                animate={{ width: listWidth }}
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
                        style={{ width: panelWidth }}
                        className="absolute top-0 right-0 h-full min-w-[450px] bg-[#1a1d24] border-l border-white/10 shadow-2xl z-50 flex flex-col"
                    >
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
