import React from 'react';
import { GlassModal } from '../../../../components/UIComponents';
import { ALL_NAV_ITEMS, DEFAULT_SIDEBAR_ORDER } from '../../../../components/NavConfig';
import { ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { usePersistentState } from '../../../../../hooks/usePersistentState';

interface PageManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PageManagerModal: React.FC<PageManagerModalProps> = ({ isOpen, onClose }) => {
    const [sidebarOrder, setSidebarOrder] = usePersistentState<string[]>('sidebar-order', []);
    
    const activeOrder = (sidebarOrder && sidebarOrder.length > 0) ? sidebarOrder : DEFAULT_SIDEBAR_ORDER;

    const toggleSidebarItem = (id: string) => {
        if (activeOrder.includes(id)) {
            // Disable: Remove from order list
            if (activeOrder.length <= 1) {
                alert("Mindestens eine Seite muss aktiv bleiben.");
                return;
            }
            setSidebarOrder(activeOrder.filter(item => item !== id));
        } else {
            // Enable: Add to end
            setSidebarOrder([...activeOrder, id]);
        }
    };

    const moveSidebarItem = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...activeOrder];
        if (direction === 'up' && index > 0) {
            [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
        } else if (direction === 'down' && index < newOrder.length - 1) {
            [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        }
        setSidebarOrder(newOrder);
    };

    if (!isOpen) return null;

    return (
        <GlassModal
            isOpen={isOpen}
            onClose={onClose}
            title="Seiten Verwaltung"
        >
            <div className="p-6 space-y-6">
                <div className="bg-muted border border-border rounded-xl p-4 mb-4">
                    <p className="text-sm text-muted-foreground">
                        Hier kannst du entscheiden, welche Seiten in der Sidebar (und mobil unten) angezeigt werden und in welcher Reihenfolge.
                    </p>
                </div>

                {/* ACTIVE PAGES LIST (REORDERABLE) */}
                <div>
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">Aktive Seiten ("Anzeige")</h3>
                    <div className="space-y-2">
                        {activeOrder.map((itemId, index) => {
                            const item = ALL_NAV_ITEMS.find(i => i.id === itemId);
                            if (!item) return null;

                            return (
                                <div key={itemId} className="flex items-center justify-between p-3 bg-muted border border-border rounded-xl group hover:bg-muted transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="text-muted-foreground">{item.icon}</div>
                                        <span className="font-medium text-white">{item.label}</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col gap-0.5 mr-2">
                                            <button
                                                disabled={index === 0}
                                                onClick={() => moveSidebarItem(index, 'up')}
                                                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-white disabled:opacity-20"
                                            >
                                                <ChevronUp size={14} />
                                            </button>
                                            <button
                                                disabled={index === activeOrder.length - 1}
                                                onClick={() => moveSidebarItem(index, 'down')}
                                                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-white disabled:opacity-20"
                                            >
                                                <ChevronDown size={14} />
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => toggleSidebarItem(itemId)}
                                            className="p-2 bg-primary/20 text-emerald-400 hover:bg-primary/30 rounded-lg transition-colors"
                                            title="Ausblenden"
                                        >
                                            <Eye size={18} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* INACTIVE PAGES LIST */}
                <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 mt-6">Verfügbare Seiten ("Ausgeblendet")</h3>
                    <div className="space-y-2">
                        {ALL_NAV_ITEMS.filter(i => !activeOrder.includes(i.id)).length === 0 && (
                            <div className="text-muted-foreground text-sm italic py-2">Alle Seiten sind aktiv.</div>
                        )}
                        {ALL_NAV_ITEMS.filter(i => !activeOrder.includes(i.id)).map(item => (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-muted border border-white/5 rounded-xl opacity-60 hover:opacity-100 transition-opacity">
                                <div className="flex items-center gap-3">
                                    <div className="text-muted-foreground grayscale">{item.icon}</div>
                                    <span className="font-medium text-muted-foreground">{item.label}</span>
                                </div>
                                <button
                                    onClick={() => toggleSidebarItem(item.id)}
                                    className="p-2 bg-muted text-muted-foreground hover:bg-muted hover:text-white rounded-lg transition-colors"
                                    title="Einblenden"
                                >
                                    <EyeOff size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </GlassModal>
    );
};
