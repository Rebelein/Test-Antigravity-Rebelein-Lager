# Refactoring & Optimization Agenda for AI Coding Agent

This document outlines the systematic code cleanup, performance optimization, dead code removal, and architectural modernization required for this **Vite + React + TypeScript + Supabase + Tailwind CSS** Warehouse & Logistics PWA.

---

## Primary Objectives
1. **Remove Dead & Redundant Code**: Purge temporary scripts, deprecated helper files, and unused fields/imports.
2. **Maximize Mobile & Tablet Performance**: Ensure smooth 60fps interaction on iOS, Android, and Windows tablets by enforcing virtualization and lightweight DOM rendering.
3. **Streamline React Architecture**: Eliminate unnecessary top-level re-renders, standardize state management via TanStack Query, and clean up context providers.
4. **Preserve Full Functionality & VPS/Coolify Workflow**: Maintain all existing PWA capabilities, Supabase edge functions, and zero-downtime deployment compatibility.

---

## Phase 1: Repository Housekeeping & Dead Code Removal

### Task 1.1: Delete Root-Level One-Off & Utility Scripts
- [x] Delete `replace_classes.py`
- [x] Delete `replace_classes2.py`
- [x] Delete `runMigration.js`
- [x] Delete `runMigration.ts`
- [x] Delete `test_machines.js`

### Task 1.2: Dependencies Cleanup (`package.json`)
- [x] Audit `package.json` for unused or redundant packages.
- [x] Clean up Tailwind v4 build dependencies.
- [x] Run `npm prune` / verify lockfile alignment.

### Task 1.3: Data Model Cleanup (`types.ts`)
- [x] Audit `types.ts` for legacy fields:
  - Transitioned from legacy single supplier fields to strict `ArticleSupplier[]` support.
  - Fixed remaining `any` types with strict TypeScript definitions (e.g. `WorkwearOrder.files`).

---

## Phase 2: Performance Optimization & Mobile Refactoring

### Task 2.1: Virtualize All Long Lists (`react-virtuoso`)
- [x] **Inventory List (`src/features/inventory/components/InventoryList.tsx`)**: Utilizes `react-virtuoso` & `GroupedVirtuoso` for smooth scrolling.
- [x] **Commissions List (`src/features/commissions/Commissions.tsx`)**: Optimized list rendering for active, return, and archived commissions.

### Task 2.2: Optimize Mobile UI & GPU Load
- [x] **Glassmorphism / Heavy CSS Filters**: Low performance mode optimizations for lower-end tablet viewports.
- [x] **Barcode Scanning Optimization (`src/components/UnifiedScanner.tsx`)**: Added haptic feedback and frame rate throttling.
- [x] **Haptic Feedback**: Created reusable `triggerHapticFeedback` in `src/utils/haptics.ts` for mobile touch events.

---

## Phase 3: Component & State Architecture Refactoring

### Task 3.1: Provider Tree Optimization (`App.tsx`)
- [x] Memoized all context provider values (`AuthContext`, `UserPreferencesContext`, `ConnectionContext`, `ThemeContext`) using `useMemo` to eliminate cascading top-level re-renders.

### Task 3.2: Eliminate Unnecessary Re-renders
- [x] Ensured heavy sub-components (e.g. `CommissionCard`) are memoized with `React.memo`.

---

## Phase 4: Build Verification & Testing

### Task 4.1: Static Analysis & TypeScript Check
- [x] Ran `npx tsc --noEmit` - **0 type errors**.

### Task 4.2: Production Build & PWA Check
- [x] Ran `npm run build` - **Clean build & PWA service worker generated successfully**.

---

## Dashboard v2 Redesign (Completed)

Full rewrite of the dashboard per `DASHBOARD_REDESIGN_CONCEPT.md`:

- **Removed `react-grid-layout`** (incl. `@types/react-grid-layout` & CSS imports). Replaced by curated CSS-Grid slot layouts per device mode (`smartphone` stack / `tablet_portrait` 2-col / `tablet_landscape` 3-col / `desktop` 12-col) via inline grid styles in `Dashboard.tsx`.
- **Unified tile shell**: `src/features/dashboard/components/DashboardTile.tsx` (header: icon, title, count badge, actions, module link). All 5 tiles refactored to use it.
- **Chat & communication removed**: `useDashboardData` no longer fetches `channels`/`messages` or subscribes to them. DB tables untouched.
- **Tasks tile removed** (follow-up): `TasksTile.tsx` deleted; `tasks`/`subtasks` fetching & realtime removed from `useDashboardData`; task detail view & Tasks-App iframe (`task.rebeleinapp.de`) removed. DB tables untouched. Remaining tiles: quickActions, commissions, machines, keys, events.
- **New `QuickActions` component**: Scanner / Neue Kommission / Inventur / Neuer Artikel + clickable status chips (Büro offen, Rückstand, Defekt, Aufgaben) that scroll to tiles.
- **Layout customization**: `useDashboardLayout` (order/hidden persisted per device group under `dashboard-v2-layout-{smartphone|tablet|desktop}`, legacy keys auto-cleaned) + `DashboardCustomize` (framer-motion `Reorder`, hide/show, reset).
- **Details via `MasterDetailLayout`** (bottom sheet mobile, resizable side panel tablet/desktop). `DashboardDetailPanel.tsx` now exports a pure `DashboardDetailContent` switcher.
- Verified: `npx tsc --noEmit` (0 errors) & `npm run build` (clean, PWA generated).

---
<!-- GOAL_COMPLETE -->
