import React, { useState, useEffect } from 'react';
import { Button } from './UIComponents';
import { X, Check, FileText, StickyNote } from 'lucide-react';
import { Commission } from '../types';

interface CommissionOfficeContentProps {
    commission: Commission;
    onClose: () => void;
    onSave: (isProcessed: boolean, notes: string) => void;
    isSaving: boolean;
}

export const CommissionOfficeContent: React.FC<CommissionOfficeContentProps> = ({
    commission,
    onClose,
    onSave,
    isSaving
}) => {
    const [officeNotes, setOfficeNotes] = useState(commission.office_notes || '');
    const [isProcessed, setIsProcessed] = useState(commission.is_processed || false);

    useEffect(() => {
        setOfficeNotes(commission.office_notes || '');
        setIsProcessed(commission.is_processed || false);
    }, [commission]);

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] rounded-2xl border border-white/10 shadow-xl overflow-hidden relative">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-start bg-white/5">
                <div>
                    <h2 className="text-xl font-bold text-white">Kommission bearbeiten</h2>
                    <p className="text-sm text-white/50">{commission.name}</p>
                    {commission.status === 'ReturnReady' && <span className="text-xs text-purple-400 font-bold block mt-1">(Retoure Abholbereit)</span>}
                    {commission.status === 'ReturnPending' && <span className="text-xs text-orange-400 font-bold block mt-1">(Retoure Angemeldet)</span>}
                </div>
                <button onClick={onClose} className="p-2 bg-black/50 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                {/* Checkbox */}
                <div
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-4 ${isProcessed ? 'bg-emerald-500/20 border-emerald-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                    onClick={() => setIsProcessed(!isProcessed)}
                >
                    <div className={`w-6 h-6 rounded border flex items-center justify-center shrink-0 transition-colors ${isProcessed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/30'}`}>
                        {isProcessed && <Check size={16} />}
                    </div>
                    <div>
                        <div className="font-bold text-white">Büro: Gesehen / Bearbeitet</div>
                        <div className="text-xs text-white/50">Markiere den Vorgang als "in Bearbeitung" oder "Erledigt".</div>
                    </div>
                </div>

                {/* Notes */}
                <div>
                    <label className="text-xs text-white/50 font-bold uppercase mb-2 block flex items-center gap-2">
                        <StickyNote size={12} /> Büro Notizen
                    </label>
                    <textarea
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 min-h-[150px]"
                        placeholder="z.B. Termin vereinbart am 12.12. / Kunde ruft an..."
                        value={officeNotes}
                        onChange={e => setOfficeNotes(e.target.value)}
                    />
                    <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar pb-1">
                        {['Termin vereinbart', 'Kunde informiert', 'Abholung bestätigt', 'Großhändler beauftragt'].map(tag => (
                            <button
                                key={tag}
                                onClick={() => setOfficeNotes(prev => (prev ? prev + '\n' : '') + tag)}
                                className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/60 hover:bg-white/10 whitespace-nowrap"
                            >
                                + {tag}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-white/10 bg-white/5 flex gap-3 justify-end">
                <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
                <Button
                    onClick={() => onSave(isProcessed, officeNotes)}
                    disabled={isSaving}
                    className="bg-emerald-600 hover:bg-emerald-500"
                >
                    {isSaving ? 'Speichert...' : 'Speichern'}
                </Button>
            </div>
        </div>
    );
};
