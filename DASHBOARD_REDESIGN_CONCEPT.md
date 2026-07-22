# Dashboard Redesign Konzept (v2)

Runderneuertes Dashboard für **Smartphone, Tablet (Portrait/Landscape) und Desktop**.
Ablösung des `react-grid-layout`-Freiform-Rasters durch ein **kuratiertes, geräteoptimiertes Layout** mit einfacher Anpassbarkeit (Reorder + Ein-/Ausblenden).

> Status: **Umgesetzt.** (Verifiziert via `tsc --noEmit` + `npm run build`.)
> Baut auf den Prinzipien aus `UI_UX_Minimalist_Concept.md` auf (hohe Informationsdichte, flache Hierarchie, max. 1 Klick Tiefe, schlanke Kopfzeilen).

> **Nachtrag (nach Umsetzung):** Die Kachel **„Aufgaben" wurde vollständig entfernt** (inkl. Tasks-App-Iframe, Task-Detail, `tasks`/`subtasks`-Fetching und dem „Aufgaben"-Status-Chip) – sie wird nicht mehr benötigt. DB-Tabellen bleiben unangetastet. Übrig sind 5 Kacheln: Schnellaktionen, Kommissionen, Maschinen, Schlüssel, Aktivitäten.

---

## 1. Ziele & Design-Prinzipien

1. **Gerätegerecht statt responsiv-nachträglich**: Das Layout wird pro Device-Mode (`useDeviceMode`: `smartphone` / `tablet_portrait` / `tablet_landscape` / `desktop`) **kuratiert** – nicht mehr per CSS-Breakpoint nachträglich gestapelt.
2. **Handlungsorientiert**: Das Dashboard beantwortet sofort: *„Was muss ich jetzt tun?"* → Schnellaktionen + Handlungsbedarf-Chips haben höchste Priorität.
3. **Alles Relevante bleibt erhalten, alles wird besser**: Alle bestehenden Funktionen (5 Kacheln, Split-Details, Kommission-Erstellen, App-Drawer, Changelog) bleiben – aber in einheitlicher, wartbarer Struktur. **Ausnahme: Chat & Kommunikation entfällt ersatzlos** (wird nicht mehr benötigt).
4. **Einfache Anpassbarkeit**: Kacheln können per Drag **um-sortiert** und **ein-/ausgeblendet** werden (pro Device-Mode gespeichert). Keine freie Größenänderung mehr.
5. **Konsistenz**: Gleiche Patterns wie Inventory/Commissions: `MasterDetailLayout` für Details, einheitliche Kachel-Hülle (`DashboardTile`), `framer-motion` für Animationen.

### Was entfällt (bewusst)

| Alt | Neu / Ersatz |
|---|---|
| `react-grid-layout` (Drag/Resize/Lock pro Kachel, CSS-Imports) | Kuratiertes Grid + `framer-motion` `Reorder` im Anpassen-Modus |
| Kachel-Lock (Lock/Unlock-Icons) | Entfällt – Reorder gibt es nur noch im expliziten „Anpassen"-Modus |
| **Chat & Kommunikation komplett** (Kanäle, Nachrichten, Ungelesen-Logik, Chat-Panel) | Entfällt – wird nicht mehr benötigt. Kachel „Aufgaben & Chat" wird zu **„Aufgaben"** |
| Fullscreen-Kachel-Overlay (Commissions/Tasks) | 1-Klick-Navigation ins Modul + Detail im Seitenpanel |
| Duplizierter Header-Code in jeder Kachel (~40 Zeilen × 5) | Eine `DashboardTile`-Hülle mit einheitlichem Header |
| Eigener Split-View-Code im Dashboard (60/40, Click-Close) | Wiederverwendung von `MasterDetailLayout` (Bottom-Sheet mobil, resizable Side-Panel ab Tablet) |

---

## 2. Kacheln-Inventar (Funktionen bleiben erhalten)

| # | Kachel | Inhalt / Interaktion | Änderungen zu heute |
|---|--------|----------------------|---------------------|
| 0 | **Schnellaktionen** *(NEU)* | Große Touch-Buttons: **Scanner** (→ `/stocktaking`), **Neue Kommission** (Modal), **Inventur** (→ `/audit`), **Neuer Artikel** (→ `/inventory`) | Neu – mobil ganz oben |
| 0b | **Status-Chips** *(NEU, Teil der Schnellaktionen)* | Kompakte, klickbare Zähler: `3 Rückstand` · `2 defekt` · `5 Büro offen` · `4 Aufgaben`. Klick scrollt zur Kachel / öffnet Modul mit Filter | Neu – „Handlungsbedarf auf einen Blick" |
| 1 | **Kommissionen** | Tabs: *Aktion Büro* / *Rückstand* / *Rückgabe* (Tabs jetzt auf **allen** Geräten, nicht nur mobil), „Alle gelesen", „+ Neu", Klick → Detail | Tabs statt 3-Spalten-Zwang; Desktop optional 3 Spalten |
| 2 | **Aufgaben** | Tasks (Status, Subtask-Progress, Collapse) + Link zur Tasks-App (Iframe-Modal). **Chat entfernt.** | Chat-Panel, Kanäle & Ungelesen-Logik gestrichen |
| 3 | **Maschinen** | Verliehen / In Reparatur, Klick → Detail (Verleih/Rückgabe/Defekt) | Unverändert, neue Hülle |
| 4 | **Schlüssel** | In Verwendung, Klick → Rückgabe-Dialog | Unverändert, neue Hülle |
| 5 | **Aktivitäten** | Event-Feed (Maschine/Kommission/Bestellung/Schlüssel) mit Zeitangabe | Unverändert, neue Hülle |

**Bestehende Modals/Panels bleiben:** Kommission-Detail & -Erstellen (`CommissionEditContent`), Maschinen-Detail, Schlüssel-Rückgabe, Task-Detail, Tasks-App-Iframe, Changelog-History, App-Drawer (mit Layout-Reset, SQL-Setup, Seiten-Manager).

---

## 3. Layout pro Gerät

### 3.1 Smartphone (< 768 px) — „Arbeitsmodus"

Einspaltiger Stapel, priorisiert nach Handlungsbedarf. Details öffnen als **Bottom-Sheet** (90 % Höhe, via `MasterDetailLayout`).

```
┌───────────────────────────────────┐
│ Moin, Tim              🔄  ✏️  ⚙️ │  ← Kompakte Toolbar
├───────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐           │
│ │ 📷 Scan │ │ ➕ Kommi│           │  ← Schnellaktionen (2×2-Grid,
│ └─────────┘ └─────────┘           │    große Touch-Targets ≥ 64px)
│ ┌─────────┐ ┌─────────┐           │
│ │ 📋 Inv. │ │ 📦 Artik│           │
│ └─────────┘ └─────────┘           │
│ [3 Rückst.] [2 defekt] [5 Büro] → │  ← Status-Chips (horizontal scrollbar)
├───────────────────────────────────┤
│ 🏭 Kommissionen              (9)  │
│ [Büro 5] [Rückstand 3] [Retoure 1]│  ← Tabs mit Zählern
│ ┌───────────────────────────────┐ │
│ │ ● Bad Müller OG               │ │
│ │   4711 · ⚡ Termin vereinbaren│ │
│ ├───────────────────────────────┤ │
│ │ ● Dach Wagner · Preisanfrage  │ │
│ └───────────────────────────────┘ │
├───────────────────────────────────┤
│ ✓ Aufgaben                   (3)  │
├───────────────────────────────────┤
│ 🔧 Maschinen             2⚙ 1🔧   │
├───────────────────────────────────┤
│ 🔑 Schlüssel                 (1)  │
├───────────────────────────────────┤
│ 📋 Letzte Aktivitäten             │
└───────────────────────────────────┘
```

**Besonderheiten Smartphone:**
- Kachel-Header zeigen **Zähler-Badges** → Zustand erkennbar ohne die Kachel zu öffnen.
- Listen in Kacheln sind auf ~4 Einträge gekürzt, „Alle anzeigen →" navigiert ins Modul.
- Pull-to-Refresh bleibt systemseitig deaktiviert; Refresh über 🔄.

### 3.2 Tablet Portrait (768–1180 px) — 2 Spalten

```
┌─────────────────────────────────────────────────┐
│ Moin, Tim · Di., 21.07.          🔄  ✏️  📜  ⚙️ │
│ [📷 Scan] [➕ Kommi] [📋 Inventur] [📦 Artikel] │  ← Aktionsleiste (1 Zeile)
│ (3 Rückstand) (2 defekt) (5 Büro offen)         │  ← Status-Chips
├──────────────────────┬──────────────────────────┤
│ 🏭 Kommissionen      │ ✓ Aufgaben               │
│ [Büro|Rückst.|Ret.]  │  …                       │
│  …                   │                          │
├──────────────────────┼──────────────────────────┤
│ 🔧 Maschinen         │ 🔑 Schlüssel             │
├──────────────────────┴──────────────────────────┤
│ 📋 Letzte Aktivitäten (volle Breite)            │
└─────────────────────────────────────────────────┘
```

Details öffnen als **resizable Side-Panel** (via `MasterDetailLayout`), Liste bleibt sichtbar.

### 3.3 Tablet Landscape (768–1180 px, quer) — 3 Spalten

```
┌────────────────────────────────────────────────────────────┐
│ Moin, Tim · Di., 21.07.              🔄  ✏️  📜  ⚙️       │
│ [Scan] [+ Kommi] [Inventur] [Artikel]  (3 Rückst.)(2 def.) │
├────────────────────┬───────────────────┬───────────────────┤
│ 🏭 Kommissionen    │ ✓ Aufgaben        │ 🔧 Maschinen      │
│ (Tabs)             │                   ├───────────────────┤
│                    │                   │ 🔑 Schlüssel      │
│                    │                   ├───────────────────┤
│                    │                   │ 📋 Aktivitäten    │
└────────────────────┴───────────────────┴───────────────────┘
```

### 3.4 Desktop (> 1180 px) — 12-Spalten-Raster + Side-Panel

```
┌──────────────────────────────────────────────────────────────────────┐
│ Moin, Tim · Dienstag, 21. Juli 2026            🔄  ✏️  📜  ⚙️       │
│ [📷 Scanner] [➕ Neue Kommission] [📋 Inventur] [📦 Neuer Artikel]  │
│  (5 Büro offen) (3 Rückstand) (2 defekt) (4 Aufgaben)               │
├───────────────────────────────────────┬──────────────────────────────┤
│ 🏭 Kommissionen                (9)    │ ✓ Aufgaben              (3)  │
│ [Aktion Büro 5] [Rückstand 3] [Ret. 1]│──────────────────────────────│
│ ┌────────────┬────────────┬─────────┐ │ 🔧 Maschinen │ 🔑 Schlüssel │
│ │ Büro-Liste │ Rückstand  │ Rückgabe│ │  (2 Spalten nebeneinander)   │
│ │            │            │         │ │──────────────────────────────│
│ └────────────┴────────────┴─────────┘ │ 📋 Letzte Aktivitäten        │
│        (7 Spalten breit)              │        (5 Spalten breit)     │
└───────────────────────────────────────┴──────────────────────────────┘
         ↑ Klick auf Eintrag öffnet Side-Panel rechts (450px, resizable)
```

**Desktop-Besonderheit:** Die Kommissions-Kachel nutzt die Breite für **3 Spalten nebeneinander** (wie heute), Tablet/Smartphone nutzen Tabs mit denselben Inhalten.

---

## 4. Anpassen-Modus (Kuratiert + Reorder)

Aktivierung über **✏️ „Anpassen"** in der Toolbar:

```
┌─────────────────────────────────────────────────┐
│ Anpassen aktiv · [↺ Zurücksetzen] [✓ Fertig]    │
├─────────────────────────────────────────────────┤
│ ⠿ 🏭 Kommissionen                    [👁 sichtbar]│  ← Drag-Handle (framer-motion
│ ⠿ ✓ Aufgaben                         [👁 sichtbar]│    Reorder), Auge toggelt
│ ⠿ 🔧 Maschinen                       [👁 sichtbar]│    Sichtbarkeit
│ ──────────────────────────────────────────────  │
│ Ausgeblendet: [🔑 Schlüssel +]  [📋 Aktivitäten +]│  ← Ein-Klick-Wiederherstellung
└─────────────────────────────────────────────────┘
```

- **Reorder**: `framer-motion` `<Reorder.Group>` – flüssiges Drag&Drop, kein externes Grid nötig.
- **Persistenz pro Device-Mode**: `usePersistentState('dashboard-v2-layout-smartphone' | '-tablet' | '-desktop', { order: string[], hidden: string[] })`.
- **Zurücksetzen** stellt die kuratierte Default-Reihenfolge des Geräts wieder her (ersetzt den alten Layout-Reset im App-Drawer; der Eintrag dort verweist künftig auf diesen Modus).
- Im Normalmodus gibt es **keine** Drag-Handles/Locks → keine versehentlichen Verschiebungen, keine Touch-Konflikte beim Scrollen.

---

## 5. Interaktions- & Detail-Design

| Aktion | Smartphone | Tablet | Desktop |
|---|---|---|---|
| Kommission/Maschine/Schlüssel/Task antippen | Bottom-Sheet (90 %) | Side-Panel (resizable) | Side-Panel (resizable) |
| „+ Neue Kommission" | Fullscreen-Modal | Zentriertes Modal (max-w-5xl) | Zentriertes Modal |
| „Alle gelesen" (Büro) | Button im Tab-Header | Button im Tab-Header | Button in Spalten-Header |
| Tasks-App (Iframe) | Fullscreen-Modal | Fullscreen-Modal | Fullscreen-Modal |
| Zum Modul (↗) | Header-Pfeil | Header-Pfeil | Header-Pfeil |

**Einheitliche Kachel-Hülle (`DashboardTile`):**
```
┌───────────────────────────────────────┐
│ [Icon] Titel            (Badge)  [↗]  │  ← 48px, einheitlich
├───────────────────────────────────────┤
│  Inhalt (scrollt intern)              │
└───────────────────────────────────────┘
```
- Header: Icon + Titel + Zähler-Badge + Modul-Link. Keine weiteren Buttons im Normalmodus.
- Kachel-spezifische Aktionen (+ Neu, Alle gelesen) sitzen **im Inhalts-Header der Kachel**, nicht mehr generisch.

---

## 6. Technische Architektur

### 6.1 Neue/überarbeitete Dateien

```
src/features/dashboard/
├── Dashboard.tsx                      ← schlanker Orchestrator (~200 Zeilen statt 585)
├── hooks/
│   ├── useDashboardData.ts            ← unverändert (Daten + Realtime)
│   └── useDashboardLayout.ts          ← NEU: order/hidden je Device-Mode
├── components/
│   ├── DashboardToolbar.tsx           ← überarbeitet: Begrüßung+Datum, Refresh, Anpassen, Historie, Drawer
│   ├── DashboardTile.tsx              ← NEU: einheitliche Kachel-Hülle
│   ├── QuickActions.tsx               ← NEU: Schnellaktionen + Status-Chips
│   ├── DashboardCustomize.tsx         ← NEU: Anpassen-Modus (Reorder.Group + Ausgeblendet-Leiste)
│   ├── DashboardDetailPanel.tsx       ← Inhalte bleiben, Einbettung via MasterDetailLayout
│   ├── modals/                        ← unverändert (AppDrawer, SqlSetup, PageManager)
│   └── tiles/
│       ├── CommissionsTile.tsx        ← refactored: DashboardTile-Hülle, Tabs auf allen Geräten
│       ├── TasksTile.tsx              ← refactored: DashboardTile-Hülle, **Chat komplett entfernt** (nur Aufgaben)
│       ├── MachinesTile.tsx           ← refactored: DashboardTile-Hülle
│       ├── KeysTile.tsx               ← refactored: DashboardTile-Hülle
│       └── EventsTile.tsx             ← refactored: DashboardTile-Hülle
```

### 6.2 Layout-Engine (statt react-grid-layout)

```ts
// useDashboardLayout.ts – Kachel-Registry
const TILE_REGISTRY = {
  quickActions: { default: true,  devices: 'all' },
  commissions:  { default: true,  devices: 'all' },
  machines:     { default: true,  devices: 'all' },
  keys:         { default: true,  devices: 'all' },
  events:       { default: true,  devices: 'all' },
};

// Default-Reihenfolge je Device-Mode (kuratiert)
const DEFAULT_ORDER = {
  smartphone: ['quickActions','commissions','machines','keys','events'],
  tablet:     ['quickActions','commissions','machines','keys','events'],
  desktop:    ['quickActions','commissions','machines','keys','events'],
};
```

- Das **Grid selbst** ist pro Device-Mode hart kuratiert (CSS-Grid mit `grid-template-areas` bzw. festen Spans) – die Reihenfolge aus `order` bestimmt nur, **welche Kachel in welchem Slot** landet.
- Slots haben feste Größenbeziehungen (z. B. Desktop: Slot A = 7 Spalten, Slots B–D = 5 Spalten). Beim Reorder tauschen Kacheln die Slots → Größen bleiben harmonisch, nie „verrutscht".

### 6.3 Performance & Daten

- `useDashboardData` bleibt inkl. Supabase-Realtime-Subscriptions erhalten – **abzüglich** Chat: `fetchChannelsData` sowie die Realtime-Listener für `messages`/`channels` werden entfernt.
- Alle Kacheln werden `React.memo`-Komponenten; Datenfluss bleibt Props-down.
- `framer-motion` `Reorder` wird **nur im Anpassen-Modus** gemountet → null Overhead im Normalbetrieb.
- Mobile weiterhin `MotionConfig duration: 0` (App-level) → keine Animationslast.

### 6.4 Cleanup nach Umsetzung

- [ ] `react-grid-layout`, `@types/react-grid-layout` aus `package.json` entfernen + `npm prune`
- [ ] CSS-Imports `react-grid-layout/css/styles.css`, `react-resizable/css/styles.css` entfernen
- [x] Chat-Code entfernt: Chat-Panel & Kanal-Logik aus `TasksTile`, `fetchChannelsData`/`dashboardChannels` aus `useDashboardData`, localStorage-Key `channel_read_timestamps`. **DB-Tabellen (`channels`, `messages`, `channel_categories`) bleiben unangetastet** – nur der UI-Code entfällt.
- [x] **Aufgaben-Kachel entfernt** (Nachtrag): `TasksTile.tsx` gelöscht, `tasks`/`subtasks`-Fetching & Realtime aus `useDashboardData` entfernt, Task-Detail & Tasks-App-Iframe gestrichen, „Aufgaben"-Chip entfernt. **DB-Tabellen (`tasks`, `subtasks`) bleiben unangetastet.**
- [x] Alte localStorage-Keys (`dashboard_layouts`, `tasks_tile_split`, `channel_read_timestamps`, `dashboard_collapsed_tasks`) werden beim Laden automatisch bereinigt (neuer Key `dashboard-v2-layout-*`)
- [ ] App-Drawer-Eintrag „Layout zurücksetzen" → öffnet Anpassen-Modus
- [ ] `AGENTS.md` um Dashboard-v2-Abschnitt ergänzen

---

## 7. Umsetzungsplan (Schritte)

1. **Fundament**: `DashboardTile`-Hülle + `useDashboardLayout` (Registry, Persistenz, Reorder-Logik).
2. **QuickActions**: Schnellaktionen + Status-Chips (Daten aus `useDashboardData` ableiten).
3. **Kachel-Refactoring**: Alle 5 Kacheln auf die neue Hülle migrieren (Funktionen 1:1 übernehmen, Tabs für Kommissionen auf allen Geräten, Chat aus Tasks-Kachel entfernen).
4. **Layouts**: Die 4 Device-Grids (CSS-Grid-Slots) + Mapping der Reihenfolge auf Slots.
5. **Anpassen-Modus**: `DashboardCustomize` (Reorder, Ein-/Ausblenden, Zurücksetzen).
6. **Details**: `MasterDetailLayout`-Integration für alle Detail-Views (Bottom-Sheet/Side-Panel).
7. **Toolbar & Drawer**: Toolbar neu, App-Drawer-Einträge verdrahten.
8. **Cleanup & Verifikation**: Deps entfernen, `npx tsc --noEmit`, `npm run build`, manueller Test der 3 Device-Modi (via Device-Override in der App).

---

## 8. Offene Punkte / Entscheidungen bei Umsetzung

- **Status-Chips**: Start mit 4 Chips aus vorhandenen Daten (Büro offen, Rückstand, defekt, Aufgaben). Erweiterbar.
- **Changelog-History** bleibt über 📜 in der Toolbar erreichbar; der fest codierte Versions-Badge (`v0.0.70`) wird durch `APP_VERSION` aus `vite.config.ts` ersetzt.
- **Tasks-App-Iframe** (`task.rebeleinapp.de`): Der „App öffnen"-Link bleibt vorerst in der Aufgaben-Kachel. Falls die externe Tasks-App ebenfalls abgeschafft wird, kann der Link später ersatzlos gestrichen werden.
