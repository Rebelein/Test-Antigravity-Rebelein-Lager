import React from 'react';
import { User, Key as KeyIcon } from 'lucide-react';
import { DashboardTile } from '../DashboardTile';
import { Key } from '../../../../../types';

interface KeysTileProps {
    rentedKeys: Key[];
    onSelectKey: (key: Key) => void;
}

export const KeysTile: React.FC<KeysTileProps> = React.memo(({
    rentedKeys,
    onSelectKey,
}) => {
    return (
        <DashboardTile
            tileId="keys"
            title="Schlüssel"
            icon={<KeyIcon size={18} className="text-amber-500" />}
            badgeCount={rentedKeys.length}
            badgeClassName="bg-blue-500/10 dark:text-blue-400 text-blue-800 border-blue-500/30"
            navigateTo="/keys"
        >
            <div className="p-4 flex flex-col gap-3 overflow-hidden h-full">
                <div className="flex justify-between items-center mb-2 shrink-0">
                    <span className="text-sm font-bold text-foreground">In Verwendung ({rentedKeys.length})</span>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-4 custom-scrollbar">
                    {rentedKeys.length === 0 && <div className="text-xs text-muted-foreground italic">Alle Schlüssel im Kasten.</div>}
                    {rentedKeys.map(k => (
                        <div key={k.id} onClick={(e) => { e.stopPropagation(); onSelectKey(k); }} className="group cursor-pointer p-2 rounded-lg hover:bg-white/5 border border-transparent hover:border-border/60">
                            <div className="flex justify-between items-start">
                                <div className="font-medium text-foreground text-sm group-hover:dark:text-amber-400 text-amber-800 transition-colors truncate">{k.name}</div>
                                <span className="text-xs font-mono dark:text-emerald-400 text-emerald-800">#{k.slot_number}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                                <User size={12} className="text-amber-500/70" />
                                <span className="text-xs text-muted-foreground truncate">{k.holder_name || 'Unbekannt'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </DashboardTile>
    );
});

KeysTile.displayName = 'KeysTile';
