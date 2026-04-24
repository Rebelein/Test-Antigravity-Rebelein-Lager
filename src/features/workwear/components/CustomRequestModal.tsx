import React, { useState, useEffect } from 'react';
import { GlassModal, GlassInput, GlassSelect, Button } from '../../../components/UIComponents';

interface CustomRequestState {
    name: string;
    articleNumber: string;
    category: string;
    size: string;
    price: string;
    url: string;
    notes: string;
}

interface CustomRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    userSizes: Record<string, string>;
    onAddToCart: (request: CustomRequestState) => void;
}

export const CustomRequestModal: React.FC<CustomRequestModalProps> = ({
    isOpen,
    onClose,
    userSizes,
    onAddToCart
}) => {
    const defaultState: CustomRequestState = {
        name: '',
        articleNumber: '',
        category: '',
        size: '',
        price: '',
        url: '',
        notes: ''
    };

    const [customRequest, setCustomRequest] = useState<CustomRequestState>(defaultState);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setCustomRequest(defaultState);
        }
    }, [isOpen]);

    const handleSubmit = () => {
        onAddToCart(customRequest);
    };

    return (
        <GlassModal isOpen={isOpen} onClose={onClose} title="Wunschartikel Anfrage">
            <div className="p-6 space-y-4">
                <div className="bg-muted p-4 rounded-lg border border-border text-sm text-muted-foreground mb-4">
                    Hier kannst du Artikel anfragen, die nicht im Katalog sind. Bitte fülle so viele Informationen wie möglich aus.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Kategorie (für Größenzuordnung)</label>
                        <GlassSelect
                            value={customRequest.category}
                            onChange={(e) => {
                                const cat = e.target.value;
                                setCustomRequest(prev => ({
                                    ...prev,
                                    category: cat,
                                    size: userSizes[cat] || prev.size // Auto-fill size
                                }));
                            }}
                        >
                            <option value="">Bitte wählen...</option>
                            <option value="T-Shirt">T-Shirt</option>
                            <option value="Pullover">Pullover</option>
                            <option value="Jacke">Jacke</option>
                            <option value="Hose">Hose</option>
                            <option value="Schuhe">Schuhe</option>
                            <option value="PSA">PSA</option>
                            <option value="Sonstiges">Sonstiges</option>
                        </GlassSelect>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Größe</label>
                        <GlassInput
                            value={customRequest.size}
                            onChange={(e) => setCustomRequest(prev => ({ ...prev, size: e.target.value }))}
                            placeholder="z.B. XL oder 42"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Artikelname / Beschreibung *</label>
                    <GlassInput
                        value={customRequest.name}
                        onChange={(e) => setCustomRequest(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Genauer Name des Artikels"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Artikelnummer (Optional)</label>
                        <GlassInput
                            value={customRequest.articleNumber}
                            onChange={(e) => setCustomRequest(prev => ({ ...prev, articleNumber: e.target.value }))}
                            placeholder="z.B. 123456"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Preis (€) ca. *</label>
                        <GlassInput
                            type="number"
                            step="0.01"
                            value={customRequest.price}
                            onChange={(e) => setCustomRequest(prev => ({ ...prev, price: e.target.value }))}
                            placeholder="0.00"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Link zum Artikel (Optional)</label>
                    <GlassInput
                        value={customRequest.url}
                        onChange={(e) => setCustomRequest(prev => ({ ...prev, url: e.target.value }))}
                        placeholder="https://..."
                    />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
                    <Button onClick={handleSubmit}>Zum Warenkorb</Button>
                </div>
            </div>
        </GlassModal>
    );
};
