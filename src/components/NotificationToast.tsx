import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications, AppNotification } from '../../contexts/NotificationContext';
import { Bell, CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

const NotificationToast: React.FC = () => {
    const { notifications, removeNotification } = useNotifications();

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-md px-4 pointer-events-none">
            <AnimatePresence mode="popLayout">
                {notifications.map((notification) => (
                    <motion.div
                        key={notification.id}
                        layout
                        initial={{ opacity: 0, y: -20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        className="pointer-events-auto"
                    >
                        <div className={`
                            relative overflow-hidden rounded-2xl border backdrop-blur-xl shadow-2xl p-4 flex items-start gap-3
                            ${getStyleForType(notification.type)}
                        `}>
                            {/* Icon */}
                            <div className="mt-0.5 shrink-0">
                                {getIconForType(notification.type)}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-white leading-tight">{notification.title}</h4>
                                <p className="text-xs text-white/80 mt-1 leading-relaxed">{notification.message}</p>
                            </div>

                            {/* Close Button */}
                            <button
                                onClick={() => removeNotification(notification.id)}
                                className="shrink-0 text-white/40 hover:text-white transition-colors"
                            >
                                <X size={16} />
                            </button>

                            {/* Progress Bar (Visual flair) */}
                            <motion.div
                                initial={{ width: "100%" }}
                                animate={{ width: "0%" }}
                                transition={{ duration: 6, ease: "linear" }}
                                className="absolute bottom-0 left-0 h-0.5 bg-white/30"
                            />
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

const getStyleForType = (type: string) => {
    switch (type) {
        case 'success': return 'bg-emerald-500/80 border-emerald-400/50';
        case 'error': return 'bg-red-500/80 border-red-400/50';
        case 'warning': return 'bg-amber-500/80 border-amber-400/50';
        case 'update': return 'bg-blue-500/80 border-blue-400/50';
        default: return 'bg-gray-800/80 border-white/20'; // info
    }
};

const getIconForType = (type: string) => {
    switch (type) {
        case 'success': return <CheckCircle2 size={18} className="text-white" />;
        case 'error': return <XCircle size={18} className="text-white" />;
        case 'warning': return <AlertTriangle size={18} className="text-white" />;
        case 'update': return <Bell size={18} className="text-white" />;
        default: return <Info size={18} className="text-white" />;
    }
};

export default NotificationToast;
