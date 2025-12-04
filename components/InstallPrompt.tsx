import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { GlassCard, Button } from './UIComponents';

export const InstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Check if device is iOS
        const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(isIosDevice);

        // Check if already in standalone mode
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

        if (isStandalone) {
            return; // Don't show if already installed
        }

        // Handle Android/Desktop standard install prompt
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // For iOS, simply show the prompt after a delay if not installed
        if (isIosDevice) {
            // Check if we've already shown it this session to avoid annoyance
            const hasShown = sessionStorage.getItem('iosInstallPromptShown');
            if (!hasShown) {
                setTimeout(() => setShowPrompt(true), 3000);
            }
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
                setShowPrompt(false);
            }
        }
    };

    const handleClose = () => {
        setShowPrompt(false);
        if (isIOS) {
            sessionStorage.setItem('iosInstallPromptShown', 'true');
        }
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-[200] md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-10 duration-500">
            <GlassCard className="p-4 border-emerald-500/30 shadow-emerald-500/10 relative">
                <button
                    onClick={handleClose}
                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-white transition-colors"
                >
                    <X size={16} />
                </button>

                <div className="flex items-start gap-4 pr-6">
                    <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                        <Download size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white mb-1">App installieren</h3>
                        <p className="text-sm text-gray-400 mb-3">
                            {isIOS
                                ? "Installiere die App für den besten Zugriff: Tippe auf 'Teilen' und dann 'Zum Home-Bildschirm'."
                                : "Installiere die App für schnelleren Zugriff und Offline-Funktionen."}
                        </p>

                        {!isIOS && (
                            <Button
                                onClick={handleInstallClick}
                                className="w-full py-2 text-sm"
                            >
                                Jetzt installieren
                            </Button>
                        )}
                    </div>
                </div>
            </GlassCard>
        </div>
    );
};
