import React from 'react';
import { Move, Lock, Unlock, Wrench, CheckCircle2, ShoppingCart, Key as KeyIcon, StickyNote } from 'lucide-react';
import { GlassCard } from '../../../../components/UIComponents';
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
    isLocked: boolean;
    onToggleLock: () => void;
}

export const EventsTile: React.FC<EventsTileProps> = ({
    recentEvents,
    isLocked,
    onToggleLock,
}) => {
    return (
        <GlassCard className="flex flex-col h-full p-0 overflow-hidden border-none bg-white/5" contentClassName="!p-0 flex flex-col h-full">
            <div className={`px-6 py-5 border-b border-white/10 bg-white/5 backdrop-blur-xl flex items-center gap-3 shrink-0`}>
                <button
                    className={`drag-handle p-1.5 rounded-lg hover:bg-white/10 transition-colors ${isLocked ? 'cursor-default text-white/5 opacity-30' : 'cursor-move text-white/10 hover:text-white/50'}`}
                    title="Verschieben"
                >
                    <Move size={18} />
                </button>
                <div className="flex-1 flex items-center gap-2">
                    <StickyNote size={20} className="text-blue-400" />
                    <h2 className="text-xl font-bold text-white">Letzte Aktivitäten</h2>
                </div>
                <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={onToggleLock}
                    className="p-2 text-white/40 hover:text-white transition-colors"
                >
                    {isLocked ? <Lock size={16} className="text-rose-500" /> : <Unlock size={16} />}
                </button>
            </div>

            <div className="p-0 overflow-y-auto flex-1 min-h-0 pb-12">
                {recentEvents.length === 0 ? (
                    <div className="p-8 text-center text-white/30 italic">
                        Noch keine Aktivitäten verzeichnet.
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {recentEvents.map((event) => (
                            <div key={`${event.type}-${event.id}`} className="p-4 flex items-start gap-4 hover:bg-white/5 transition-colors">
                                {/* Icon based on type */}
                                <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 
                                    ${event.type === 'machine' ? 'bg-amber-500/10 text-amber-400' : ''}
                                    ${event.type === 'commission' ? 'bg-emerald-500/10 text-emerald-400' : ''}
                                    ${event.type === 'order' ? 'bg-purple-500/10 text-purple-400' : ''}
                                    ${event.type === 'key' ? 'bg-blue-500/10 text-blue-400' : ''}
                                `}>
                                    {event.type === 'machine' && <Wrench size={14} />}
                                    {event.type === 'commission' && <CheckCircle2 size={14} />}
                                    {event.type === 'order' && <ShoppingCart size={14} />}
                                    {event.type === 'key' && <KeyIcon size={14} />}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <span className="text-sm font-bold text-white truncate">
                                            {event.user_name}
                                        </span>
                                        <span className="text-xs text-white/40 whitespace-nowrap ml-2">
                                            {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: de })}
                                        </span>
                                    </div>
                                    <p className="text-sm text-white/70 mt-0.5">
                                        <span className="font-medium text-white/50 uppercase text-[10px] tracking-wider mr-2 border border-white/10 px-1.5 py-0.5 rounded">
                                            {event.type === 'machine' ? 'Gerät' : event.type === 'commission' ? 'Kommission' : event.type === 'key' ? 'Schlüssel' : 'Bestellung'}
                                        </span>
                                        <span className="font-bold text-white mr-1">
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
        </GlassCard>
    );
};
