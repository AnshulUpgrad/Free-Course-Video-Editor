# ⚛️ Frontend Components: Root & Showcase

The core interface between the backend timeline configuration JSON and Remotion is handled by `video/src/Root.tsx` and `video/src/Showcase.tsx`.

---

## 🎛️ Root Configuration: `Root.tsx`

`Root.tsx` defines the composition entry points and structures the input properties.

### 📐 Timeline Format Adapter: `loadTimelineData(props)`
Remotion receives raw input parameters through the `getInputProps()` function. `Root.tsx` calls `loadTimelineData` to standardize inputs before rendering:

- **Audio/Video Resolvers**: If input props are empty, falls back to `timeline.json` default parameters.
- **Timing Normalization**:
  Iterates over the timeline slides array. Snaps the time interval (seconds) to frames based on the 30 fps standard:
  ```typescript
  const startTime = slide.startTime ?? slide.start_time ?? 0;
  const stopTime = slide.stopTime ?? slide.stop_time ?? slide.endTime ?? slide.end_time ?? startTime + 2;
  const durationInFrames = Math.round((stopTime - startTime) * fps);
  ```
- **Data Pruning**:
  Merges top-level slide properties with `slide.data`. Removes any internal time tracking parameters (`startTime`, `stopTime`, etc.) from data sub-objects to prevent child component confusion.

### 🎞️ Showcase Composition Metadata Resolver
The Showcase `<Composition>` definition calculates its total duration dynamically to prevent truncation:
```typescript
calculateMetadata={({ props }) => {
  const resolved = loadTimelineData(props);
  const totalFrames = resolved.timeline ? resolved.timeline.reduce((acc, slide) => acc + (slide.durationInFrames || 0), 0) : 1335;
  return {
    durationInFrames: totalFrames || 1335,
    props: resolved as any,
  };
}}
```

---

## 🎞️ Sequencing Orchestrator: `Showcase.tsx`

`Showcase.tsx` coordinates media track playback and sequences the visual templates.

### 1. Active Render Mode
Determines whether to render solid card backgrounds or overlay panels based on the presence of a speaker video track:
```typescript
const activeRenderMode = videoUrl ? 'overlay' : 'fullscreen';
```

### 2. Media Track Rendering
- **Video Background**: If `videoUrl` is present, renders an `<AbsoluteFill>` containing a full-screen `<OffthreadVideo>` pointing to the resolved static path.
- **Audio Background**: If no video is present, renders a simple background audio element: `<Audio src={resolvedAudioUrl} />`.

### 3. Template Dispatcher
Maps slide `templateId` strings to React components, injecting normalized data:
- `ChapterDivider`
- `ConceptCard`
- `KeywordCard`
- `DefinitionCard`
- `BulletList`
- `StepSequence`
- `ComparisonCard`
- `VisualExplanation`
- `Postcard` (Bullets & Paragraph variants)
- `Takeaways`

### 4. Dynamic Auto-disappear Timing Splitter
For introductory slides (`ChapterDivider`, `ConceptCard`, `KeywordCard`), holding the card on screen for the entire spoken duration would block the speaker's face. 

To solve this, `Showcase.tsx` splits the sequence:
```typescript
const templateDuration = Math.min(slide.durationInFrames, 150); // Cap card display at 5 seconds
const emptyDuration = slide.durationInFrames - templateDuration;

return (
  <Series>
    <Series.Sequence durationInFrames={templateDuration}>
      {renderTemplateOnly(slide.templateId, dataWithMode)}
    </Series.Sequence>
    {emptyDuration > 0 && (
      <Series.Sequence durationInFrames={emptyDuration}>
        <div /> {/* Transparent buffer space */}
      </Series.Sequence>
    )}
  </Series>
);
```

---
- **Next Deep Dive**: [[Templates Deep Dive]]
- **Go Back**: [[Remotion Frontend Engine]] / [[Welcome]]
