# Project Handover Context

We are pair-programming on a Remotion video editing project, introducing new screen overlay layouts (Half-Screen and Corner-Box templates) to replace full-screen layouts.

---

## 1. Core Layout Constraints & Rules

1. **Half-Screen Templates**:
   - Must always occupy the **right half** of the screen (`width: 960px`, `right: 0`).
   - Solid panel background is **Upgrad Red** (`rgb(238, 37, 54)`), with white left vertical borders (`10px solid`) and all-white text.
2. **Corner-Box Templates**:
   - Must be **right-center aligned** (`right: 120px`, `top: 50%`, `transform: translateY(-50%)`).
   - Sizing: Spatially expanded (e.g. `width: 920px`, `minHeight: 320px`) with high contrast text.
   - Solid panel background is **Upgrad Red** (`rgb(238, 37, 54)`), with white left border (`8px solid`) and all-white text.

---

## 2. Design System Tokens

- **Font Family**: Google Font **Lato** is loaded and used globally for all text.
- **Brand Color**: **Upgrad Red** is strictly defined as **`rgb(238, 37, 54)`** and mapped to `COLORS.primary`, `COLORS.secondaryRed`, and `COLORS.upgradRed` centrally.
- **Overlay Rendering**: Showcase is configured to automatically supply `overlay` mode if a background video is present, rendering card backdrops transparently.

---

## 3. Key Files

- [tokens.ts](file:///c:/Work%20Stuf/Prototypes/Free_Course_Video_AI_Editor/video/src/design-system/tokens.ts) — Global layout coordinates and brand color tokens.
- [global.css](file:///c:/Work%20Stuf/Prototypes/Free_Course_Video_AI_Editor/video/src/design-system/global.css) — Lato font imports and base typographic definitions.
- [Root.tsx](file:///c:/Work%20Stuf/Prototypes/Free_Course_Video_AI_Editor/video/src/Root.tsx) — Main Composition configurations, default timeline data, and showcase parameters.
- [Showcase.tsx](file:///c:/Work%20Stuf/Prototypes/Free_Course_Video_AI_Editor/video/src/Showcase.tsx) — Handles video playback and controls which templates overlay on top.
- `src/templates/` — Individual slide designs:
  - [DefinitionCard/index.tsx](file:///c:/Work%20Stuf/Prototypes/Free_Course_Video_AI_Editor/video/src/templates/DefinitionCard/index.tsx) (Supports Corner Box for $\le 15$ words; Half-Screen for $> 15$ words; removed old full-screen card).
  - [BulletList/index.tsx](file:///c:/Work%20Stuf/Prototypes/Free_Course_Video_AI_Editor/video/src/templates/BulletList/index.tsx) (Supports Full-Screen and Half-Screen layout variants; uppercase title formatting).

---

## 4. Current State

- The local Remotion Studio dev server is running at **`http://localhost:3000`**.
- Input samples for active templates are stored in the [temp_inputs_samples/](file:///c:/Work%20Stuf/Prototypes/Free_Course_Video_AI_Editor/video/temp_inputs_samples/) folder.
- Compilation is completely clean (verified with `npx tsc --noEmit`).
