import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'update';

export interface AppNotification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    timestamp: number;
    details?: any;
}

interface NotificationContextType {
    notifications: AppNotification[];
    addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp'>) => void;
    removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const { user } = useAuth();

    const addNotification = useCallback((notification: Omit<AppNotification, 'id' | 'timestamp'>) => {
        const id = Math.random().toString(36).substr(2, 9);
        const timestamp = Date.now();

        setNotifications(prev => [
            { ...notification, id, timestamp },
            ...prev.slice(0, 4) // Keep max 5 notifications at a time
        ]);

        // Auto-dismiss after 6 seconds
        setTimeout(() => {
            removeNotification(id);
        }, 6000);
    }, []);

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    // --- REALTIME SUBSCRIPTIONS ---
    useEffect(() => {
        // Channel for Articles (Inventory)
        const articleChannel = supabase
            .channel('global-notifications-articles')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'articles' },
                (payload) => {
                    const oldRec = payload.old as any;
                    const newRec = payload.new as any;

                    // Detect Stock Change
                    if (oldRec.amount !== newRec.amount) {
                        const diff = newRec.amount - oldRec.amount;
                        const action = diff > 0 ? 'erhöht' : 'verringert';

                        addNotification({
                            type: 'update',
                            title: 'Lagerbestand geändert',
                            message: `${newRec.name}: Bestand ${action} (${oldRec.amount} ➔ ${newRec.amount})`
                        });
                    }
                }
            )
            .subscribe();

        // Channel for Commission Events
        const commissionChannel = supabase
            .channel('global-notifications-commissions')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'commission_events' },
                (payload) => {
                    const event = payload.new as any;

                    // Don't notify the user about their OWN actions if possible (optional, but good UX)
                    // However, for a team view, seeing all actions is often better. 
                    // Let's show all for now.

                    let title = 'Kommission aktualisiert';
                    let type: NotificationType = 'info';

                    switch (event.action) {
                        case 'created': title = 'Neue Kommission'; type = 'success'; break;
                        case 'status_change': title = 'Statusänderung'; type = 'info'; break;
                        case 'deleted': title = 'Kommission gelöscht'; type = 'warning'; break;
                        case 'labels_printed': title = 'Etiketten gedruckt'; type = 'info'; break;
                        default: title = 'Aktivität';
                    }

                    addNotification({
                        type: type,
                        title: title,
                        message: `${event.commission_name}: ${event.details || event.action}`
                    });
                }
            )
            .subscribe();

        // Channel for Machine Events
        const machineChannel = supabase
            .channel('global-notifications-machines')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'machine_events' },
                (payload) => {
                    const event = payload.new as any;

                    let title = 'Maschinen-Status';
                    let type: NotificationType = 'info';

                    if (event.type === 'status_change') {
                        if (event.details.includes('defekt') || event.details.includes('Reparatur')) type = 'error';
                        else if (event.details.includes('Verfügbar')) type = 'success';
                    }

                    addNotification({
                        type: type,
                        title: title,
                        message: `${event.machine_name || 'Gerät'}: ${event.details}`
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(articleChannel);
            supabase.removeChannel(commissionChannel);
            supabase.removeChannel(machineChannel);
        };
    }, [addNotification]);

    return (
        <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
            {children}
        </NotificationContext.Provider>
    );
};
