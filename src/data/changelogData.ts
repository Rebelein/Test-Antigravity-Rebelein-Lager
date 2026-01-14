export interface ChangelogEntry {
    version: string;
    changes: {
        type: 'feature' | 'fix' | 'info';
        text: string;
    }[];
    release_date?: string;
}

export const changelogData: ChangelogEntry[] = [
    {
        version: '0.0.47',
        changes: [
            {
                type: 'feature',
                text: 'Split-View kann nun auch auf Mobilgeräten per Touch vergrößert/verkleinert werden.',
            },
        ],
        release_date: '2026-01-14',
    },
    {
        version: '0.0.46',
        changes: [
            {
                type: 'fix',
                text: 'Fehler behoben, durch den Eingabefelder beim Erstellen von Kommissionen blockiert waren.',
            },
            {
                type: 'fix',
                text: 'Absturz (Endlosschleife) beim Öffnen des Kommissions-Modals behoben.',
            },
            {
                type: 'feature',
                text: 'Neue Kommissionen aus dem Dashboard werden nun automatisch zum Etikettendruck vorgemerkt.',
            },
        ],
        release_date: '2026-01-14',
    },
    // Hier können zukünftige Changelogs einfach oben angefügt werden
];
