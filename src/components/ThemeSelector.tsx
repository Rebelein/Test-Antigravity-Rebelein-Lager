import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Palette } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface ThemeSelectorProps {
    isOpen: boolean;
    onClose: () => void;
}

const themes = [
    {
        id: 'default' as const,
        name: 'Standard',
        description: 'Klassisches dunkles Design mit Emerald-Akzenten',
        colors: ['#10b981', '#14b8a6', '#030712'],
        bgPreview: 'bg-gray-950',
    },
    {
        id: 'glass' as const,
        name: 'Glass Dark',
        description: 'Luxuriöses Glasmorphismus-Design mit Emerald & Gold',
        colors: ['#059669', '#d4a574', '#0a0f0d'],
        bgPreview: 'bg-[#0a0f0d]',
    },
];

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ isOpen, onClose }) => {
    const { theme, setTheme } = useTheme();

    const handleSelectTheme = (themeId: 'default' | 'glass') => {
        setTheme(themeId);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-0 z-[201] flex items-center justify-center p-4"
                    >
                        <div className="glass-panel rounded-2xl w-full max-w-md p-6 relative overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                        <Palette size={20} className="text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Design wählen</h2>
                                        <p className="text-xs text-white/50">Passe das Aussehen der App an</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white/50 hover:text-white"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Theme Options */}
                            <div className="space-y-3">
                                {themes.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleSelectTheme(t.id)}
                                        className={`w-full p-4 rounded-xl border transition-all duration-200 text-left relative overflow-hidden group ${theme === t.id
                                            ? 'border-emerald-500/50 bg-emerald-500/10'
                                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            {/* Preview Colors */}
                                            <div className={`w-16 h-12 rounded-lg flex-shrink-0 overflow-hidden ${t.bgPreview} relative`}>
                                                <div className="absolute inset-0 flex items-center justify-center gap-1 p-2">
                                                    {t.colors.map((color, i) => (
                                                        <div
                                                            key={i}
                                                            className="w-3 h-3 rounded-full"
                                                            style={{ backgroundColor: color }}
                                                        />
                                                    ))}
                                                </div>
                                                {/* Glass effect overlay for glass theme */}
                                                {t.id === 'glass' && (
                                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-white">{t.name}</span>
                                                    {theme === t.id && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                                                            Aktiv
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-white/50 mt-0.5 line-clamp-2">{t.description}</p>
                                            </div>

                                            {/* Check */}
                                            <div
                                                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${theme === t.id
                                                    ? 'bg-emerald-500 text-white'
                                                    : 'border-2 border-white/20 group-hover:border-white/40'
                                                    }`}
                                            >
                                                {theme === t.id && <Check size={14} />}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Footer Note */}
                            <p className="text-xs text-white/30 text-center mt-4">
                                Das Theme wird automatisch gespeichert
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ThemeSelector;
