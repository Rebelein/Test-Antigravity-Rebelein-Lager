import React, { useState } from 'react';
import { Database, X, Settings, AlertTriangle, Check, Copy } from 'lucide-react';
import { Button } from '../../../../components/UIComponents';
import { initializeDatabase, MANUAL_SETUP_SQL } from '../../../../../utils/dbInit';

interface SqlSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const SqlSetupModal: React.FC<SqlSetupModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [isInitializing, setIsInitializing] = useState(false);
    const [isUpdatingSchema, setIsUpdatingSchema] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);
    const [sqlCopied, setSqlCopied] = useState(false);

    if (!isOpen) return null;

    const handleRunAutoInit = async () => {
        setIsInitializing(true);
        setInitError(null);
        try {
            await initializeDatabase(false);
            alert("Datenbank erfolgreich initialisiert!");
            window.location.reload();
        } catch (error: any) {
            setInitError(error.message || String(error));
        } finally {
            setIsInitializing(false);
        }
    };

    const handleUpdateSchema = async () => {
        setIsUpdatingSchema(true);
        setInitError(null);
        try {
            await initializeDatabase(false);
            alert("Schema erfolgreich aktualisiert!");
            onSuccess();
        } catch (error: any) {
            setInitError(error.message || String(error));
        } finally {
            setIsUpdatingSchema(false);
        }
    };

    const copySqlToClipboard = () => {
        navigator.clipboard.writeText(MANUAL_SETUP_SQL);
        setSqlCopied(true);
        setTimeout(() => setSqlCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-3xl bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div className="flex items-center gap-3">
                        <Database className="text-emerald-400" size={24} />
                        <div>
                            <h2 className="text-xl font-bold text-white">Datenbank Einrichtung</h2>
                            <p className="text-xs text-white/50">Reparatur & SQL Befehle</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-3">
                        <h3 className="text-lg font-semibold text-emerald-300 flex items-center gap-2">
                            <Settings size={18} /> Automatische Einrichtung
                        </h3>
                        <div className="flex gap-3">
                            <Button
                                onClick={handleRunAutoInit}
                                disabled={isInitializing}
                                className="flex-1 sm:flex-none"
                            >
                                {isInitializing ? 'Lade...' : 'Setup Starten'}
                            </Button>

                            <Button
                                onClick={handleUpdateSchema}
                                disabled={isUpdatingSchema}
                                variant="secondary"
                                className="flex-1 sm:flex-none"
                            >
                                Schema Updates
                            </Button>
                        </div>
                        {initError && (
                            <div className="mt-3 p-3 bg-red-500/20 border border-red-500/30 text-red-200 text-sm rounded-lg flex items-start gap-2">
                                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                                <span className="break-words max-w-full">{initError}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4 text-white/30 text-xs uppercase">
                        <div className="h-px bg-white/10 flex-1" />
                        ODER
                        <div className="h-px bg-white/10 flex-1" />
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-white mb-2">Manuelles SQL</h3>
                        <div className="relative group">
                            <pre className="bg-black/50 p-4 rounded-xl text-xs font-mono text-emerald-300/80 overflow-x-auto border border-white/10 whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                                {MANUAL_SETUP_SQL}
                            </pre>
                            <div className="absolute top-2 right-2">
                                <Button
                                    onClick={copySqlToClipboard}
                                    className="py-1 px-3 text-xs bg-white/10 hover:bg-white/20 border-none"
                                    icon={sqlCopied ? <Check size={14} /> : <Copy size={14} />}
                                >
                                    {sqlCopied ? 'Kopiert!' : 'Kopieren'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
