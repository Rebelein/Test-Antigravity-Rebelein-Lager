import React from 'react';
import { Move, Lock, Unlock, ArrowRight, User, Wrench } from 'lucide-react';
import { GlassCard } from '../../../../components/UIComponents';
import { Machine } from '../../../../../types';
import { useNavigate } from 'react-router-dom';

interface MachinesTileProps {
    rentedMachines: Machine[];
    repairMachines: Machine[];
    isLocked: boolean;
    onToggleLock: () => void;
    onSelectMachine: (machine: Machine) => void;
}

export const MachinesTile: React.FC<MachinesTileProps> = ({
    rentedMachines,
    repairMachines,
    isLocked,
    onToggleLock,
    onSelectMachine,
}) => {
    const navigate = useNavigate();

    return (
        <GlassCard className="flex flex-col h-full p-0 overflow-hidden border-none bg-white/5" contentClassName="!p-0 flex flex-col h-full">
            <div className={`px-6 py-5 border-b border-white/10 bg-white/5 backdrop-blur-xl flex justify-between items-center shrink-0`}>
                <div className="flex items-center gap-3">
                    <button
                        className={`drag-handle p-1.5 rounded-lg hover:bg-white/10 transition-colors ${isLocked ? 'cursor-default text-white/5 opacity-30' : 'cursor-move text-white/10 hover:text-white/50'}`}
                        title="Verschieben"
                    >
                        <Move size={18} />
                    </button>
                    <h2 className="text-xl font-bold text-white">Maschinenstatus</h2>
                </div>
                <div className="flex gap-2">
                    <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={onToggleLock}
                        className="p-2 text-white/40 hover:text-white transition-colors"
                    >
                        {isLocked ? <Lock size={16} className="text-rose-500" /> : <Unlock size={16} />}
                    </button>
                    <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={() => navigate('/machines')}
                        className="text-white/40 hover:text-white"
                    >
                        <ArrowRight size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-2 divide-x divide-white/10 overflow-hidden">
                {/* Left: Verliehen (Rented) */}
                <div className="p-4 flex flex-col gap-3 overflow-hidden h-full">
                    <div className="flex justify-between items-center mb-2 shrink-0">
                        <span className="text-sm font-bold text-white">Verliehen ({rentedMachines.length})</span>
                    </div>

                    <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4">
                        {rentedMachines.length === 0 && <div className="text-xs text-white/30 italic">Keine Maschinen verliehen.</div>}
                        {rentedMachines.map(m => (
                            <div key={m.id} onClick={(e) => { e.stopPropagation(); onSelectMachine(m); }} className="group cursor-pointer">
                                <div className="font-medium text-white text-sm group-hover:text-emerald-300 transition-colors truncate">{m.name}</div>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <User size={12} className="text-amber-400" />
                                    <span className="text-xs text-white/50 truncate">{m.profiles?.full_name || m.externalBorrower || 'Unbekannt'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Reparatur (Repair) */}
                <div className="p-4 flex flex-col gap-3 overflow-hidden h-full">
                    <div className="flex justify-between items-center mb-2 shrink-0">
                        <span className="text-sm font-bold text-rose-400">Reparatur ({repairMachines.length})</span>
                    </div>

                    <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4">
                        {repairMachines.length === 0 && <div className="text-xs text-white/30 italic">Keine Defekte.</div>}
                        {repairMachines.map(m => (
                            <div key={m.id} onClick={(e) => { e.stopPropagation(); onSelectMachine(m); }} className="group cursor-pointer">
                                <div className="font-medium text-white text-sm group-hover:text-rose-300 transition-colors truncate">{m.name}</div>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <Wrench size={12} className="text-rose-500" />
                                    <span className="text-xs text-white/50 truncate italic">{m.notes || 'Keine Notiz'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </GlassCard>
    );
};
