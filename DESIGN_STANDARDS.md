# Design Standards: Modals

This document outlines the standard design pattern for modals in the Rebelein LagerApp.

## GlassModal Component

We have established a reusable `GlassModal` component in `components/UIComponents.tsx` that enforces the consistent look and feel.

### Usage

```tsx
import { GlassModal } from './components/UIComponents';

<GlassModal isOpen={isOpen} onClose={onClose}>
    {/* Header */}
    <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-start">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Title</h2>
        <button onClick={onClose}>
            <X size={24} />
        </button>
    </div>

    {/* Content (Scrollable) */}
    <div className="p-6 overflow-y-auto space-y-6">
        {/* Your content here */}
    </div>

    {/* Footer (Optional) */}
    <div className="p-6 pt-0 flex justify-end">
        <Button onClick={onSave}>Save</Button>
    </div>
</GlassModal>
```

### Design Specs

*   **Overlay:** `fixed inset-0 z-[150] bg-black/40 backdrop-blur-md`
*   **Animation:** `animate-in fade-in duration-200` (Overlay), `zoom-in-95 duration-200` (Content)
*   **Container:** `GlassCard` (Standard: `bg-white/80 dark:bg-white/10 backdrop-blur-lg`) with `p-0` override for layout control.
*   **Borders:** `border-gray-200 dark:border-white/10`
*   **Shadows:** `shadow-2xl`

### Key Principles

1.  **Consistency:** Always use `GlassModal` for new modals.
2.  **Responsiveness:** The modal is centered and has a `max-w-2xl` by default, but adapts to screen size.
3.  **Dark Mode:** Fully supported via Tailwind's `dark:` modifiers.
4.  **Interaction:** Close buttons should be clearly visible. Actions (Save/Edit) should be placed in the footer area or top right depending on context, but footer is preferred for primary actions.
