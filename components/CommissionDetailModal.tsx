import React from 'react';
import { GlassModal } from './UIComponents';
import { CommissionDetailContent } from './CommissionDetailContent';

interface ExtendedCommission {
    id: string;
    name: string;
    order_number?: string;
    status: string;
    notes?: string;
    commission_items?: any[];
    deleted_at?: string | null;
    suppliers?: { name: string };
    office_notes?: string;
    is_processed?: boolean;
}

interface CommissionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    commission: ExtendedCommission | null;
    items: any[];
    localHistoryLogs: any[];
    allItemsPicked: boolean;
    hasBackorders: boolean;
    isSubmitting: boolean;
    onSetReady: () => void;
    onWithdraw: () => void;
    onResetStatus: () => void;
    onRevertWithdraw: () => void;
    onInitReturn: () => void;
    onReturnToReady: () => void;
    onCompleteReturn: () => void;
    onEdit: (e: React.MouseEvent) => void;
    onPrint: () => void;
    onTogglePicked: (itemId: string, current: boolean) => void;
    onToggleBackorder: (itemId: string, current: boolean) => void;
    onSaveNote: (itemId: string, note: string) => void;
}

export const CommissionDetailModal: React.FC<CommissionDetailModalProps> = ({ isOpen, onClose, ...props }) => {
    if (!props.commission) return null;

    return (
        <GlassModal isOpen={isOpen} onClose={onClose} className="max-w-3xl h-[90vh]">
            <CommissionDetailContent  {...props} onClose={onClose} />
        </GlassModal>
    );
};

