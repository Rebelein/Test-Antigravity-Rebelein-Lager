import React from 'react';
import { GlassModal, Button } from '../../../../components/UIComponents';
import { Monitor, LayoutTemplate, Zap, Warehouse, Factory, Tag, Library, Database, Wand2, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../../../contexts/ThemeContext';

interface AppDrawerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onResetLayout: () => void;
    onOpenSqlModal: () => void;
    onOpenPageManager: () => void;
}

export const AppDrawerModal: React.FC<AppDrawerModalProps> = ({ 
    isOpen, 
    onClose, 
    onResetLayout, 
    onOpenSqlModal, 
    onOpenPageManager 
}) => {
    const navigate = useNavigate();
    const { viewMode, toggleViewMode, isLowPerfMode, toggleLowPerfMode } = useTheme();

    if (!isOpen) return null;

    return (
        <GlassModal
            isOpen={isOpen}
            onClose={onClose}
            title="Apps & Funktionen"
        >
            <div className="p-6 space-y-8">

                {/* --- DESIGN & ANSICHT SECTION --- */}
                <div className="mb-8 p-4 rounded-2xl bg-muted border border-white/5">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Design & Ansicht</h3>
                    <div className="space-y-4">
                        {/* View Mode Toggle */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${viewMode === 'desktop' ? 'bg-blue-100 text-blue-600' : 'bg-muted text-muted-foreground'}`}>
                                    <Monitor size={18} />
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-white">Desktop Modus</div>
                                    <div className="text-xs text-muted-foreground">{viewMode === 'desktop' ? 'Aktiviert (Full HD)' : 'Standard (Tablet)'}</div>
                                </div>
                            </div>
                            <button
                                onClick={toggleViewMode}
                                className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${viewMode === 'desktop' ? 'bg-primary' : 'bg-gray-300'}`}
                            >
                                <div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${viewMode === 'desktop' ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {/* Reset Layout */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                                    <LayoutTemplate size={18} />
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-white">Layout zurücksetzen</div>
                                    <div className="text-xs text-muted-foreground">Standard wiederherstellen</div>
                                </div>
                            </div>
                            <Button onClick={onResetLayout} variant="secondary" className="text-xs py-1 h-8">
                                Reset
                            </Button>
                        </div>

                        {/* iOS Performance Mode Toggle */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isLowPerfMode ? 'bg-amber-500/20 text-amber-400' : 'bg-muted text-muted-foreground'}`}>
                                    <Zap size={18} />
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-white">iOS Performance</div>
                                    <div className="text-xs text-muted-foreground">{isLowPerfMode ? 'Aktiviert (schneller)' : 'Deaktiviert (Blur aktiv)'}</div>
                                </div>
                            </div>
                            <button
                                onClick={toggleLowPerfMode}
                                className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${isLowPerfMode ? 'bg-amber-500' : 'bg-gray-300'}`}
                            >
                                <div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${isLowPerfMode ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-8">
                    {/* App: Warehouses */}
                    <button onClick={() => { onClose(); navigate('/warehouses'); }} className="flex flex-col items-center gap-2 group">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                            <Warehouse size={28} className="text-emerald-400" />
                        </div>
                        <span className="text-xs text-muted-foreground group-hover:text-white text-center">Lagerorte</span>
                    </button>

                    {/* App: Suppliers */}
                    <button onClick={() => { onClose(); navigate('/suppliers'); }} className="flex flex-col items-center gap-2 group">
                        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                            <Factory size={28} className="text-purple-400" />
                        </div>
                        <span className="text-xs text-muted-foreground group-hover:text-white text-center">Lieferanten</span>
                    </button>

                    {/* App: Labels */}
                    <button onClick={() => { onClose(); navigate('/labels'); }} className="flex flex-col items-center gap-2 group">
                        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                            <Tag size={28} className="text-blue-400" />
                        </div>
                        <span className="text-xs text-muted-foreground group-hover:text-white text-center">Etiketten</span>
                    </button>

                    {/* App: Shelf Editor (NEW) */}
                    <button onClick={() => { onClose(); navigate('/shelf-editor'); }} className="flex flex-col items-center gap-2 group">
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                            <Library size={28} className="text-amber-400" />
                        </div>
                        <span className="text-xs text-muted-foreground group-hover:text-white text-center">Regal-Editor</span>
                    </button>

                    {/* App: Database */}
                    <button onClick={() => { onClose(); onOpenSqlModal(); }} className="flex flex-col items-center gap-2 group">
                        <div className="w-16 h-16 rounded-2xl bg-card/30 border border-border flex items-center justify-center group-hover:bg-card transition-colors">
                            <Database size={28} className="text-gray-300" />
                        </div>
                        <span className="text-xs text-muted-foreground group-hover:text-white text-center">System</span>
                    </button>

                    {/* App: Image Optimizer */}
                    <button onClick={() => { onClose(); navigate('/image-optimizer'); }} className="flex flex-col items-center gap-2 group">
                        <div className="w-16 h-16 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center group-hover:bg-fuchsia-500/20 transition-colors">
                            <Wand2 size={28} className="text-fuchsia-400" />
                        </div>
                        <span className="text-xs text-muted-foreground group-hover:text-white text-center">Optimierer</span>
                    </button>

                    {/* App: Page Manager (NEW) */}
                    <button onClick={() => { onClose(); onOpenPageManager(); }} className="flex flex-col items-center gap-2 group">
                        <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center group-hover:bg-teal-500/20 transition-colors">
                            <LayoutDashboard size={28} className="text-teal-400" />
                        </div>
                        <span className="text-xs text-muted-foreground group-hover:text-white text-center">Seiten</span>
                    </button>
                </div>
            </div>
        </GlassModal>
    );
};
