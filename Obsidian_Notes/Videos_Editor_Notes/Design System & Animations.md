# 📐 Design System & Animations

All templates conform to a standardized visual token system defining colors, font scales, safe zones, and professional transitions.

---

## 🎨 Color Tokens (`tokens.ts`)

The project uses the following UpGrad-branded color palette:
- **UpGrad Red (Primary Accent)**: `rgb(238, 37, 54)` or `#EF2C3C`. Used for highlights, underlines, borders, and main cards.
- **Secondary Red**: `#D61F31`. Used for secondary emphasis.
- **Dark Background**: `#111827`. Used as the canvas fill in fullscreen transitions.
- **Light Background**: `#F8F9FB`. Used for dense data tables and diagrams.
- **Primary Text**: `#1F2937` (Charcoal).
- **Secondary Text**: `#6B7280` (Muted Grey).
- **White**: `#FFFFFF`.

---

## 🔤 Typography & Font Scale

- **Primary Font**: **Lato** (imported globally via Google Fonts in `global.css`).
- **Secondary/Fallback Font**: **Inter** or **Manrope**.

| Token | CSS Font Size | CSS Font Weight | Primary Usage |
| :--- | :--- | :--- | :--- |
| **H1** | `72px` | `700` (Bold) | Main slide headers / Chapter titles |
| **H2** | `56px` | `700` (Bold) | Card titles / Term titles |
| **Body** | `32px` | `500` (Medium) | Bullet text / Descriptions |
| **Caption** | `24px` | `400` (Regular) | Figure captions |

---

## 📐 Layout Constraints & Safe Areas

To maintain readability and prevent video track obstruction, layouts adhere to strict safe margin boundaries.

### Safe Margins
- **Left Margin**: `120px`
- **Right Margin**: `120px`
- **Top Margin**: `100px`
- **Bottom Margin**: `100px`

```
+-------------------------------------------------------------+
|                        Top: 100px                           |
|      +-----------------------------------------------+      |
|      |                                               |      |
| Left |                                               | Right|
|120px |                                               |120px |
|      |                                               |      |
|      +-----------------------------------------------+      |
|                      Bottom: 100px                          |
+-------------------------------------------------------------+
```

### Constraint Rules (Required by AGENTS.md)
1. **Half-Screen Templates**: Must cover the **right half** of the screen (`x: 960px` to `x: 1920px`, `width: 960px`). Left 50% must remain transparent or empty to allow the main presentation/video track to show through. Maintain the right, top, and bottom safe margin offsets inside the panel container.
2. **Corner-Box Templates**: Must appear in the **bottom-right quadrant**. Respect standard right and bottom safe margins: `right: 120px`, `bottom: 100px`. Do not shift or overlap outside these boundaries.

---

## 🎬 Animation System

Transitions and entry animations are kept subtle to ensure an academic and professional aesthetic.

### Entry & Exit Transitions (`transitions.ts`)
The templates use linear interpolations based on the frame sequence index. Common hooks include:
- **`useTransitionProgress()`**: Returns `entryProgress` and `exitProgress` scaled between `0` and `1`.
- **`useSlideLeftTransition(distance)`**: Calculates sliding offset animations for right-half panels.

### Allowed Animations
- `fade` (opacity controls)
- `slide_up` / `slide_left` (gentle shifts)
- `scale` (pop from 97% to 100%)
- `stagger_reveal` (sequential bullets)
- `line_draw` (borders drawing in)

### Forbidden Animations
- `bounce`
- `elastic`
- `spin`
- `flash`
- `shake`
- `glitch`

*Note: The duration for standard animations should remain between **300ms** and **600ms**.*

---

## 🔗 Related Notes
- Go back to [[Welcome]].
- Explore [[Visual Layout Templates]] to see how templates implement these rules.
