import React from 'react';
import { User, Wrench, Drill } from 'lucide-react';
import { DashboardTile } from '../DashboardTile';
import { Machine } from '../../../../../types';

interface MachinesTileProps {
    rentedMachines: Machine[];
    repairMachines: Machine[];
    onSelectMachine: (machine: Machine) => void;
}

export const MachinesTile: React.FC<MachinesTileProps> = React.memo(({
    rentedMachines,
    repairMachines,
    onSelectMachine,
}) => {
    return (
        <DashboardTile
            tileId="machines"
            title="Maschinen"
            icon={<Drill size={18} className="dark:text-amber-400 text-amber-800" />}
            badgeCount={rentedMachines.length + repairMachines.length}
            badgeClassName="bg-amber-500/10 dark:text-amber-400 text-amber-800 border-amber-500/30"
            navigateTo="/machines"
        >
            <div className="flex-1 grid grid-cols-2 divide-x divide-white/10 overflow-hidden min-h-0">
                {/* Left: Verliehen (Rented) */}
                <div className="p-4 flex flex-col gap-3 overflow-hidden h-full">
                    <div className="flex justify-between items-center mb-2 shrink-0">
                        <span className="text-sm font-bold text-foreground">Verliehen ({rentedMachines.length})</span>
                    </div>

                    <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4 custom-scrollbar">
                        {rentedMachines.length === 0 && <div className="text-xs text-muted-foreground italic">Keine Maschinen verliehen.</div>}
                        {rentedMachines.map(m => (
                            <div key={m.id} onClick={(e) => { e.stopPropagation(); onSelectMachine(m); }} className="group cursor-pointer">
                                <div className="font-medium text-foreground text-sm group-hover:dark:text-emerald-300 text-emerald-800 transition-colors truncate">{m.name}</div>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <User size={12} className="dark:text-amber-400 text-amber-800" />
                                    <span className="text-xs text-muted-foreground truncate">{m.profiles?.full_name || m.externalBorrower || 'Unbekannt'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Reparatur (Repair) */}
                <div className="p-4 flex flex-col gap-3 overflow-hidden h-full">
                    <div className="flex justify-between items-center mb-2 shrink-0">
                        <span className="text-sm font-bold dark:text-rose-400 text-rose-800">Reparatur ({repairMachines.length})</span>
                    </div>

                    <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4 custom-scrollbar">
                        {repairMachines.length === 0 && <div className="text-xs text-muted-foreground italic">Keine Defekte.</div>}
                        {repairMachines.map(m => (
                            <div key={m.id} onClick={(e) => { e.stopPropagation(); onSelectMachine(m); }} className="group cursor-pointer">
                                <div className="font-medium text-foreground text-sm group-hover:dark:text-rose-300 text-rose-800 transition-colors truncate">{m.name}</div>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <Wrench size={12} className="text-rose-500" />
                                    <span className="text-xs text-muted-foreground truncate italic">{m.notes || 'Keine Notiz'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DashboardTile>
    );
});

MachinesTile.displayName = 'MachinesTile';
