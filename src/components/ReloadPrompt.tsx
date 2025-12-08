import { Button, GlassCard } from './UIComponents';

export const ReloadPrompt: React.FC = () => {
    // interval for checking updates (10 minutes)
    const intervalMS = 10 * 60 * 1000;

    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(swUrl, r) {
            console.log(`Service Worker registered: ${swUrl}`);

            // Setup periodic update check
            if (r) {
                setInterval(() => {
                    console.log('Checking for Service Worker update...');
                    r.update();
                }, intervalMS);
            }
        },
        onRegisterError(error) {
            console.error('SW registration error', error);
        },
    });

    const close = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    // If nothing to show, render nothing
    if (!offlineReady && !needRefresh) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-300">
            <GlassCard className="!p-0 border-l-4 border-l-emerald-500 overflow-hidden shadow-2xl min-w-[320px]">
                <div className="p-4 flex items-start gap-3 bg-white/90 dark:bg-gray-900/95 backdrop-blur-xl">
                    <div className="mt-1 shrink-0">
                        {needRefresh ? (
                            <Download className="text-emerald-500 animate-bounce" size={24} />
                        ) : (
                            <AlertTriangle className="text-amber-500" size={24} />
                        )}
                    </div>

                    <div className="flex-1">
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                            {needRefresh ? 'Update verfügbar!' : 'Bereit zur Offline-Nutzung'}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-white/60 mt-1 leading-relaxed">
                            {needRefresh
                                ? 'Eine neue Version der App ist verfügbar. Klicke auf "Aktualisieren", um die neuesten Funktionen zu laden.'
                                : 'Die App wurde gecached und kann nun auch offline verwendet werden.'}
                        </p>

                        <div className="flex gap-2 mt-3">
                            {needRefresh && (
                                <Button
                                    size="sm"
                                    onClick={() => updateServiceWorker(true)}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-1.5 h-auto flex-1 justify-center"
                                    icon={<RefreshCw size={12} />}
                                >
                                    Aktualisieren
                                </Button>
                            )}
                            <button
                                onClick={close}
                                className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors"
                            >
                                Schließen
                            </button>
                        </div>
                    </div>

                    <button onClick={close} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>
            </GlassCard>
        </div>
    );
};
