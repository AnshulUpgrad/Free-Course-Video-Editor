# Project Rules & Guidelines

## Template Constraints

### 1. Half-Screen Templates
- **Constraint**: Must always cover the **right half** of the screen.
- **Implementation**:
  - The template container must occupy `width: 50%` or be positioned between `x: 960px` and `x: 1920px`.
  - Maintain the project's standard top, bottom, and right safe margin padding inside the right half container (i.e., top: 100px, bottom: 100px, right: 120px).
  - The left 50% (`x: 0` to `x: 960px`) must remain transparent or empty to allow the main presentation/video track to show through.

### 2. Corner Box Templates
- **Constraint**: Must appear at the **bottom right** of the video canvas.
- **Implementation**:
  - Positioned within the bottom-right quadrant.
  - Must respect standard right and bottom safe margins: `right: 120px`, `bottom: 100px`.
  - Must not overlap or shift outside the designated safe area bounds unless explicitly instructed.
