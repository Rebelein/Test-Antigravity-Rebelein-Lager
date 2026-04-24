import React from 'react';
import { Move, Lock, Unlock, ArrowRight, User, Key as KeyIcon } from 'lucide-react';
import { GlassCard } from '../../../../components/UIComponents';
import { Key } from '../../../../../types';
import { useNavigate } from 'react-router-dom';

interface KeysTileProps {
    rentedKeys: Key[];
    isLocked: boolean;
    onToggleLock: () => void;
    onSelectKey: (key: Key) => void;
}

export const KeysTile: React.FC<KeysTileProps> = ({
    rentedKeys,
    isLocked,
    onToggleLock,
    onSelectKey,
}) => {
    const navigate = useNavigate();

    return (
        <GlassCard className="flex flex-col h-full p-0 overflow-hidden border-none bg-muted" contentClassName="!p-0 flex flex-col h-full">
            <div className={`px-6 py-5 border-b border-border bg-muted backdrop-blur-sm flex justify-between items-center shrink-0`}>
                <div className="flex items-center gap-3">
                    <button
                        className={`drag-handle p-1.5 rounded-lg hover:bg-muted transition-colors ${isLocked ? 'cursor-default text-white/5 opacity-30' : 'cursor-move text-muted-foreground hover:text-muted-foreground'}`}
                        title="Verschieben"
                    >
                        <Move size={18} />
                    </button>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <KeyIcon size={20} className="text-amber-500" /> Ausgeliehen
                    </h2>
                </div>
                <div className="flex gap-2">
                    <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={onToggleLock}
                        className="p-2 text-muted-foreground hover:text-white transition-colors"
                    >
                        {isLocked ? <Lock size={16} className="text-rose-500" /> : <Unlock size={16} />}
                    </button>
                    <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={() => navigate('/keys')}
                        className="text-muted-foreground hover:text-white"
                    >
                        <ArrowRight size={20} />
                    </button>
                </div>
            </div>

            <div className="p-4 flex flex-col gap-3 overflow-hidden h-full">
                <div className="flex justify-between items-center mb-2 shrink-0">
                    <span className="text-sm font-bold text-white">Schlüssel in Verwendung ({rentedKeys.length})</span>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4">
                    {rentedKeys.length === 0 && <div className="text-xs text-muted-foreground italic">Alle Schlüssel im Kasten.</div>}
                    {rentedKeys.map(k => (
                        <div key={k.id} onClick={(e) => { e.stopPropagation(); onSelectKey(k); }} className="group cursor-pointer p-2 rounded hover:bg-muted border border-transparent hover:border-white/5">
                            <div className="flex justify-between items-start">
                                <div className="font-medium text-white text-sm group-hover:text-amber-400 transition-colors truncate">{k.name}</div>
                                <span className="text-xs font-mono text-emerald-400">#{k.slot_number}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                                <User size={12} className="text-amber-500/70" />
                                <span className="text-xs text-muted-foreground truncate">{k.holder_name || 'Unbekannt'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </GlassCard>
    );
};
