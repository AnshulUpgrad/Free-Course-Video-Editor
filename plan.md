# plan.md

# UpGrad-Style Educational Video Template System (V1)

---

# Project Objective

Build a reusable library of premium educational video templates inspired by UpGrad-style learning content.

The goal of this phase is NOT to build:

* AI planning
* Transcript analysis
* Video automation
* Timeline generation

The sole objective is to create a production-ready template library that can later be driven by AI.

Success for this phase means:

> A designer or developer can manually provide data to any template and produce a video segment that looks like it belongs in a premium online course.

---

# Design Philosophy

The visual language should feel:

* Premium
* Corporate
* Educational
* Structured
* Modern
* Minimal

The design should resemble:

* UpGrad
* Coursera
* Enterprise training platforms
* MBA coursework
* Consulting presentations

Avoid:

* TikTok aesthetics
* Creator-style editing
* Excessive motion graphics
* Flashy transitions
* Meme-style visual language

The objective is comprehension, not entertainment.

---

# Technical Goal

Create 10 reusable templates.

Each template should:

* Be implemented as a Remotion component
* Be completely data-driven
* Support dynamic content
* Handle variable text lengths
* Support entry and exit animations
* Follow a shared design system

Directory structure:

templates/

```
ChapterDivider/

ConceptCard/

KeywordCard/

DefinitionCard/

BulletList/

StepSequence/

ProcessFlow/

ComparisonCard/

VisualExplanation/

Takeaways/
```

---

# Design System

## Brand Colors

Primary Brand Color

```css
#EF2C3C
```

Use for:

* Highlights
* Underlines
* Connectors
* Dividers
* Accent elements
* Important labels

---

Secondary Red

```css
#D61F31
```

Use for:

* Secondary emphasis
* Hover variants
* Alternate accents

---

Dark Background

```css
#111827
```

Use for:

* Chapter transitions
* Concept introductions
* Question screens

---

Light Background

```css
#F8F9FB
```

Use for:

* Lists
* Diagrams
* Information-heavy layouts

---

Primary Text

```css
#1F2937
```

---

Secondary Text

```css
#6B7280
```

---

White

```css
#FFFFFF
```

---

# Typography

Primary Font

```text
Inter
```

Fallback

```text
Manrope
```

---

## Font Scale

```yaml
H1:
  size: 72px
  weight: 700

H2:
  size: 56px
  weight: 700

Body:
  size: 32px
  weight: 500

Caption:
  size: 24px
  weight: 400
```

---

# Layout Rules

Canvas

```yaml
width: 1920
height: 1080
ratio: 16:9
```

Safe Margins

```yaml
left: 120px
right: 120px
top: 100px
bottom: 100px
```

No content should cross safe margins.

## Layout Constraints for Specialized Templates

### Half Screen Templates
- **Constraint**: Must always cover the **right half** of the screen.
- **Positioning**: Bound to `x: 960px` to `x: 1920px` (occupying the right 50% of the canvas), aligned with safe margin constraints on the right, top, and bottom.

### Corner Box Templates
- **Constraint**: Must appear at the **bottom right** of the video canvas.
- **Positioning**: Positioned in the bottom-right quadrant, adhering to safe margins (`right: 120px`, `bottom: 100px`).


---

# Animation System

Allowed Animations

```yaml
fade
slide_up
slide_left
scale
stagger_reveal
line_draw
counter
highlight
```

Forbidden Animations

```yaml
bounce
elastic
spin
flash
shake
glitch
```

Animation Duration

```yaml
300ms - 600ms
```

Animation style should always feel subtle and professional.

---

# TEMPLATE 01

# Chapter Divider

Purpose

Used when transitioning between major sections.

Example

MODULE 3

Retrieval Systems

Layout

* Full-screen
* Dark background
* Red divider line
* White title
* Red module label

Animation

* Divider line draw
* Module label fade
* Title fade

Duration

2-3 seconds

Input

```ts
{
  module: string;
  title: string;
}
```

---

# TEMPLATE 02

# Concept Card

Purpose

Introduce a major concept.

Example

Retrieval-Augmented Generation

Layout

* Center aligned
* Large typography
* Dark background
* Small red accent line

Animation

* Fade in
* Scale from 97% to 100%

Duration

2-4 seconds

Input

```ts
{
  concept: string;
}
```

---

# TEMPLATE 03

# Keyword Card

Purpose

Maximum emphasis for a critical term.

Example

EMBEDDINGS

Layout

* Large centered typography
* Red underline
* Dark background

Animation

* Scale pop
* Underline draw

Duration

1-3 seconds

Input

```ts
{
  keyword: string;
}
```

This will likely become the most frequently used template.

---

# TEMPLATE 04

# Definition Card

Purpose

Display formal definitions.

Example

Embedding

A numerical representation that captures semantic meaning.

Layout

* White card
* Left red accent bar
* Large term
* Definition below

Animation

* Accent bar reveal
* Term fade
* Definition fade

Input

```ts
{
  term: string;
  definition: string;
}
```

---

# TEMPLATE 05

# Bullet List

Purpose

Display enumerations.

Examples

* Benefits
* Features
* Categories
* Advantages
* Disadvantages

Layout

* Title
* Up to six bullets
* Red bullet markers

Animation

* Stagger reveal

Input

```ts
{
  title: string;
  items: string[];
}
```

Maximum

```yaml
6 bullets
```

---

# TEMPLATE 06

# Step Sequence

Purpose

Display ordered procedures.

Example

1. Chunk Data

2. Generate Embeddings

3. Retrieve Context

4. Generate Answer

Layout

* Vertical sequence
* Red numbered circles
* Large step labels

Animation

* Sequential highlight
* Step reveal

Input

```ts
{
  steps: string[];
}
```

Maximum

```yaml
8 steps
```

---

# TEMPLATE 07

# Process Flow

Purpose

Display workflows and system architecture.

Example

Documents

↓

Embeddings

↓

Vector Database

↓

Retriever

↓

LLM

Layout

* White rounded cards
* Red connectors
* Vertical flow

Animation

* Node reveal
* Connector draw

Input

```ts
{
  nodes: string[];
}
```

Maximum

```yaml
8 nodes
```

This is expected to be the highest-value educational template.

---

# TEMPLATE 08

# Comparison Card

Purpose

Compare two concepts.

Examples

* Traditional Search vs RAG
* SQL vs NoSQL
* Supervised vs Unsupervised

Layout

* Two-column layout
* Red divider
* Red headers

Animation

* Row-by-row reveal

Input

```ts
{
  leftTitle: string;
  rightTitle: string;
  rows: [string,string][];
}
```

Maximum

```yaml
6 rows
```

---

# TEMPLATE 09

# Visual Explanation

Purpose

Display supporting visuals.

Supported Content

* Images
* Screenshots
* Charts
* Diagrams
* Architecture graphics

Layout

* Visual occupies approximately 80%
* Caption occupies approximately 20%

Animation

* Subtle zoom
* Caption fade

Input

```ts
{
  image: string;
  caption: string;
}
```

This template will later integrate with image retrieval and diagram generation systems.

---

# TEMPLATE 10

# Takeaways

Purpose

Display summaries and key lessons.

Example

KEY TAKEAWAYS

✓ Retrieval adds context

✓ Context improves accuracy

✓ Sources improve trust

Layout

* Red title
* Red checkmarks
* White background

Animation

* Sequential reveal

Input

```ts
{
  title: string;
  points: string[];
}
```

Maximum

```yaml
6 points
```

Variants

* Takeaways
* Important Note
* Recap

---

# Shared Component Requirements

Every template must support:

```ts
interface TemplateProps {
  data: unknown;
}
```

Every template must include:

* Entry animation
* Exit animation
* Responsive text scaling
* Overflow handling
* Safe-area compliance
* Brand-consistent styling

---

# Build Order

Templates should be built in the following order:

1. Keyword Card
2. Bullet List
3. Definition Card
4. Concept Card
5. Takeaways
6. Step Sequence
7. Comparison Card
8. Process Flow
9. Chapter Divider
10. Visual Explanation

This order prioritizes the templates most likely to appear in educational content.

---

# Deliverable

At the end of this phase there should be:

* 10 completed Remotion templates
* Shared design token system
* Shared animation library
* Template showcase video demonstrating every template
* Consistent UpGrad-style branding across all components

No AI integration should be attempted until the showcase video reaches production quality.
