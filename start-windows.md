# Start Windows - LagerApp Setup

Dieses Dokument beschreibt den Workflow zum Bearbeiten und Starten der LagerApp auf dem Windows-Server.

## Projektübersicht

Die LagerApp ist eine React/TypeScript Web-Anwendung für die Kommissionierung und Lagerverwaltung.

- **Stack:** React 19, TypeScript, Vite, Supabase, TanStack Query, Tailwind CSS, PWA
- **Features:** Dashboard, Inventory, Machines, Orders, Stocktaking, Warehouses, Suppliers, Labels, Commissions, Shelf-Editor, Keys, Workwear, Image-Optimizer
- **Version:** 0.0.92

---

## Dateizugriff (Netzlaufwerk)

Das Projekt liegt auf dem Home-Server und ist in Windows als Netzlaufwerk eingebunden:

```
U:\Lager
```

Alle Änderungen werden direkt auf dem Netzlaufwerk durchgeführt. Git-Operationen (commit, status) funktionieren lokal über das Netzlaufwerk.

---

## SSH Zugriff auf Home Server

Für Befehle auf dem Server (Deploy, Logs, Prozess-Management):

```bash
ssh goe@goe
```

Wichtige Pfade auf dem Server:
- **Aktive App:** `/home/goe/Lager` (läuft auf Port 3003)
- **Beta App:** `/home/goe/Rebelein-Beta-Lager`

Dateien per SCP übertragen:
```bash
# Einzelne Datei kopieren
scp "U:\Lager\src\features\commissions\Commissions.tsx" goe@goe:/home/goe/Lager/src/features/commissions/Commissions.tsx

# Mehrere Dateien kopieren
scp -r "U:\Lager\src\features\commissions" goe@goe:/home/goe/Lager/src/features/
```

---

## Anwendung lokal starten

Die App läuft im Dev-Modus mit Vite und ist über das Netzwerk erreichbar:

### Starten auf dem Server

```bash
ssh goe@goe
cd /home/goe/Lager
npm run dev
```

### Zugriff aus dem Netzwerk

Die App ist unter folgender Adresse erreichbar:

```
http://<SERVER-IP>:3003
```

Beispiel: `http://192.168.178.XX:3003`

> **Hinweis:** Ersetze `<SERVER-IP>` mit der tatsächlichen IP-Adresse des Home-Servers.

---

## Workflow beim Bearbeiten

1. **Datei bearbeiten** auf `U:\Lager` (Netzlaufwerk)
2. **SCP Übertragung** auf den Server:
   ```bash
   scp "U:\Lager\pfad\zur\datei.tsx" goe@goe:/home/goe/Lager/pfad/zur/datei.tsx
   ```
3. **Vite Hot-Reload** erkennt die Änderung automatisch (Dev-Modus)
4. **Browser aktualisieren** falls nötig

---

## Git Workflow

```bash
cd "U:\Lager"

# Status prüfen
git status

# Änderungen hinzufügen
git add .

# Commit erstellen
git commit -m "feat: Beschreibung der Änderung"
```

---

## Nützliche Server-Befehle

```bash
# Vite Prozess finden
ps aux | grep vite

# Port 3003 prüfen
ss -tlnp | grep 3003

# Logs ansehen (wenn vorhanden)
tail -f /home/goe/Lager/logs/*.log
```

---

## Design Standards

- **Modals:** Verwende `GlassModal` Komponente aus `components/UIComponents.tsx`
- **Dark Mode:** Voll unterstützt via Tailwind `dark:` Modifier
- **Mobile First:** Änderungen sollten immer auf Mobile und Desktop getestet werden
- **Breakpoints:** `md:` für Desktop-spezifische Styles
