import React from 'react';
import { Key } from '../types';
import { MapPin, Hash } from 'lucide-react';

interface KeyExportTemplateProps {
    keys: Key[];
    categories: any[];
}

export const KeyExportTemplate = React.forwardRef<HTMLDivElement, KeyExportTemplateProps>(({ keys, categories }, ref) => {
    // Helper to get category for a key
    const getCategory = (catId?: string) => categories.find(c => c.id === catId);

    // Group keys keys by category for ordered display
    // We want to iterate defined categories first, then uncategorized
    const sortedCategories = [...categories];
    
    // Check if we have uncategorized keys
    const hasUncategorized = keys.some(k => !k.category_id);

    return (
        <div className="hidden print:block">
            <div ref={ref} className="text-black bg-white">
                <style type="text/css" media="print">
                    {`
                    @page { 
                        size: A4 landscape; 
                        margin: 10mm; 
                    }
                    body { 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                    }
                    .print-container {
                        width: 100%;
                        column-count: 2;
                        column-gap: 20mm;
                        column-rule: 1px dashed #ccc;
                        font-family: 'Inter', sans-serif;
                    }
                    .category-section {
                        break-inside: avoid;
                        margin-bottom: 2em;
                        page-break-inside: avoid; /* Firefox */
                    }
                    .key-row {
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                    `}
                </style>
                
                <div className="print-container">
                    <div className="mb-6 break-inside-avoid col-span-full">
                        <h1 className="text-2xl font-bold mb-2">Schlüsselverzeichnis</h1>
                        <p className="text-sm text-gray-500">
                            Stand: {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </p>
                    </div>

                    {sortedCategories.map(cat => {
                        const catKeys = keys.filter(k => k.category_id === cat.id);
                        if (catKeys.length === 0) return null;

                        return (
                            <div key={cat.id} className="category-section">
                                <div 
                                    className="flex items-center gap-2 border-b-2 border-gray-200 pb-2 mb-3"
                                    style={{ borderColor: cat.color }}
                                >
                                    <div 
                                        className="w-4 h-4 rounded-full" 
                                        style={{ backgroundColor: cat.color }}
                                    ></div>
                                    <h2 className="text-lg font-bold uppercase tracking-wider">{cat.name}</h2>
                                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-500 ml-auto">
                                        {catKeys.length}
                                    </span>
                                </div>

                                <div className="space-y-0">
                                    {catKeys.map((key) => (
                                        <div key={key.id} className="key-row flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                                            <div className="w-12 shrink-0 flex flex-col items-center justify-center bg-gray-50 rounded p-1">
                                                <span className="text-[10px] text-gray-400 uppercase">Platz</span>
                                                <span className="font-bold text-lg leading-none">{key.slot_number}</span>
                                            </div>
                                            <div className="flex-grow min-w-0">
                                                <div className="font-bold text-base truncate">{key.name}</div>
                                                {key.address && (
                                                    <div className="text-xs text-gray-500 flex items-center gap-1 truncate">
                                                        <MapPin size={10} /> {key.address}
                                                    </div>
                                                )}
                                                {key.owner && (
                                                    <div className="text-[10px] text-gray-400 mt-0.5">
                                                        Eigentümer: {key.owner}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="w-8 flex items-center justify-center">
                                                {/* Checkbox Placeholder for manual checking */}
                                                <div className="w-4 h-4 border border-gray-300 rounded"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {hasUncategorized && (() => {
                        const uncategorizedKeys = keys.filter(k => !k.category_id);
                        if (uncategorizedKeys.length === 0) return null;
                        
                        return (
                            <div key="uncategorized" className="category-section">
                                <div className="flex items-center gap-2 border-b-2 border-gray-300 pb-2 mb-3">
                                    <div className="w-4 h-4 rounded-full bg-gray-300"></div>
                                    <h2 className="text-lg font-bold uppercase tracking-wider text-gray-600">Ohne Kategorie</h2>
                                </div>
                                <div className="space-y-0">
                                    {uncategorizedKeys.map((key) => (
                                        <div key={key.id} className="key-row flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                                            <div className="w-12 shrink-0 flex flex-col items-center justify-center bg-gray-50 rounded p-1">
                                                <span className="text-[10px] text-gray-400 uppercase">Platz</span>
                                                <span className="font-bold text-lg leading-none">{key.slot_number}</span>
                                            </div>
                                            <div className="flex-grow min-w-0">
                                                <div className="font-bold text-base truncate">{key.name}</div>
                                                {key.address && (
                                                    <div className="text-xs text-gray-500 flex items-center gap-1 truncate">
                                                        <MapPin size={10} /> {key.address}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="w-8 flex items-center justify-center">
                                                <div className="w-4 h-4 border border-gray-300 rounded"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>
                
                {/* Print Footer */}
                <div className="hidden print:block fixed bottom-4 left-10 text-[10px] text-gray-400">
                    Rebelein LagerApp &bull; Schlüsselverzeichnis
                </div>
            </div>
        </div>
    );
});

KeyExportTemplate.displayName = 'KeyExportTemplate';
