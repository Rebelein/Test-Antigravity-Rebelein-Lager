import React from 'react';
import { Wrench, CheckCircle2, ShoppingCart, Key as KeyIcon, StickyNote } from 'lucide-react';
import { DashboardTile } from '../DashboardTile';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface AppEvent {
    id: string;
    type: 'machine' | 'commission' | 'order' | 'key';
    user_name: string;
    action: string;
    details: string;
    created_at: string;
    entity_name: string;
}

interface EventsTileProps {
    recentEvents: AppEvent[];
}

export const EventsTile: React.FC<EventsTileProps> = React.memo(({
    recentEvents,
}) => {
    return (
        <DashboardTile
            tileId="events"
            title="Letzte Aktivitäten"
            icon={<StickyNote size={18} className="dark:text-blue-400 text-blue-800" />}
        >
            <div className="p-0 overflow-y-auto flex-1 min-h-0 pb-4 custom-scrollbar">
                {recentEvents.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground italic">
                        Noch keine Aktivitäten verzeichnet.
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {recentEvents.map((event) => (
                            <div key={`${event.type}-${event.id}`} className="p-4 flex items-start gap-4 hover:bg-white/5 transition-colors">
                                {/* Icon based on type */}
                                <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 
                                    ${event.type === 'machine' ? 'bg-amber-500/10 dark:text-amber-400 text-amber-800' : ''}
                                    ${event.type === 'commission' ? 'bg-primary/10 dark:text-emerald-400 text-emerald-800' : ''}
                                    ${event.type === 'order' ? 'bg-purple-500/10 text-purple-400' : ''}
                                    ${event.type === 'key' ? 'bg-blue-500/10 dark:text-blue-400 text-blue-800' : ''}
                                `}>
                                    {event.type === 'machine' && <Wrench size={14} />}
                                    {event.type === 'commission' && <CheckCircle2 size={14} />}
                                    {event.type === 'order' && <ShoppingCart size={14} />}
                                    {event.type === 'key' && <KeyIcon size={14} />}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <span className="text-sm font-bold text-foreground truncate">
                                            {event.user_name}
                                        </span>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                            {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: de })}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        <span className="font-medium text-muted-foreground uppercase text-[10px] tracking-wider mr-2 border border-border px-1.5 py-0.5 rounded">
                                            {event.type === 'machine' ? 'Gerät' : event.type === 'commission' ? 'Kommission' : event.type === 'key' ? 'Schlüssel' : 'Bestellung'}
                                        </span>
                                        <span className="font-bold text-foreground mr-1">
                                            {event.entity_name}:
                                        </span>
                                        {event.details}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardTile>
    );
});

EventsTile.displayName = 'EventsTile';
