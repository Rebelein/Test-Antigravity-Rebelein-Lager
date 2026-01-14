
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, PartyPopper, Zap, Wrench, Info } from 'lucide-react';
import { ChangelogEntry } from '../types';

import { changelogData } from '../src/data/changelogData';

export const ChangelogModal: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [changelog, setChangelog] = useState<ChangelogEntry | null>(null);
    const currentVersion = process.env.APP_VERSION || '0.0.0';

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="relative bg-emerald-600/20 p-6 border-b border-gray-800">
                    <div className="absolute top-0 right-0 p-4">
                        <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-500 rounded-lg shadow-lg shadow-emerald-500/20">
                            <PartyPopper className="text-gray-900" size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-white">Neu in v{changelog.version}</h2>
                    </div>
                    <p className="text-emerald-200/80 text-sm">
                        Das Lager wird besser! Hier sind die neuesten Updates.
                    </p>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                    {changelog.changes.map((change, index) => (
                        <div key={index} className="flex gap-3 items-start">
                            <div className="mt-0.5 shrink-0">
                                {change.type === 'feature' && <Zap size={18} className="text-yellow-400" />}
                                {change.type === 'fix' && <Wrench size={18} className="text-blue-400" />}
                                {change.type === 'info' && <Info size={18} className="text-gray-400" />}
                            </div>
                            <div>
                                <span className={`text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mr-2
                  ${change.type === 'feature' ? 'bg-yellow-400/10 text-yellow-400' : ''}
                  ${change.type === 'fix' ? 'bg-blue-400/10 text-blue-400' : ''}
                  ${change.type === 'info' ? 'bg-gray-700 text-gray-300' : ''}
                `}>
                                    {change.type === 'feature' ? 'NEU' : change.type === 'fix' ? 'FIX' : 'INFO'}
                                </span>
                                <span className="text-gray-300 text-sm leading-relaxed">
                                    {change.text}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-950/50 border-t border-gray-800 flex justify-end">
                    <button
                        onClick={handleClose}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-emerald-900/20"
                    >
                        Verstanden
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
