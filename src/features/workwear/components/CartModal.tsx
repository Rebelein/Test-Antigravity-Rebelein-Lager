import React from 'react';
import { GlassModal, Button } from '../../../components/UIComponents';
import { Shirt, Trash2, Send, AlertTriangle } from 'lucide-react';
import { CartItem, WorkwearRole } from '../../../../types';

interface CartModalProps {
    isOpen: boolean;
    onClose: () => void;
    cart: CartItem[];
    cartTotal: number;
    availableBudget: number;
    role: WorkwearRole | null;
    ordering: boolean;
    onRemove: (id: string) => void;
    onCheckout: () => void;
}

export const CartModal: React.FC<CartModalProps> = ({
    isOpen,
    onClose,
    cart,
    cartTotal,
    availableBudget,
    role,
    ordering,
    onRemove,
    onCheckout
}) => {
    return (
        <GlassModal isOpen={isOpen} onClose={onClose} title="Warenkorb">
            <div className="p-6">
                {cart.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">Der Warenkorb ist leer.</div>
                ) : (
                    <div className="space-y-4">
                        {cart.map(item => (
                            <div key={item.id} className="flex items-center gap-4 bg-muted p-3 rounded-lg border border-white/5">
                                <div className="w-12 h-12 bg-black/30 rounded flex items-center justify-center shrink-0 overflow-hidden">
                                    {item.type === 'catalog' && item.template?.image_url ? (
                                        <img src={item.template.image_url} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <Shirt className="text-muted-foreground" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-white truncate">
                                        {item.type === 'catalog' ? item.template!.name : item.customData!.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        Größe: {item.size} | Menge: {item.quantity} |
                                        {item.type === 'catalog' && item.template!.has_logo ? ' Mit Logo' : ' Ohne Logo'}
                                    </div>
                                </div>
                                <div className="font-mono text-emerald-300">
                                    {((item.type === 'catalog' ? item.template!.price : item.customData!.price) * item.quantity).toFixed(2)} €
                                </div>
                                <button onClick={() => onRemove(item.id)} className="p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-rose-400">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}

                        <div className="border-t border-border pt-4 mt-4 flex justify-between items-center">
                            <div className="text-muted-foreground">Gesamtsumme</div>
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
                            <Button variant="ghost" onClick={onClose} className="flex-1">Zurück</Button>
                            <Button
                                onClick={onCheckout}
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
    );
};
