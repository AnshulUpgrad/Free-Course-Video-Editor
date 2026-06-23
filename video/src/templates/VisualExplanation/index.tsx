import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, TYPOGRAPHY, LAYOUT } from '../../design-system/tokens';
import { useTransitionProgress } from '../../design-system/transitions';

export interface VisualExplanationData {
  image?: string; // Optional image URL
  nodes?: string[]; // Optional custom nodes for vertical process diagram
  caption: string;
  renderMode?: 'fullscreen' | 'overlay' | 'picture-in-picture';
}

// A beautiful default vector/RAG architecture SVG diagram to render when no image is provided.
// Designed vertically with boxes and arrows pointing down, with each box supporting max 5 words.
// Automatically scrolls/pushes steps in a queue-like fashion if more than 3 steps are provided.
const DefaultDiagram: React.FC<{ nodes?: string[] }> = ({ nodes: propNodes }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { exitProgress } = useTransitionProgress();

  const defaultNodes = [
    'RAW DOCUMENTS & DATA SOURCES',
    'EMBEDDING API GENERATION PIPELINE',
    'VECTOR DATABASE SEMANTIC STORAGE'
  ];
  const nodes = propNodes && propNodes.length > 0 ? propNodes : defaultNodes;

  const totalNodes = nodes.length;
  const numTransitions = Math.max(0, totalNodes - 3);

  // Transition parameters
  const scrollStartFrame = 35;
  const scrollEndFrame = durationInFrames - 15;
  const scrollDuration = scrollEndFrame - scrollStartFrame;
  const framesPerShift = numTransitions > 0 ? scrollDuration / numTransitions : 0;
  
  // Calculate shift and hold duration based on framesPerShift.
  // Prioritize a 1.5-second hold (45 frames) and a 15-frame transition.
  // If the timeline is too tight, allocate 25% of the shift window for transition and 75% for hold.
  const shiftDuration = numTransitions > 0
    ? (framesPerShift >= 60 ? 15 : Math.max(5, framesPerShift * 0.25))
    : 0;

  let scrollProgress = 0;
  if (numTransitions > 0 && framesPerShift > 0) {
    for (let t = 0; t < numTransitions; t++) {
      const shiftStart = scrollStartFrame + t * framesPerShift;
      const shiftProgress = interpolate(
        frame,
        [shiftStart, shiftStart + shiftDuration],
        [0, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      scrollProgress += shiftProgress;
    }
  }

  // Draw arrow values (staggered entry)
  const arrow1Opacity = spring({
    frame: Math.max(0, frame - 12),
    fps,
    config: { damping: 15, mass: 0.5, stiffness: 120 },
    durationInFrames: 10,
  }) * (1 - exitProgress);

  const arrow2Opacity = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 15, mass: 0.5, stiffness: 120 },
    durationInFrames: 10,
  }) * (1 - exitProgress);

  return (
    <svg width="100%" height="100%" viewBox="0 0 600 700" fill="none" style={{ background: COLORS.white, borderRadius: '12px' }}>
      {/* Background grid pattern */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#F1F3F6" strokeWidth="1" />
        </pattern>
        {/* Arrow Decorator */}
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={COLORS.primary} />
        </marker>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      {/* RENDER STATIC ARROWS CONNECTING THE SLOTS */}
      {totalNodes >= 2 && (
        <line
          x1="300"
          y1="170"
          x2="300"
          y2="260"
          stroke={COLORS.primary}
          strokeWidth="4"
          strokeLinecap="round"
          markerEnd="url(#arrow)"
          style={{ opacity: arrow1Opacity }}
        />
      )}
      {totalNodes >= 3 && (
        <line
          x1="300"
          y1="390"
          x2="300"
          y2="480"
          stroke={COLORS.primary}
          strokeWidth="4"
          strokeLinecap="round"
          markerEnd="url(#arrow)"
          style={{ opacity: arrow2Opacity }}
        />
      )}

      {/* RENDER NODES DYNAMICALLY */}
      {nodes.map((node, index) => {
        // Staggered entry progress
        const staggerDelay = index * 8;
        const nodeEntry = spring({
          frame: Math.max(0, frame - staggerDelay),
          fps,
          config: { damping: 15, mass: 0.5, stiffness: 120 },
          durationInFrames: 12,
        });

        // Compute slot position (scrolled)
        const slot = index - scrollProgress;
        const y = 50 + slot * 220;

        // Compute opacity
        let opacity = nodeEntry * (1 - exitProgress);
        if (slot < 0) {
          // Slide up and out of slot 0
          opacity *= interpolate(slot, [-0.6, 0], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        } else if (slot > 2) {
          // Slide up and in to slot 2 from below
          opacity *= interpolate(slot, [2, 2.6], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        }

        // Only render if opacity is meaningful
        if (opacity <= 0) {
          return null;
        }

        return (
          <g key={index} style={{ opacity }}>
            <rect x="150" y={y} width="300" height="120" rx="12" fill={COLORS.white} stroke={COLORS.primary} strokeWidth="3" style={{ filter: 'drop-shadow(0px 8px 16px rgba(0, 0, 0, 0.04))' }} />
            <foreignObject x="160" y={y + 10} width="280" height="100">
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                width: '100%',
                textAlign: 'center',
                fontSize: '20px',
                fontWeight: '700',
                color: COLORS.primaryText,
                fontFamily: TYPOGRAPHY.fontFamily,
                lineHeight: '1.3',
                padding: '0 8px',
                boxSizing: 'border-box',
              }}>
                {index + 1}. {node.toUpperCase()}
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
};

export const VisualExplanation: React.FC<{ data: VisualExplanationData }> = ({ data }) => {
  const image = data?.image;
  const nodes = data?.nodes;
  const caption = data?.caption ?? 'Figure: System Architecture Diagram';
  const renderMode = data?.renderMode ?? 'fullscreen';

  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const { exitProgress, combined } = useTransitionProgress();

  // Slow subtle zoom over the entire duration of the composition (Ken Burns effect)
  const zoomScale = interpolate(
    frame,
    [0, durationInFrames],
    [1, 1.04],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Caption reveal progress (staggered slightly after visual entry)
  const captionReveal = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 15, mass: 0.4, stiffness: 120 },
    durationInFrames: 12,
  }) * (1 - exitProgress);

  const containerStyle: React.CSSProperties = {
    fontFamily: TYPOGRAPHY.fontFamily,
    backgroundColor: renderMode === 'overlay' ? 'transparent' : COLORS.lightBg,
    color: COLORS.primaryText,
    width: '100%',
    height: '100%',
  };

  const safeAreaStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${LAYOUT.safeMargins.left}px`,
    right: `${LAYOUT.safeMargins.right}px`,
    top: `${LAYOUT.safeMargins.top}px`,
    bottom: `${LAYOUT.safeMargins.bottom}px`,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    opacity: combined,
  };

  // 80% Visual Container
  const visualContainerStyle: React.CSSProperties = {
    flex: '1',
    maxHeight: '740px',
    width: '100%',
    borderRadius: '12px',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.04)',
    border: '1px solid rgba(0,0,0,0.02)',
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  };

  const imageZoomWrapperStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    transform: `scale(${zoomScale})`,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  };

  // 20% Caption Container
  const captionStyle: React.CSSProperties = {
    height: '120px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 40px',
    textAlign: 'center',
    opacity: captionReveal,
    transform: `translateY(${interpolate(captionReveal, [0, 1], [15, 0])}px)`,
    ...TYPOGRAPHY.caption,
    color: renderMode === 'overlay' ? COLORS.white : COLORS.secondaryText,
    lineHeight: '1.4',
  };

  return (
    <AbsoluteFill style={containerStyle}>
      <div style={safeAreaStyle}>
        {/* Visual Slot */}
        <div style={visualContainerStyle}>
          <div style={imageZoomWrapperStyle}>
            {image ? (
              <img
                src={image}
                alt="Visual Explanation"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <DefaultDiagram nodes={nodes} />
            )}
          </div>
        </div>

        {/* Caption Slot */}
        <div style={captionStyle}>
          {caption}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const defaultVisualData: VisualExplanationData = {
  nodes: [
    'Load Raw PDF Files',
    'Split Into Standard Text Chunks',
    'Generate Semantic Vector Embeddings',
    'Store Chunks In Vector Database',
    'Perform Nearest Neighbors Indexing',
    'Receive User Search Query',
    'Retrieve Similar Context Vectors',
    'Generate Context Enriched Response'
  ],
  caption: 'Figure 1.1: Document processing pipeline transforming raw text files into high-dimensional semantic embeddings stored in the vector database.',
  renderMode: 'fullscreen',
};
