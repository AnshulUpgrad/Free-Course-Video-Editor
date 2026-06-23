import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, TYPOGRAPHY, LAYOUT } from '../../design-system/tokens';
import { useTransitionProgress } from '../../design-system/transitions';

export interface VisualExplanationData {
  image?: string; // Optional image URL
  caption: string;
  renderMode?: 'fullscreen' | 'overlay' | 'picture-in-picture';
}

// A beautiful default vector/RAG architecture SVG diagram to render when no image is provided
const DefaultDiagram: React.FC = () => {
  return (
    <svg width="100%" height="100%" viewBox="0 0 1000 500" fill="none" style={{ background: COLORS.white, borderRadius: '12px' }}>
      {/* Background grid pattern */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#F1F3F6" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      {/* Box 1: Document */}
      <rect x="100" y="200" width="160" height="100" rx="8" fill={COLORS.white} stroke={COLORS.primary} strokeWidth="3" />
      <text x="180" y="255" fill={COLORS.primaryText} fontSize="18" fontWeight="600" textAnchor="middle">Documents</text>

      {/* Arrow 1 */}
      <path d="M 260 250 L 340 250" stroke={COLORS.primary} strokeWidth="3" markerEnd="url(#arrow)" />
      
      {/* Box 2: Embedding */}
      <rect x="340" y="200" width="160" height="100" rx="8" fill={COLORS.white} stroke={COLORS.primary} strokeWidth="3" />
      <text x="420" y="255" fill={COLORS.primaryText} fontSize="18" fontWeight="600" textAnchor="middle">Embedding API</text>

      {/* Arrow 2 */}
      <path d="M 500 250 L 580 250" stroke={COLORS.primary} strokeWidth="3" />

      {/* Box 3: Vector Store */}
      <rect x="580" y="150" width="180" height="200" rx="8" fill={COLORS.white} stroke={COLORS.primary} strokeWidth="3" />
      <text x="670" y="235" fill={COLORS.primaryText} fontSize="20" fontWeight="700" textAnchor="middle">Vector DB</text>
      <rect x="600" y="260" width="140" height="30" rx="4" fill="#FEE2E2" />
      <text x="670" y="280" fill={COLORS.secondaryRed} fontSize="14" fontWeight="600" textAnchor="middle">Semantic Index</text>

      {/* Arrow Decorator */}
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={COLORS.primary} />
        </marker>
      </defs>
    </svg>
  );
};

export const VisualExplanation: React.FC<{ data: VisualExplanationData }> = ({ data }) => {
  const image = data?.image;
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
              <DefaultDiagram />
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
  caption: 'Figure 1.1: Document processing pipeline transforming raw text files into high-dimensional semantic embeddings stored in the vector database.',
  renderMode: 'fullscreen',
};
