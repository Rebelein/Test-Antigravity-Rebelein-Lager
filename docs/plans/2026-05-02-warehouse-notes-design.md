# Design Document: Warehouse Notes for Commissions

## Overview
This document outlines the implementation plan for adding a dedicated "Warehouse Notes" (Informationen ans Lager) field to the Commissions feature. This separates general commission/site notes from specific instructions intended solely for the warehouse staff (pickers), reducing errors and improving communication.

## 1. Database Changes
*   **Table:** `commissions`
*   **New Column:** Add a new text column named `warehouse_notes` (type: `text`, nullable).
*   **Supabase Migration:** A SQL migration script will be needed to add this column to the production database.

## 2. Data Model & Types
*   **File:** `src/types.ts`
*   **Change:** Extend the `Commission` interface to include the new field.
    ```typescript
    export interface Commission {
      // ... existing fields
      warehouse_notes?: string; // NEW: Specific notes for warehouse staff
    }
    ```

## 3. UI Changes (Creation & Editing)
*   **File:** `src/features/commissions/components/CommissionEditContent.tsx`
*   **Change:** Add a new textarea input field for `warehouse_notes`.
*   **Placement:** Directly below the existing "Allgemeine Notizen / Baustellen-Infos" field.
*   **Styling:** Give it a slightly different visual weight (e.g., a subtle amber tint or specific icon) to distinguish it from general notes, along with a helper text indicating that this will be printed prominently on the label.

## 4. UI Changes (Dashboard & List View)
*   **File:** `src/features/commissions/components/CommissionCard.tsx`
*   **Change:** If `warehouse_notes` is present, display a prominent banner on the card.
*   **Styling:** 
    *   Background: Amber/Yellow tint (`bg-amber-500/10` or similar).
    *   Border: Subtle amber border.
    *   Icon: AlertTriangle (`⚠️`) or Info icon.
    *   Content: Directly render the text within the banner so it cannot be missed when scrolling.

## 5. PDF Label Generation (Print)
*   **File:** `src/features/commissions/Commissions.tsx` (in the `generateBatchPDF` function).
*   **Change:** Inject the `warehouse_notes` into the HTML template used for printing.
*   **Placement:** Directly below the fold line (`<div class="fold-line">...</div>`) and before the article list (`<div class="list-title">...</div>`).
*   **Styling:** Wrap the text in a highlighted `<div>` with an inline style (e.g., amber background, bold prefix) to ensure it stands out on the printed black-and-white A6 paper.

## 6. Implementation Steps
1.  Apply Supabase SQL migration to add the `warehouse_notes` column.
2.  Update the frontend `types.ts`.
3.  Update the `CommissionEditContent.tsx` form.
4.  Update the `CommissionCard.tsx` component.
5.  Update the PDF generation logic in `Commissions.tsx`.
6.  Test the flow from creation to display to printing.
