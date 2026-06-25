
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, PartyPopper, Zap, Wrench, Info } from 'lucide-react';
import { ChangelogEntry } from '../../types';

import { changelogData } from '../data/changelogData';

export const ChangelogModal: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [changelog, setChangelog] = useState<ChangelogEntry | null>(null);
    const currentVersion = import.meta.env.APP_VERSION || '0.0.0';

    useEffect(() => {
        const checkVersion = () => {
            // 1. Hole die lokal gespeicherte "zuletzt gesehene Version"
            const lastSeenVersion = localStorage.getItem('last_seen_version');

            // Wenn die Version gleich ist, nichts tun (außer beim Entwickeln zum Testen evtl. auskommentieren)
            if (lastSeenVersion === currentVersion) {
                return;
            }

            // 2. Hole den Changelog für die AKTUELLE Version aus der LOKALEN Datei
            const currentChangelog = changelogData.find(entry => entry.version === currentVersion);

            if (!currentChangelog) {
                // Kein Changelog für diese Version gefunden? Dann nicht anzeigen.
                return;
            }

            setChangelog(currentChangelog);
            setIsOpen(true);
        };

        checkVersion();
    }, [currentVersion]);


    const handleClose = () => {
        // Speichere, dass der User diese Version gesehen hat
        localStorage.setItem('last_seen_version', currentVersion);
        setIsOpen(false);
    };

    if (!isOpen || !changelog) return null;

    return createPortal(
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 dark:bg-black/30 bg-muted/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="relative bg-primary/20 p-6 border-b border-border">
                    <div className="absolute top-0 right-0 p-4">
                        <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary rounded-lg shadow-lg shadow-emerald-500/20">
                            <PartyPopper className="text-gray-900" size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-foreground">Neu in v{changelog.version}</h2>
                    </div>
                    <p className="dark:text-emerald-200 text-emerald-900/80 text-sm">
                        Das Lager wird besser! Hier sind die neuesten Updates.
                    </p>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                    {changelog.changes.map((change, index) => (
                        <div key={index} className="flex gap-3 items-start">
                            <div className="mt-0.5 shrink-0">
                                {change.type === 'feature' && <Zap size={18} className="dark:text-yellow-400 text-yellow-800" />}
                                {change.type === 'fix' && <Wrench size={18} className="dark:text-blue-400 text-blue-800" />}
                                {change.type === 'info' && <Info size={18} className="text-muted-foreground" />}
                            </div>
                            <div>
                                <span className={`text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mr-2
                  ${change.type === 'feature' ? 'bg-yellow-400/10 dark:text-yellow-400 text-yellow-800' : ''}
                  ${change.type === 'fix' ? 'bg-blue-400/10 dark:text-blue-400 text-blue-800' : ''}
                  ${change.type === 'info' ? 'bg-card dark:text-gray-300 text-gray-800' : ''}
                `}>
                                    {change.type === 'feature' ? 'NEU' : change.type === 'fix' ? 'FIX' : 'INFO'}
                                </span>
                                <span className="dark:text-gray-300 text-gray-800 text-sm leading-relaxed">
                                    {change.text}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 bg-card border-t border-border flex justify-end">
                    <button
                        onClick={handleClose}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-1 focus-visible:ring-ring px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-emerald-900/20"
                    >
                        Verstanden
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
