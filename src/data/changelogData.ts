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
        version: '0.0.49',
        changes: [
            {
                type: 'fix',
                text: 'Kritischen Fehler beim "Regal aufräumen" behoben: Aktualisierung von großen Mengen an Kommissionen schlug fehl (Batch-Update implementiert).',
            },
        ],
        release_date: '2026-01-15',
    },
    {
        version: '0.0.48',
        changes: [
            {
                type: 'feature',
                text: 'Storno-UI verbessert: Storno-Artikel nun als klickbare Badges (kopiert Lieferanten-Nr.) dargestellt.',
            },
            {
                type: 'feature',
                text: 'Druck-Bereich & Storno-Rückbau nun einklappbar für bessere Übersicht.',
            },
            {
                type: 'feature',
                text: 'Rücksende-Etikett erweitert: Enthält nun Lieferant, Vorgangsnummer und Notizen übersichtlich dargestellt.',
            },
            {
                type: 'feature',
                text: 'Bestätigungs-Fenster beim Löschen von Kommissionen (Papierkorb / Endgültig) überarbeitet (App-Design statt Browser-Alert).',
            },
            {
                type: 'fix',
                text: 'Workflow "Regal aufräumen" optimiert: Wechselt nun automatisch in den Tab "Vermisst", um Ergebnisse sofort anzuzeigen.',
            },
        ],
        release_date: '2026-01-14',
    },
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
