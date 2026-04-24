import React from 'react';
import { X, CheckCircle2, Circle, Clock, User, MessageSquare } from 'lucide-react';
import { CommissionDetailContent } from '../../commissions/components/CommissionDetailContent';
import { MachineDetailContent } from '../../machines/components/MachineDetailContent';
import { KeyHandoverContent } from '../../keys/components/KeyComponents';
import { CommissionOfficeContent } from '../../../../src/components/CommissionOfficeContent';
import { ChangelogHistoryContent } from '../../../../src/components/ChangelogHistoryContent';
import { Machine, Commission, Key } from '../../../../types';
import { supabase } from '../../../../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface DashboardDetailPanelProps {
    // Selection state
    selectedMachine: Machine | null;
    selectedKey: Key | null;
    viewingCommission: Commission | null;
    selectedDashboardTask: any | null;
    showChangelogHistory: boolean;

    // Data
    allUsers: any[];
    isSavingProcess: boolean;
    userId?: string;

    // Callbacks
    onCloseMachine: () => void;
    onCloseKey: () => void;
    onCloseCommission: () => void;
    onCloseTask: () => void;
    onCloseChangelog: () => void;
    onMachinesRefresh: () => void;
    onKeysRefresh: () => void;
    onEventsRefresh: () => void;
    onSaveOfficeData: (isProcessed: boolean, notes: string) => Promise<void>;
    onUpdateTask: (taskId: string, status: string) => Promise<void>;
    onToggleSubtask: (subtaskId: string, completed: boolean) => Promise<void>;
    onOpenTaskApp: () => void;
}

export const DashboardDetailPanel: React.FC<DashboardDetailPanelProps> = ({
    selectedMachine,
    selectedKey,
    viewingCommission,
    selectedDashboardTask,
    showChangelogHistory,
    allUsers,
    isSavingProcess,
    userId,
    onCloseMachine,
    onCloseKey,
    onCloseCommission,
    onCloseTask,
    onCloseChangelog,
    onMachinesRefresh,
    onKeysRefresh,
    onEventsRefresh,
    onSaveOfficeData,
    onUpdateTask,
    onToggleSubtask,
    onOpenTaskApp,
}) => {
    const navigate = useNavigate();

    return (
        <div className="w-[40%] bg-transparent h-full animate-in slide-in-from-right-10 duration-300">
            {/* MACHINE DETAIL */}
            {selectedMachine && (
                <div className="h-full bg-background/50 backdrop-blur-2xl rounded-2xl border border-border shadow-xl overflow-hidden flex flex-col relative">
                    <div className="absolute top-4 right-4 z-50">
                        <button onClick={onCloseMachine} className="p-2 bg-black/50 hover:bg-muted rounded-full text-muted-foreground hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <MachineDetailContent
                            machine={selectedMachine}
                            users={allUsers}
                            onClose={onCloseMachine}
                            onUpdate={() => { onMachinesRefresh(); onEventsRefresh(); }}
                        />
                    </div>
                </div>
            )}

            {/* KEY DETAIL */}
            {selectedKey && (
                <div className="h-full bg-background/50 backdrop-blur-2xl rounded-2xl border border-border shadow-xl overflow-hidden flex flex-col relative">
                    <KeyHandoverContent
                        selectedKeys={[selectedKey]}
                        type="return"
                        onClose={onCloseKey}
                        onSave={() => { onKeysRefresh(); onEventsRefresh(); onCloseKey(); }}
                    />
                </div>
            )}

            {/* TASK DETAIL */}
            {selectedDashboardTask && (
                <div className="h-full bg-background/50 backdrop-blur-2xl rounded-2xl border border-border shadow-xl overflow-hidden flex flex-col relative">
                    <div className="absolute top-4 right-4 z-[60]">
                        <button onClick={onCloseTask} className="p-2 bg-black/50 hover:bg-muted rounded-full text-muted-foreground hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-12">
                        <TaskDetailContent
                            task={selectedDashboardTask}
                            onUpdateStatus={onUpdateTask}
                            onToggleSubtask={onToggleSubtask}
                            onOpenApp={onOpenTaskApp}
                        />
                    </div>
                </div>
            )}

            {/* COMMISSION DETAIL */}
            {viewingCommission && (
                <div className="h-full bg-background/50 backdrop-blur-2xl rounded-2xl border border-border shadow-xl overflow-hidden flex flex-col relative">
                    {['Draft', 'Preparing'].includes(viewingCommission.status) ? (
                        <CommissionDetailContent
                            commission={viewingCommission}
                            items={(viewingCommission as any).commission_items || []}
                            localHistoryLogs={[]}
                            allItemsPicked={false}
                            hasBackorders={false}
                            isSubmitting={false}
                            onSetReady={() => toast.info('Bitte in der Kommissionierungs-Ansicht durchführen')}
                            onWithdraw={() => toast.info('Bitte in der Kommissionierungs-Ansicht durchführen')}
                            onResetStatus={() => toast.info('Bitte in der Kommissionierungs-Ansicht durchführen')}
                            onRevertWithdraw={() => toast.info('Bitte in der Kommissionierungs-Ansicht durchführen')}
                            onInitReturn={() => toast.info('Bitte in der Kommissionierungs-Ansicht durchführen')}
                            onReturnToReady={() => toast.info('Bitte in der Kommissionierungs-Ansicht durchführen')}
                            onCompleteReturn={() => toast.info('Bitte in der Kommissionierungs-Ansicht durchführen')}
                            onEdit={(e) => {
                                e.stopPropagation();
                                onCloseCommission();
                                navigate('/commissions', { state: { editCommissionId: viewingCommission.id } });
                            }}
                            onPrint={() => toast.info('Drucken...')}
                            onTogglePicked={() => { }}
                            onToggleBackorder={() => { }}
                            onSaveNote={() => { }}
                            onClose={onCloseCommission}
                            onSaveOfficeData={onSaveOfficeData}
                            onRequestCancellation={async (id, type, note) => {
                                if (!window.confirm('Kommission wirklich stornieren?')) return;
                                const instruction = type === 'restock' ? 'ACTION: ZURÜCK INS LAGER.' : 'ACTION: RETOURE AN LIEFERANT.';
                                const fullNote = `${instruction} ${note ? `(${note})` : ''} [Storno: ${new Date().toLocaleDateString()}]`;
                                const currentNotes = viewingCommission?.notes || '';
                                const newNotes = currentNotes ? `${fullNote}\n${currentNotes}` : fullNote;
                                try {
                                    const { error } = await supabase.from('commissions').update({
                                        status: 'ReturnPending',
                                        is_processed: false,
                                        notes: newNotes
                                    }).eq('id', id);
                                    if (error) throw error;
                                    await supabase.from('commission_events').insert({
                                        commission_id: id,
                                        commission_name: viewingCommission?.name || 'Unbekannt',
                                        event_type: 'status_change',
                                        details: `Storno beauftragt: ${type === 'restock' ? 'Einlagern' : 'Lieferant'}`,
                                        created_by: userId
                                    });
                                    onCloseCommission();
                                    onEventsRefresh();
                                } catch (e) {
                                    console.error(e);
                                    alert('Fehler beim Stornieren');
                                }
                            }}
                        />
                    ) : (
                        <CommissionOfficeContent
                            commission={viewingCommission}
                            onClose={onCloseCommission}
                            onSave={onSaveOfficeData}
                            isSaving={isSavingProcess}
                        />
                    )}
                </div>
            )}

            {/* CHANGELOG DETAIL */}
            {showChangelogHistory && (
                <div className="h-full bg-background/50 backdrop-blur-2xl rounded-2xl border border-border shadow-xl overflow-hidden flex flex-col relative">
                    <div className="absolute top-4 right-4 z-50">
                        <button onClick={onCloseChangelog} className="p-2 bg-black/50 hover:bg-muted rounded-full text-muted-foreground hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <ChangelogHistoryContent />
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Task Detail Sub-Component ---
export interface TaskDetailContentProps {
    task: any;
    onUpdateStatus: (taskId: string, status: string) => Promise<void>;
    onToggleSubtask: (subtaskId: string, completed: boolean) => Promise<void>;
    onOpenApp: () => void;
}

export const TaskDetailContent: React.FC<TaskDetailContentProps> = ({ task, onUpdateStatus, onToggleSubtask, onOpenApp }) => {
    let desc = task.description || '';
    try {
        const parsed = JSON.parse(task.description || '{}');
        desc = parsed.text || desc;
    } catch (e) { }

    return (
        <div className="space-y-6 flex flex-col h-full overflow-y-auto w-full">
            <div>
                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold text-white pr-4">{task.title}</h2>
                    <div className="flex bg-muted border border-border rounded-lg overflow-hidden shrink-0 mt-1">
                        <button onClick={() => onUpdateStatus(task.id, 'todo')} className={`px-3 py-1.5 text-xs font-medium ${task.status === 'todo' ? 'bg-muted text-white' : 'text-muted-foreground hover:bg-muted hover:text-muted-foreground'} transition-colors`}>Offen</button>
                        <button onClick={() => onUpdateStatus(task.id, 'in_progress')} className={`px-3 py-1.5 text-xs font-medium border-l border-border ${task.status === 'in_progress' ? 'bg-teal-500/20 text-teal-400' : 'text-muted-foreground hover:bg-muted hover:text-muted-foreground'} transition-colors`}>In Arbeit</button>
                        <button onClick={() => onUpdateStatus(task.id, 'done')} className={`px-3 py-1.5 text-xs font-medium border-l border-border ${task.status === 'done' ? 'bg-primary/20 text-emerald-400' : 'text-muted-foreground hover:bg-muted hover:text-muted-foreground'} transition-colors`}>Erledigt</button>
                    </div>
                </div>
                {desc && <p className="text-muted-foreground whitespace-pre-wrap mt-4 bg-muted p-4 rounded-xl border border-border leading-relaxed text-sm">{desc}</p>}
            </div>

            {task.subtasks && task.subtasks.length > 0 && (
                <div>
                    <h3 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle2 size={16} /> Arbeitspunkte
                    </h3>
                    <div className="space-y-2">
                        {task.subtasks.map((st: any) => (
                            <div key={st.id} onClick={() => onToggleSubtask(st.id, st.completed)} className="group flex items-center gap-3 p-4 bg-muted border border-border rounded-xl cursor-pointer hover:bg-muted hover:border-teal-500/30 transition-all">
                                <div className="flex-shrink-0 mt-0.5">
                                    {st.completed ? <CheckCircle2 className="text-teal-400" size={20} /> : <Circle className="text-muted-foreground group-hover:text-muted-foreground transition-colors" size={20} />}
                                </div>
                                <span className={`text-sm font-medium transition-colors ${st.completed ? 'text-muted-foreground line-through' : 'text-muted-foreground group-hover:text-teal-300'}`}>{st.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5"><User size={14} /> {task.user_email?.split('@')[0] || 'Unbekannt'}</div>
                <div>{new Date(task.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr</div>
            </div>

            <div className="mt-2 pt-4 flex justify-end">
                <button onClick={onOpenApp} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl text-white font-medium hover:opacity-90 transition-opacity">
                    <MessageSquare size={16} /> In Tasks-App öffnen
                </button>
            </div>
        </div>
    );
};
