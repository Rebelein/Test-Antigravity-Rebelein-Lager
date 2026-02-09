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
        version: '0.0.64',
        release_date: '10.02.2026',
        changes: [
            { type: 'info', text: 'System-Wartung: Versionierung und Konfiguration optimiert.' },
        ]
    },
    {
        version: '0.0.63',
        release_date: '03.02.2026',
        changes: [
            { type: 'feature', text: 'Dark Mode enforced: Die App nutzt nun systemweit den Dark Mode für ein einheitliches Design.' },
            { type: 'fix', text: 'iOS Login Fix: Gespeicherte Passwörter werden nun zuverlässig vorgeschlagen.' },
            { type: 'fix', text: 'Design-Korrekturen: Diverse Light-Mode Fehler im Dashboard und Kommissions-Details behoben.' },
        ]
    },
    {
        version: '0.0.61',
        release_date: '02.02.2026',
        changes: [
            { type: 'feature', text: 'Neuer Bild-Optimierer: Tool zur nachträglichen Komprimierung aller Artikel- & Kleidungsbilder inkl. Bucket-Support.' },
            { type: 'fix', text: 'Lagerbestand: Sortierung automatisch auf "Fach (auf)" gesetzt & dauerhaft gespeichert.' },
            { type: 'feature', text: 'Dashboard: Neuer Schnellzugriff "Optimierer" in Apps & Funktionen.' },
        ]
    },
    {
        version: '0.0.56',
        release_date: '30.01.2026',
        changes: [
            { type: 'feature', text: 'Kommissions-Kacheln komplett überarbeitet: Farbiger Status-Balken, gefärbte StatusBadges, Lieferant+Bestellnummer in Badges.' },
            { type: 'feature', text: 'Neuer Artikel Modal an Kommissions-Design angepasst: Türkiser Akzent, dunklere Sektionen, IST/SOLL prominenter.' },
            { type: 'fix', text: 'iOS Performance Modus behoben: App wurde leer angezeigt (translate3d Bug), Modal-Overlays nun vollständig deckend.' },
        ]
    },
    {
        version: '0.0.55',
        release_date: '29.01.2026',
        changes: [
            { type: 'feature', text: 'Manuelle Bestellung optimiert: Lieferantenauswahl, manuelle Positionen & neues Erfolgs-Fenster (kein nerviger Alert mehr).' },
            { type: 'feature', text: 'Übersicht verbessert: Lieferanten-Bestellnummer & Kommissionsnummer jetzt überall sichtbar (Kachel & Detail-Ansicht).' },
            { type: 'feature', text: 'Schnelleres Buchen: Neuer "Alle empfangen" Button setzt Bestellung sofort auf vollständig.' },
        ]
    },
    {
        version: '0.0.53',
        changes: [
            {
                type: 'feature',
                text: 'Kommissionen: Neuer "Vermisst"-Tab mit 3-Spalten-Layout (Fehlt, Verfügbar, Offen) für bessere Bestandsübersicht.',
            },
            {
                type: 'feature',
                text: 'Aufräum-Funktion: Nicht gefundene Kommissionen werden nun automatisch in die "Fehlt"-Spalte verschoben.',
            },
            {
                type: 'feature',
                text: 'Löschen: Schnell-Lösch-Buttons für vermisste und nicht gescannte Kommissionen hinzugefügt.',
            },
        ],
        release_date: '2026-01-22',
    },
    {
        version: '0.0.52',
        changes: [
            {
                type: 'fix',
                text: 'Kritische Fehlerbehebungen: Kommissionen-Seite stabilisiert, iOS-Navigations-Loop und Scanner-Dauervibration behoben.',
            },
            {
                type: 'feature',
                text: 'Inventur-Funktion überarbeitet: Manuelle "Prüfung neu starten"-Funktion hinzugefügt.',
            },
            {
                type: 'info',
                text: 'UI-Verbesserungen: Anzeige des Prüfungsdatums und optimierte Listenansicht im "Vermisst"-Tab.',
            },
        ],
        release_date: '2026-01-21',
    },
    {
        version: '0.0.52',
        release_date: '23.01.2026',
        changes: [
            { type: 'feature', text: 'Seiten-Verwaltung: Sidebar Apps können jetzt ein/ausgeblendet und sortiert werden.' },
            { type: 'fix', text: 'OneSignal Integration entfernt (beseitigt Browser Fehler).' },
            { type: 'fix', text: 'Datenbank Initialisierungs-Fehler beim Start behoben.' },
        ]
    },
    {
        version: '0.0.51',
        changes: [
            {
                type: 'fix',
                text: 'Runtime-Fehler im "Vermisst"-Tab behoben: ScanLine Icon fehlte.',
            },
            {
                type: 'fix',
                text: 'Build-Fehler in Changelog behoben.',
            },
        ],
        release_date: '2026-01-20',
    },
    {
        version: '0.0.50',
        changes: [
            {
                type: 'fix',
                text: 'Update-Erkennung verbessert: Die App prüft nun beim Start und alle 2 Minuten auf neue Versionen.',
            },
        ],
        release_date: '2026-01-15',
    },
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
