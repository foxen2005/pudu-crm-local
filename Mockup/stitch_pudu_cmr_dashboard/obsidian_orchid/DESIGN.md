# Obsidian Orchid Design System

### 1. Overview & Creative North Star
**Creative North Star: The Command Architect**
Obsidian Orchid is a design system built for high-stakes decision-making and operational velocity. It eschews the "friendly" softness of consumer apps in favor of a "Command Center" aesthetic—dense, data-rich, and authoritative. The system breaks the standard grid through **Intentional Asymmetry**: using a heavy 8-column main area balanced against a 4-column contextual rail. It utilizes a "Floating Command" philosophy where the primary user entry point isn't at the top, but anchored at the bottom in a high-contrast, blurred glass bar.

### 2. Colors
The palette is rooted in deep violets and slate neutrals, punctuated by high-signal emergency tones (Orange, Red, Blue) used strictly for actionable status.

*   **The "No-Line" Rule:** Sectioning is achieved through background shifts (e.g., `#f7f6f8` for the canvas vs `#ffffff` for cards). 1px borders are restricted to internal card dividers or subtle sidebar demarcations using `outline-variant`.
*   **Surface Hierarchy & Nesting:** 
    *   **Base:** `surface` (#f7f6f8)
    *   **Level 1 (Cards):** `surface_container` (#ffffff)
    *   **Level 2 (Floating):** `surface_container_low` (White with 70% opacity + 12px blur)
*   **Signature Textures:** Main CTAs utilize a `primary` fill with a 20% opacity shadow of the same hue to create a "glow" effect rather than a traditional grey shadow.

### 3. Typography
The system relies exclusively on **Inter**, utilizing its full weight range to create a hierarchy of urgency.

*   **Display / Hero:** 3rem (48px) Black (900) weight, used for immediate "Today" objectives.
*   **Contextual Headlines:** 1.125rem to 1.5rem Bold, paired with a tracking value of `0.2em` for all-caps subheaders to create an editorial, "ticker-tape" feel.
*   **Micro-Data:** 10px (0.625rem) Bold is used for metadata labels to maintain high information density without cluttering the visual field.
*   **Body:** 0.875rem (14px) for standard readability, maintaining a compact but legible rhythm.

### 4. Elevation & Depth
Elevation in Obsidian Orchid is defined by **Tonal Layering** and aggressive blurs rather than sharp shadows.

*   **The Layering Principle:** Depth is communicated by stacking. The sidebar is flat, the main content is a single step up, and the "Command Bar" sits at the highest Z-index with a `shadow-2xl` equivalent.
*   **Ambient Shadows:** Use the `shadow-lg` (0 10px 15px -3px rgba(0,0,0,0.1)) for standard cards. For primary actions, use a colored shadow: `shadow-primary/20`.
*   **Glassmorphism:** Floating panels (like the Central Command Bar) must use `backdrop-blur-md` (12px) and a semi-transparent white (`rgba(255,255,255,0.7)`) to maintain connection with the underlying data.

### 5. Components
*   **Command Bar:** A floating 3xl rounded input field with an integrated "Terminal" icon and keyboard shortcut hint (`CMD+K`).
*   **Signal Cards:** Border-left weighted cards (4px) in semantic colors (Orange/Red/Blue) to indicate priority levels.
*   **Pill Stats:** Data visualization via vertical bar fragments (4px width) to show weekly trends in a compact footprint.
*   **Glass Buttons:** Secondary actions should use `glass-panel` styling with `primary` text.
*   **Sidebar Nav:** Active states use a 10% opacity tint of the `primary` color with a bold font weight.

### 6. Do's and Don'ts
**Do:**
*   Use uppercase tracking for section headers to create "Command Center" urgency.
*   Use background color shifts to define content zones.
*   Apply high-contrast "Action" buttons (e.g., Orange on Orange-tinted backgrounds) for immediate focus.

**Don't:**
*   Use standard grey shadows; always prefer tonal shadows or no shadows at all.
*   Use rounded corners larger than `0.75rem` for data cards; keep the "Command" feel structured.
*   Avoid using the `primary` color for non-critical elements; reserve it for the "North Star" actions.