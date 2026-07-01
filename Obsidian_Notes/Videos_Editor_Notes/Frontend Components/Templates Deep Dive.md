# ⚛️ Frontend Components: Templates Deep Dive

This note provides a detailed structural breakdown of the **11 individual layout templates** in `video/src/templates/`.

---

## 🎨 Design Tokens & Shared Animation Hooks

Every template makes use of standard CSS styling variables and Remotion math helpers:
- **`COLORS`**: Red (`#EF2C3C`), Dark (`#111827`), Light (`#F8F9FB`), Primary Text (`#1F2937`), Secondary Text (`#6B7280`).
- **`TYPOGRAPHY`**: Google Font **Lato** family configurations.
- **`useTransitionProgress()`**: Returns `entryProgress` (entry transition progress), `exitProgress` (exit transition progress), and `combined` progress (combining both).
- **`useSlideLeftTransition(distance)`**: Computes slide left transforms based on interpolation.

---

## 🔎 Component Specifications

### 1. `ChapterDivider`
- **Path**: `video/src/templates/ChapterDivider/index.tsx`
- **Layout**: Full-Screen. Dark background (`#111827`).
- **Visual Elements**:
  - Module label: Red background, white text.
  - Horizontal separator line: Solid red line that draws in.
  - Title: Large white centered header text.
- **Animations**:
  - Horizontal red divider: Width interpolates from `0%` to `100%`.
  - Module & Title texts: Opacity fades in.

### 2. `ConceptCard`
- **Path**: `video/src/templates/ConceptCard/index.tsx`
- **Layout**: Centered Full-Screen. Dark background.
- **Visual Elements**:
  - A small vertical or horizontal red accent line.
  - Concept name text: Bold white header.
- **Animations**:
  - Opacity fade in.
  - Subtle scale transition from `97%` to `100%`.

### 3. `KeywordCard`
- **Path**: `video/src/templates/KeywordCard/index.tsx`
- **Layout**: Centered Full-Screen. Dark background.
- **Visual Elements**:
  - Large focused keyword text (red).
  - Thick red draw-in accent outline box surrounding the text.
- **Animations**:
  - Accent box border draw-in.
  - Text scale-up pop.

### 4. `DefinitionCard`
- **Path**: `video/src/templates/DefinitionCard/index.tsx`
- **Layout**: Dynamic:
  - **Short Layout ($\le 20$ words)**: Renders as a floating **Corner-Box** in the bottom-right quadrant.
  - **Long Layout ($> 20$ words)**: Renders as a **Half-Screen** panel on the right side.
- **Visual Elements**:
  - Red background panel.
  - Thick white border on the left side (`borderLeft: 8px solid white` or `10px solid white`).
  - Term: Bold title text (white).
  - Definition: Regular body text (white).
- **Animations**:
  - Corner-Box: Slid up vertically using `translateYOffset` and faded.
  - Half-Screen Panel: Slid in from the right edge of the screen.

### 5. `BulletList`
- **Path**: `video/src/templates/BulletList/index.tsx`
- **Layout**: Configurable: Full-Screen or Half-Screen.
- **Visual Elements**:
  - List Title (red).
  - Bullet elements: Left red indicator markers, primary text items.
- **Animations**:
  - Bullet items: Faded in sequentially using a stagger delay.

### 6. `StepSequence`
- **Path**: `video/src/templates/StepSequence/index.tsx`
- **Layout**: Configurable: Full-Screen or Half-Screen.
- **Visual Elements**:
  - List Title.
  - List elements: Red numbered circles containing step numbers, step text blocks.
- **Animations**:
  - Step rows: Faded in sequentially with a stagger delay.

### 7. `ComparisonCard`
- **Path**: `video/src/templates/ComparisonCard/index.tsx`
- **Layout**: Full-Screen.
- **Visual Elements**:
  - Two-column comparison layout.
  - Header: Left title vs. right title.
  - Rows: Alternating shaded rows for readability.
- **Animations**:
  - Table columns: Split slides in from left/right.
  - Row lines: Faded in sequentially.

### 8. `VisualExplanation`
- **Path**: `video/src/templates/VisualExplanation/index.tsx`
- **Layout**: Full-Screen.
- **Visual Elements**:
  - Flow Chart: Renders a vertical path of process blocks connected by red arrows.
  - Bottom Caption box.
- **Animations**:
  - Flow blocks: Faded in sequentially.
  - Connector arrows: Height draws down.

### 9. `Postcard`
- **Path**: `video/src/templates/Postcard/index.tsx`
- **Layout**: Full-Screen split.
- **Visual Elements**:
  - Left panel: Image/Diagram (resolved via `staticFile`).
  - Right panel: Title and content.
  - Content Variants:
    - **`bullets`**: Rendered list.
    - **`paragraph`**: Descriptive text paragraph.
- **Animations**:
  - Split layout: Image fades on the left, text slides in on the right.

### 10. `Takeaways`
- **Path**: `video/src/templates/Takeaways/index.tsx`
- **Layout**: Configurable: Full-Screen or Half-Screen.
- **Visual Elements**:
  - Title (red).
  - List elements: Checkmark bullet markers (green or red checkmarks), takeaway text blocks.
- **Animations**:
  - Staggered items fade-in.

---
- **Go Back**: [[Remotion Frontend Engine]] / [[Welcome]]
