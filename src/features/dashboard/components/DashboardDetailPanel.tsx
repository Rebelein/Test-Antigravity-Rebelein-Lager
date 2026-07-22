import React from 'react';
import { CommissionDetailContent } from '../../commissions/components/CommissionDetailContent';
import { MachineDetailContent } from '../../machines/components/MachineDetailContent';
import { KeyHandoverContent } from '../../keys/components/KeyComponents';
import { CommissionOfficeContent } from '../../../../src/components/CommissionOfficeContent';
import { ChangelogHistoryContent } from '../../../../src/components/ChangelogHistoryContent';
import { Machine, Commission, Key } from '../../../../types';
import { supabase } from '../../../../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface DashboardDetailContentProps {
    // Selection state
    selectedMachine: Machine | null;
    selectedKey: Key | null;
    viewingCommission: Commission | null;
    showChangelogHistory: boolean;

    // Data
    allUsers: any[];
    isSavingProcess: boolean;
    userId?: string;

    // Callbacks
    onCloseMachine: () => void;
    onCloseKey: () => void;
    onCloseCommission: () => void;
    onMachinesRefresh: () => void;
    onKeysRefresh: () => void;
    onEventsRefresh: () => void;
    onSaveOfficeData: (isProcessed: boolean, notes: string) => Promise<void>;
}

/**
 * Pure detail-content switcher. The surrounding shell (bottom sheet on mobile,
 * resizable side panel on tablet/desktop, header + close button) is provided
 * by MasterDetailLayout in Dashboard.tsx.
 */
export const DashboardDetailContent: React.FC<DashboardDetailContentProps> = ({
    selectedMachine,
    selectedKey,
    viewingCommission,
    showChangelogHistory,
    allUsers,
    isSavingProcess,
    userId,
    onCloseMachine,
    onCloseKey,
    onCloseCommission,
    onMachinesRefresh,
    onKeysRefresh,
    onEventsRefresh,
    onSaveOfficeData,
}) => {
    const navigate = useNavigate();

    // MACHINE DETAIL
    if (selectedMachine) {
        return (
            <MachineDetailContent
                machine={selectedMachine}
                users={allUsers}
                onClose={onCloseMachine}
                onUpdate={() => { onMachinesRefresh(); onEventsRefresh(); }}
            />
        );
    }

    // KEY DETAIL
    if (selectedKey) {
        return (
            <KeyHandoverContent
                selectedKeys={[selectedKey]}
                type="return"
                onClose={onCloseKey}
                onSave={() => { onKeysRefresh(); onEventsRefresh(); onCloseKey(); }}
            />
        );
    }

    // COMMISSION DETAIL
    if (viewingCommission) {
        return ['Draft', 'Preparing'].includes(viewingCommission.status) ? (
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
        );
    }

    // CHANGELOG DETAIL
    if (showChangelogHistory) {
        return <ChangelogHistoryContent />;
    }

    return null;
};
