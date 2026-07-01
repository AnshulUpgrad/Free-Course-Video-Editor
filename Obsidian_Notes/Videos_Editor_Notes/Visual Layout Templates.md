# 🎨 Visual Layout Templates

The editor contains **11 visual templates** inside `video/src/templates/`. These are data-driven overlay cards built to fit UpGrad's corporate design.

---

## 📐 Template Categorization & Layout Formats

1. **Full-Screen Layouts**: Covers the entire 1920x1080 canvas. Backgrounds are solid in standalone/fullscreen mode and transparent in overlay mode.
2. **Half-Screen Layouts**: Occupies the **right half** of the screen (`x: 960px` to `x: 1920px`, `width: 960px`). Left side remains transparent to show the speaker. Uses a solid red panel, a `10px solid white` left border, and white typography.
3. **Corner-Box Layouts**: Appears in the **bottom-right quadrant** of the screen. Standard safe margins (`right: 120px`, `bottom: 100px`, `width: 920px`, `minHeight: 320px`). Includes a solid red background and a `8px solid white` left border.

---

## 🔍 Detailed Specifications & Schemas

### 1. `ChapterDivider`
- **Use Case**: Section intro transition.
- **Format**: Full-Screen
- **Schema**:
  ```json
  {
    "module": "MODULE 01",
    "title": "Introduction to Neural Networks"
  }
  ```

### 2. `ConceptCard`
- **Use Case**: Introduces a core concept.
- **Format**: Centered Full-Screen
- **Schema**:
  ```json
  {
    "concept": "Retrieval-Augmented Generation"
  }
  ```

### 3. `KeywordCard`
- **Use Case**: Highlights a single high-impact term.
- **Format**: Centered Full-Screen
- **Schema**:
  ```json
  {
    "keyword": "Embeddings"
  }
  ```

### 4. `DefinitionCard`
- **Use Case**: Displays terms and definitions.
- **Dynamic Layout Rules**:
  - If the definition is **$\le 20$ words**, it renders as a **Corner-Box**.
  - If the definition is **$> 20$ words**, it renders as a **Half-Screen** panel.
- **Schema**:
  ```json
  {
    "term": "Cosine Similarity",
    "definition": "A metric used to measure vector distance..."
  }
  ```

### 5. `BulletList`
- **Use Case**: Enumerations (categories, benefits, lists).
- **Format**: Configurable: `"fullscreen"` or `"halfscreen"`.
- **Schema**:
  ```json
  {
    "title": "Benefits of Vector Embeddings",
    "items": ["Point 1", "Point 2", "Point 3"],
    "layout": "fullscreen"
  }
  ```

### 6. `StepSequence`
- **Use Case**: Numbered step procedures.
- **Format**: Configurable: `"fullscreen"` or `"halfscreen"`.
- **Schema**:
  ```json
  {
    "title": "RAG Pipeline Steps",
    "steps": ["Step 1 description", "Step 2 description"],
    "layout": "fullscreen"
  }
  ```

### 7. `ComparisonCard`
- **Use Case**: Side-by-side comparison tables.
- **Format**: Full-Screen (with alternating grid row colors).
- **Schema**:
  ```json
  {
    "title": "A vs B",
    "leftTitle": "System A",
    "rightTitle": "System B",
    "rows": [
      ["Row 1 Left", "Row 1 Right"],
      ["Row 2 Left", "Row 2 Right"]
    ]
  }
  ```

### 8. `VisualExplanation`
- **Use Case**: Displays flowcharts and diagrams.
- **Format**: Full-Screen
- **Schema**:
  ```json
  {
    "nodes": ["Load Data", "Process", "Save"],
    "caption": "Figure 1.1: Standard ETL Pipeline"
  }
  ```

### 9. `Postcard` (`PostcardBullets` or `PostcardParagraph`)
- **Use Case**: Split card featuring a diagram/image on the left and bullet points or text on the right.
- **Format**: Full-Screen
- **Timing & Resolution**: Resolves relative images via `staticFile` (looks in `video/public/`).
- **Schema (Bullets Variant)**:
  ```json
  {
    "image": "image.png",
    "variant": "bullets",
    "title": "Topic Title",
    "bullets": ["Bullet points here..."]
  }
  ```
- **Schema (Paragraph Variant)**:
  ```json
  {
    "image": "image.png",
    "variant": "paragraph",
    "title": "Topic Title",
    "paragraph": "Descriptive text paragraph goes here..."
  }
  ```

### 10. `Takeaways`
- **Use Case**: Closing summary slides.
- **Format**: Configurable: `"fullscreen"` or `"halfscreen"`.
- **Schema**:
  ```json
  {
    "title": "Key Takeaways",
    "points": ["Takeaway 1", "Takeaway 2"],
    "layout": "fullscreen"
  }
  ```

---

## 🔗 Related Notes
- Go back to [[Welcome]].
- Explore [[Remotion Frontend Engine]] to see layout styling implementations.
- Read [[Design System & Animations]] to review layout constraints and CSS classes.
