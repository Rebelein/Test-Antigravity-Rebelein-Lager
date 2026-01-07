import React, { useState, useEffect } from 'react';
import { GlassCard, Button } from '../UIComponents';
import { Plus, Shirt, Check } from 'lucide-react';
import { WorkwearTemplate } from '../../types';
import { toast } from 'sonner';

interface CatalogItemProps {
    template: WorkwearTemplate;
    onAddToCart: (template: WorkwearTemplate, size: string) => void;
    defaultSize?: string;
}

export const CatalogItem: React.FC<CatalogItemProps> = ({ template, onAddToCart, defaultSize }) => {
    const [size, setSize] = useState(defaultSize || '');

    useEffect(() => {
        if (defaultSize) {
            // Normalize 2XL -> XXL if needed, or just set it
            let val = defaultSize;
            if (val === '2XL') val = 'XXL';
            setSize(val);
        }
    }, [defaultSize]);

    const getSizeOptions = (category: string) => {
        const cat = category?.toLowerCase() || '';
        if (cat.includes('handschuh')) return ['7', '8', '9', '10', '11'];
        if (cat.includes('schuh')) return ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'];
        if (cat.includes('hose')) return ['42', '44', '46', '48', '50', '52', '54', '56', '58', '60', '62', '90', '94', '98', '102', '106'];
        if (cat.includes('helm')) return ['Universal', 'S (52-54)', 'M (55-58)', 'L (59-61)'];
        return ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];
    }

    const options = getSizeOptions(template.category);

    const handleAdd = () => {
        if (!size) {
            toast.error("Bitte Größe wählen");
            return;
        }
        onAddToCart(template, size);
        setSize(defaultSize || '');
    };

    return (
        <GlassCard className="group relative overflow-hidden flex flex-col h-full hover:border-emerald-500/30 transition-all duration-300">
            <div className="aspect-square bg-black/20 rounded-lg mb-4 flex items-center justify-center overflow-hidden relative">
                {template.image_url ? (
                    <img src={template.image_url} alt={template.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                    <Shirt size={48} className="text-white/20" />
                )}
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-xs font-mono px-2 py-1 rounded text-emerald-400">
                    {template.price?.toFixed(2)} €
                </div>
                {template.has_logo && (
                    <div className="absolute top-2 left-2 bg-emerald-500/80 backdrop-blur-md text-[10px] font-bold px-2 py-1 rounded text-white uppercase tracking-wider">
                        Logo
                    </div>
                )}
            </div>
            <div className="flex-1">
                <div className="text-xs text-emerald-400 uppercase tracking-wider mb-1">{template.category}</div>
                <h3 className="font-bold text-white mb-1 line-clamp-1" title={template.name}>{template.name}</h3>
                <p className="text-white/50 text-xs mb-4">Art.Nr: {template.article_number}</p>
            </div>
            <div className="mt-auto pt-4 border-t border-white/5 flex gap-2">
                <select
                    className="bg-black/20 border border-white/10 rounded-lg h-10 text-sm px-2 text-white/80 focus:border-emerald-500/50 outline-none w-24 cursor-pointer hover:bg-white/5 transition-colors"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                >
                    <option value="" disabled>Größe</option>
                    {options.map(opt => (
                        <option key={opt} className="bg-zinc-900" value={opt}>{opt}</option>
                    ))}
                </select>
                <Button onClick={handleAdd} variant="secondary" className="flex-1 h-10 px-0 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20">
                    <Plus size={16} /> <span className="ml-1">Add</span>
                </Button>
            </div>
        </GlassCard>
    );
};
