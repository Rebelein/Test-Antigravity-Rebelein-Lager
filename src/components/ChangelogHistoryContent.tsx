import React from 'react';
import { changelogData } from '../data/changelogData';
import { Zap, Wrench, Info, Calendar } from 'lucide-react';

export const ChangelogHistoryContent: React.FC = () => {
    return (
        <div className="p-6 space-y-8">
            <h2 className="text-2xl font-bold text-foreground mb-6">Update Verlauf</h2>

            {changelogData.map((entry) => (
                <div key={entry.version} className="relative pl-6 border-l-2 border-border last:border-0">
                    {/* Timeline Dot */}
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-background border-2 border-emerald-500 box-content" />

                    <div className="mb-4">
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-xl font-bold text-foreground">v{entry.version}</h3>
                            {entry.release_date && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted border dark:border-white/5 border-border text-xs text-muted-foreground">
                                    <Calendar size={10} />
                                    <span>{entry.release_date}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {entry.changes.map((change, idx) => (
                            <div key={idx} className="flex gap-3 items-start bg-muted p-3 rounded-lg border dark:border-white/5 border-border hover:border-border transition-colors">
                                <div className="mt-0.5 shrink-0">
                                    {change.type === 'feature' && <Zap size={16} className="dark:text-amber-400 text-amber-800" />}
                                    {change.type === 'fix' && <Wrench size={16} className="dark:text-blue-400 text-blue-800" />}
                                    {change.type === 'info' && <Info size={16} className="text-muted-foreground" />}
                                </div>
                                <div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mr-2 align-middle
                      ${change.type === 'feature' ? 'bg-amber-400/10 dark:text-amber-400 text-amber-800' : ''}
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
                </div>
            ))}

            {changelogData.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                    Keine Einträge vorhanden.
                </div>
            )}
        </div>
    );
};
