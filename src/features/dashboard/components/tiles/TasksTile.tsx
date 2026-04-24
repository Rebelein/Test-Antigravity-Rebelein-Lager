import React, { useState, useEffect, useCallback } from 'react';
import {
    Move, Lock, Unlock, ArrowRight, Maximize2, Minimize2,
    MessageSquare, CheckCircle2, Circle, Clock, User,
    ChevronUp, ChevronDown, Hash, Send
} from 'lucide-react';
import { GlassCard } from '../../../../components/UIComponents';
import { supabase } from '../../../../../supabaseClient';
import { usePersistentState } from '../../../../../hooks/usePersistentState';

interface Channel {
    id: string;
    name: string;
    category?: string;
    messages: any[];
    allMessages: any[];
}

interface TasksTileProps {
    tasks: any[];
    channels: Channel[];
    userId: string | undefined;
    userDisplayName: string | undefined;
    isLocked: boolean;
    isFullscreen: boolean;
    onToggleLock: () => void;
    onToggleFullscreen: () => void;
    onSelectTask: (task: any) => void;
    onOpenApp: () => void;
    onTasksRefresh: () => void;
    onChannelsRefresh: () => void;
}

export const TasksTile: React.FC<TasksTileProps> = ({
    tasks,
    channels,
    userId,
    userDisplayName,
    isLocked,
    isFullscreen,
    onToggleLock,
    onToggleFullscreen,
    onSelectTask,
    onOpenApp,
    onTasksRefresh,
    onChannelsRefresh,
}) => {
    const [tasksTileTab, setTasksTileTab] = useState<'tasks' | 'chat'>('tasks');
    const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
    const [chatInputMessage, setChatInputMessage] = useState('');
    const [collapsedTaskIds, setCollapsedTaskIds] = usePersistentState<string[]>('dashboard_collapsed_tasks', []);
    const [tasksTileSplit, setTasksTileSplit] = usePersistentState<number>('tasks_tile_split', 40);
    const [isResizingTasks, setIsResizingTasks] = useState(false);
    const [channelReadTimestamps, setChannelReadTimestamps] = usePersistentState<Record<string, string>>('channel_read_timestamps', {});

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInputMessage.trim() || !activeChannelId || !userId) return;
        try {
            await supabase.from('messages').insert([{
                channel_id: activeChannelId,
                user_id: userId,
                user_email: userDisplayName,
                content: chatInputMessage.trim()
            }]);
            setChatInputMessage('');
            onChannelsRefresh();
        } catch (err) { console.error(err); }
    };

    const toggleSubtask = async (subtaskId: string, currentCompleted: boolean) => {
        try {
            await supabase.from('subtasks').update({ completed: !currentCompleted }).eq('id', subtaskId);
            onTasksRefresh();
        } catch (err) { console.error(err); }
    };

    const updateTaskStatus = async (taskId: string, status: string) => {
        try {
            await supabase.from('tasks').update({ status }).eq('id', taskId);
            onTasksRefresh();
        } catch (err) { console.error(err); }
    };

    const toggleTaskCollapse = (taskId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCollapsedTaskIds(prev =>
            prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
        );
    };

    const handleSplitResize = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isResizingTasks) return;
        const container = document.getElementById('tasks-tile-container');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const newWidthPerc = ((clientX - rect.left) / rect.width) * 100;
        setTasksTileSplit(Math.min(Math.max(newWidthPerc, 20), 80));
    }, [isResizingTasks, setTasksTileSplit]);

    const stopResizing = useCallback(() => setIsResizingTasks(false), []);

    useEffect(() => {
        if (isResizingTasks) {
            window.addEventListener('mousemove', handleSplitResize);
            window.addEventListener('mouseup', stopResizing);
            window.addEventListener('touchmove', handleSplitResize, { passive: false });
            window.addEventListener('touchend', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', handleSplitResize);
            window.removeEventListener('mouseup', stopResizing);
            window.removeEventListener('touchmove', handleSplitResize);
            window.removeEventListener('touchend', stopResizing);
        };
    }, [isResizingTasks, handleSplitResize, stopResizing]);

    const hasUnreadMessages = channels.some(c =>
        (c.allMessages?.[0]?.created_at || '0') > (channelReadTimestamps[c.id] || '0')
    );

    const content = (
        <div className="flex flex-col h-full bg-muted relative" id="tasks-tile-container">
            {/* Header */}
            <div className={`px-6 py-5 border-b border-border bg-muted backdrop-blur-sm flex justify-between items-center shrink-0`}>
                <div className="flex items-center gap-3">
                    <button
                        className={`drag-handle p-1.5 rounded-lg hover:bg-muted transition-colors ${isLocked ? 'cursor-default text-white/5 opacity-30' : 'cursor-move text-muted-foreground hover:text-muted-foreground'}`}
                        title="Verschieben"
                    >
                        <Move size={18} />
                    </button>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <MessageSquare size={20} className="text-teal-400" /> Aufgaben & Chat
                    </h2>
                </div>
                <div className="flex gap-2">
                    <button onClick={onToggleLock} className="p-2 text-muted-foreground hover:text-white transition-colors">
                        {isLocked ? <Lock size={16} className="text-rose-500" /> : <Unlock size={16} />}
                    </button>
                    <button onClick={onToggleFullscreen} className="p-2 text-muted-foreground hover:text-white transition-colors h-10 w-10 flex items-center justify-center bg-muted rounded-lg border border-border">
                        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                    <button onClick={onOpenApp} className="text-muted-foreground hover:text-white h-10 px-3 bg-muted rounded-lg border border-border flex items-center justify-center gap-2" title="App öffnen">
                        <ArrowRight size={18} />
                    </button>
                </div>
            </div>

            {/* Tab bar (only in non-fullscreen) */}
            {!isFullscreen && (
                <div className="flex border-b border-border shrink-0 bg-muted">
                    <button onClick={() => setTasksTileTab('tasks')} className={`flex-1 py-3 text-xs font-bold uppercase transition-colors relative ${tasksTileTab === 'tasks' ? 'text-white' : 'text-muted-foreground'}`}>
                        Aufgaben
                        {tasksTileTab === 'tasks' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />}
                    </button>
                    <button onClick={() => setTasksTileTab('chat')} className={`flex-1 py-3 text-xs font-bold uppercase transition-colors relative ${tasksTileTab === 'chat' ? 'text-white' : 'text-muted-foreground'}`}>
                        <div className="flex items-center justify-center gap-2">
                            Chat {channels.length > 0 && `(${channels.length})`}
                            {hasUnreadMessages && (
                                <span className="flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-primary opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                                </span>
                            )}
                        </div>
                        {tasksTileTab === 'chat' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />}
                    </button>
                </div>
            )}

            <div className={`flex-1 flex flex-col md:flex-row relative overflow-hidden`}>
                {/* TASKS PANEL */}
                <div
                    style={{ width: isFullscreen ? `${tasksTileSplit}%` : (tasksTileTab === 'tasks' ? '100%' : '0%'), display: (isFullscreen || tasksTileTab === 'tasks') ? 'flex' : 'none' }}
                    className={`p-4 flex-col gap-3 overflow-hidden h-full border-r border-border`}
                >
                    <div className="flex justify-between items-center mb-2 shrink-0">
                        <span className="text-sm font-bold text-teal-400">Aufgaben ({tasks.length})</span>
                    </div>
                    <div className="space-y-2 overflow-y-auto pr-1 pb-4 flex-1 custom-scrollbar">
                        {tasks.length === 0 && <div className="text-xs text-muted-foreground italic">Keine Aufgaben.</div>}
                        {tasks.map(task => {
                            let details = { text: '' };
                            try { details = JSON.parse(task.description || '{}'); } catch (e) { details = { text: task.description || '' }; }

                            const subtasks = task.subtasks || [];
                            const completedCount = subtasks.filter((s: any) => s.completed).length;
                            const totalCount = subtasks.length;
                            const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
                            const isCollapsed = collapsedTaskIds.includes(task.id);

                            return (
                                <div key={task.id}
                                    onClick={(e) => { e.stopPropagation(); onSelectTask(task); }}
                                    className={`cursor-pointer group flex flex-col p-3 rounded-2xl border transition-all flex-shrink-0 ${
                                        task.status === 'done' ? 'bg-primary/10 border-emerald-500/20' :
                                        task.status === 'in_progress' ? 'bg-teal-500/10 border-teal-500/20' : 'bg-muted border-border hover:bg-muted'
                                    }`}>

                                    <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className="rounded-full">
                                                {task.status === 'todo' && <Circle size={16} className="text-muted-foreground" />}
                                                {task.status === 'in_progress' && <Clock size={16} className="text-teal-400" />}
                                                {task.status === 'done' && <CheckCircle2 size={16} className="text-emerald-400" />}
                                            </div>
                                            <h3 className={`font-semibold text-white text-sm truncate max-w-[150px] ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                                                {task.title}
                                            </h3>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground border border-white/5">
                                                {task.status === 'todo' ? 'Offen' : task.status === 'in_progress' ? 'In Arbeit' : 'Erledigt'}
                                            </span>
                                            <button
                                                onClick={(e) => toggleTaskCollapse(task.id, e)}
                                                className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-white transition-colors"
                                            >
                                                {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                            </button>
                                        </div>
                                    </div>

                                    {!isCollapsed && (
                                        <div className="mt-2 animate-in slide-in-from-top-2 duration-200">
                                            {details.text && (
                                                <p className="mb-3 text-[11px] text-muted-foreground line-clamp-2">{details.text}</p>
                                            )}
                                            {totalCount > 0 && (
                                                <div className="mb-2">
                                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                                                        <span>Progress</span>
                                                        <span>{completedCount}/{totalCount}</span>
                                                    </div>
                                                    <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                                        <div className="h-full bg-teal-500/60 rounded-full transition-all" style={{ width: `${progress}%` }} />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between text-[9px] text-muted-foreground pt-2 border-t border-white/5">
                                                <span>{task.user_email?.split('@')[0]}</span>
                                                <span>{new Date(task.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* RESIZER (fullscreen only) */}
                {isFullscreen && (
                    <div
                        onMouseDown={() => setIsResizingTasks(true)}
                        onTouchStart={() => setIsResizingTasks(true)}
                        className={`w-1.5 cursor-col-resize hover:bg-teal-500/50 transition-colors flex items-center justify-center group z-10 ${isResizingTasks ? 'bg-teal-500/50' : 'bg-transparent'}`}
                    >
                        <div className="h-8 w-0.5 bg-muted rounded-full group-hover:bg-teal-500/50" />
                    </div>
                )}

                {/* CHAT PANEL */}
                <div
                    style={{ width: isFullscreen ? `${100 - tasksTileSplit}%` : (tasksTileTab === 'chat' ? '100%' : '0%'), display: (isFullscreen || tasksTileTab === 'chat') ? 'flex' : 'none' }}
                    className={`flex-col h-full overflow-hidden`}
                >
                    {!activeChannelId ? (
                        <div className="p-4 flex-col gap-3 h-full overflow-hidden flex">
                            <div className="flex justify-between items-center mb-2 shrink-0">
                                <span className="text-sm font-bold text-white">Kanäle</span>
                            </div>
                            <div className="space-y-4 overflow-y-auto pr-1 pb-4 flex-1 custom-scrollbar">
                                {channels.length === 0 && <div className="text-xs text-muted-foreground italic">Keine Kanäle.</div>}
                                {(() => {
                                    const grouped = channels.reduce((acc: any, c) => {
                                        const cat = (c as any).category || 'Allgemein';
                                        if (!acc[cat]) acc[cat] = [];
                                        acc[cat].push(c);
                                        return acc;
                                    }, {});

                                    return Object.entries(grouped).map(([category, items]: [string, any]) => (
                                        <div key={category} className="space-y-2">
                                            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">{category}</h4>
                                            <div className="space-y-2">
                                                {items.sort((a: any, b: any) => {
                                                    const latestA = a.allMessages?.[0]?.created_at || '0';
                                                    const latestB = b.allMessages?.[0]?.created_at || '0';
                                                    const unreadA = latestA > (channelReadTimestamps[a.id] || '0') ? 1 : 0;
                                                    const unreadB = latestB > (channelReadTimestamps[b.id] || '0') ? 1 : 0;
                                                    if (unreadA !== unreadB) return unreadB - unreadA;
                                                    return latestB.localeCompare(latestA);
                                                }).map((c: any) => {
                                                    const isUnread = (c.allMessages?.[0]?.created_at || '0') > (channelReadTimestamps[c.id] || '0');
                                                    return (
                                                        <div key={c.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveChannelId(c.id);
                                                                if (c.allMessages?.[0]) {
                                                                    setChannelReadTimestamps(prev => ({ ...prev, [c.id]: c.allMessages[0].created_at }));
                                                                }
                                                            }}
                                                            className={`cursor-pointer p-2.5 bg-muted rounded-xl border transition-all ${
                                                                isUnread ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'border-white/5 hover:border-teal-500/50'
                                                            }`}
                                                        >
                                                            <div className="font-bold text-white text-[13px] flex justify-between items-center gap-2">
                                                                <div className="flex items-center gap-2 truncate">
                                                                    <Hash size={12} className={isUnread ? 'text-emerald-400' : 'text-teal-400'} />
                                                                    <span className="truncate">{c.name}</span>
                                                                </div>
                                                                {isUnread && <span className="flex w-2 h-2 bg-primary rounded-full shrink-0"></span>}
                                                            </div>
                                                            {c.messages.length > 0 && (
                                                                <div className="mt-1.5 text-[10px] text-muted-foreground truncate">
                                                                    <span className={`${isUnread ? 'text-emerald-300' : 'text-teal-300'} mr-1`}>{c.messages[0].user_email?.split('@')[0]}:</span>
                                                                    {c.messages[0].content}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full bg-black/20">
                            <div className="p-3 border-b border-border flex items-center gap-2 bg-muted shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); setActiveChannelId(null); }} className="p-1.5 hover:bg-teal-500/20 rounded-lg text-muted-foreground hover:text-teal-300 transition-colors">
                                    <ArrowRight size={16} className="rotate-180" />
                                </button>
                                <div className="font-bold text-white text-sm flex items-center gap-1">
                                    <Hash size={14} className="text-teal-400" />
                                    {channels.find(c => c.id === activeChannelId)?.name}
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 flex flex-col-reverse gap-3 custom-scrollbar">
                                {channels.find(c => c.id === activeChannelId)?.allMessages.map((m: any, idx: number, arr: any[]) => {
                                    const isMe = m.user_id === userId;
                                    const showHeader = idx === arr.length - 1 || arr[idx + 1].user_id !== m.user_id;
                                    return (
                                        <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                            {showHeader && (
                                                <span className="mb-0.5 px-1 text-[10px] font-medium text-muted-foreground">
                                                    {isMe ? 'Ich' : m.user_email?.split('@')[0]}
                                                </span>
                                            )}
                                            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
                                                isMe ? 'rounded-tr-sm bg-gradient-to-r from-emerald-500/90 to-teal-600/90 text-white'
                                                     : 'rounded-tl-sm border border-border bg-muted text-muted-foreground'
                                            } whitespace-pre-wrap`}>
                                                {m.content}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <form onSubmit={(e) => { e.stopPropagation(); handleSendMessage(e); }} className="p-3 border-t border-border bg-muted flex gap-2 shrink-0">
                                <input
                                    value={chatInputMessage}
                                    onChange={e => setChatInputMessage(e.target.value)}
                                    className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-teal-500/50"
                                    placeholder="Nachricht schreiben..."
                                />
                                <button type="submit" disabled={!chatInputMessage.trim()} className="p-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg text-white disabled:opacity-50 hover:opacity-90">
                                    <Send size={18} />
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    if (isFullscreen) {
        return <>{content}</>;
    }

    return (
        <GlassCard className="flex flex-col h-full p-0 overflow-hidden border-none bg-muted" contentClassName="!p-0 flex flex-col h-full relative">
            {content}
        </GlassCard>
    );
};
