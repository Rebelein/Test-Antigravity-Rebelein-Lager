import React from 'react';
import { GlassModal, Button, StatusBadge } from '../../../components/UIComponents';
import { AlertTriangle, Layers, X } from 'lucide-react';
import { Commission } from '../../../../types';

interface DuplicateCommissionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onIntegrate: () => void;
    existingCommission: Commission;
    isSubmitting?: boolean;
}

export const DuplicateCommissionModal: React.FC<DuplicateCommissionModalProps> = ({
    isOpen,
    onClose,
    onIntegrate,
    existingCommission,
    isSubmitting = false
}) => {
    return (
        <GlassModal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Duplikat gefunden"
            className="max-w-md"
        >
            <div className="p-6 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-4 border border-amber-500/20">
                    <AlertTriangle size={32} className="text-amber-500" />
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2">Auftragsnummer bereits vergeben</h3>
                <p className="text-muted-foreground mb-6 text-sm">
                    Es existiert bereits eine aktive Kommission mit der Auftragsnummer <span className="text-white font-mono font-bold px-1.5 py-0.5 bg-muted rounded">{existingCommission.order_number}</span>.
                </p>

                <div className="w-full bg-muted border border-border rounded-2xl p-4 mb-8 text-left">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Vorhandene Kommission</span>
                        <StatusBadge status={existingCommission.status} size="sm" />
                    </div>
                    <div className="text-lg font-bold text-white truncate mb-1">{existingCommission.name}</div>
                    <div className="text-xs text-muted-foreground">Erstellt am {new Date(existingCommission.created_at).toLocaleDateString('de-DE')}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full">
                    <Button 
                        variant="secondary" 
                        onClick={onClose} 
                        className="w-full"
                        disabled={isSubmitting}
                    >
                        <X size={18} className="mr-2" />
                        Abbrechen
                    </Button>
                    <Button 
                        onClick={onIntegrate} 
                        className="w-full bg-primary hover:bg-primary shadow-lg shadow-emerald-500/20"
                        isLoading={isSubmitting}
                        icon={<Layers size={18} />}
                    >
                        Integrieren
                    </Button>
                </div>
                
                <p className="mt-4 text-[10px] text-muted-foreground italic">
                    Beim Integrieren werden die aktuell erfassten Artikel zur bestehenden Kommission hinzugefügt.
                </p>
            </div>
        </GlassModal>
    );
};
