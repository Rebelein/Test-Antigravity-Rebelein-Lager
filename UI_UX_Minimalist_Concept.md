# UI/UX Konzept: Minimalismus & Hohe Informationsdichte (Rebelein LagerApp)

Dieses Konzept beschreibt die gezielte Modernisierung der Benutzeroberfläche für den täglichen Werkstatt- und Bürobetrieb. Ziel ist **keine** Oversized-Symbolik für Handschuhe, sondern ein **schlankes, hochfunktionales & minimalistisches UI** ohne verschachtelte Menüs und ohne Informationsverlust.

---

## 🎯 Kernziele & Design-Philosophie

1. **Hohe Informationsdichte & Flache Hierarchie**:
   * Alle wesentlichen Daten (Artikelnummer, Lagerort, Lieferant, Rückstände, Status) auf einen Blick sichtbar.
   * Maximale Klicktiefe: **1 Klick** vom Hauptbereich zu allen Details und Aktionen.
2. **Minimalistische Ästhetik**:
   * Schlanke Typografie (12–14px Fließtext, präzise Schriftstärken).
   * Dezente Trennlinien (`border-border/40`) statt schwerer Schachtel-Karten.
   * Reduzierter visueller Ballast (fokussierte Status-Badges, klare Farbcodierung).
3. **Nahtloses Arbeiten auf Tablet & Desktop (>= 768px)**:
   * Volle 2-Spalten-Ansicht (Master-Detail Split View) bereits ab 768px Bildschirmbreite (iPads / Tablets im Hochformat).
   * Keine ungewollten Fullscreen-Modale auf Tablets.
4. **Einzeilige Kopfleisten & Tastatur-Schnellbedienung**:
   * Suche, Filter, Sortierung und Hauptaktionen in einer einzigen schlanken 48px Kopfzeile pro Modul vereinheitlicht.

---

## 🧱 Die 4 Säulen der Überarbeitung

### Säule 1: Schlanke Einzeilige Kopfleisten (Umgesetzt ✅)
* **Lagerbestand (`UnifiedInventoryHeader.tsx`)**:
  * Titel, Lager-Wechsler (Hauptlager/Favorit), Inline-Suchfeld, Filter-Pills (`Unter Soll`, `Bestellt`), Sortierung und "+ Neu"-Button in einer einzigen 48px Kopfzeile zusammengefasst.
  * Das alte schwebende Bottom-Dock wurde entfernt, wodurch mehr vertikale Bildschirmlänge für die Artikelliste entsteht.
* **Kommissionen (`UnifiedCommissionHeader.tsx`)**:
  * Titel, Status-Tabs (`Aktive`, `Retouren`, `Ausgegeben`, `Papierkorb`), Inline-Suchfeld, Scan-Button, Druck-Warteschlange & "+ Neu"-Button in einer schlanken Kopfzeile konsolidiert.

### Säule 2: Split-View & Direktzugriff (Master-Detail überall)
* Auf Tablets & Desktops bleibt die Hauptliste links immer sichtbar. Rechts öffnet sich der Seitendrawer, der stufenlos in der Breite gezogen werden kann.
* Kein Kontextverlust, schnelle Navigation durch Klick oder Tastatur.

### Säule 3: Globaler Command-Finder (`Strg + K` / `⌘ + K`)
* Ein schlichtes, blitzschnelles Suchfenster erscheint bei `Strg + K` oder Klick auf die Suchleiste.
* Sofortige Ergebnisse für Artikel, Kommissionen, Maschinen & Schlüssel.

### Säule 4: Tablet-First Breakpoints (>= 768px)
* Anhebung der Tablet-Unterstützung: Breakpoint für 2-Spalten-Layout auf `768px` angepasst.

---

## 🚦 Fortschritt & Status

- [x] **Schritt 1**: Einzeilige schlanke Kopfleisten in Lagerbestand & Kommissionen zusammengefasst.
- [ ] **Schritt 2**: Globalen Tastatur-Shortcut (`Strg + K`) für übergreifende Suche einbauen.
- [ ] **Schritt 3**: Breakpoint-Anpassung auf 768px (`md:` für Tablet-Split-View & Sidebar).
