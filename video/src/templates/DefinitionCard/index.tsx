import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, TYPOGRAPHY } from '../../design-system/tokens';
import { useTransitionProgress } from '../../design-system/transitions';

export interface DefinitionCardData {
  term: string;
  definition: string;
  renderMode?: 'fullscreen' | 'overlay' | 'picture-in-picture';
}

export const DefinitionCard: React.FC<{ data: DefinitionCardData }> = ({ data }) => {
  const term = data?.term ?? 'Term';
  const definition = data?.definition ?? 'Definition goes here.';
  const renderMode = data?.renderMode ?? 'fullscreen';

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { exitProgress } = useTransitionProgress();

  // 1. Accent bar vertical scale (runs first)
  const accentScaleY = spring({
    frame,
    fps,
    config: { damping: 18, mass: 0.5, stiffness: 150 },
    durationInFrames: 12,
  }) * (1 - exitProgress);

  // 2. Card background expansion / fade (starts slightly delayed)
  const cardProgress = spring({
    frame: Math.max(0, frame - 4),
    fps,
    config: { damping: 20, mass: 0.5, stiffness: 120 },
    durationInFrames: 14,
  }) * (1 - exitProgress);

  // 3. Content fade & slight slide-in
  const contentProgress = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 20, mass: 0.5, stiffness: 100 },
    durationInFrames: 15,
  }) * (1 - exitProgress);

  const containerStyle: React.CSSProperties = {
    fontFamily: TYPOGRAPHY.fontFamily,
    backgroundColor: renderMode === 'overlay' ? 'transparent' : COLORS.lightBg,
    color: COLORS.primaryText,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: COLORS.white,
    borderRadius: '12px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    position: 'relative',
    width: '1200px',
    padding: '64px 80px',
    opacity: cardProgress,
    transform: `scale(${interpolate(cardProgress, [0, 1], [0.97, 1])})`,
    overflow: 'hidden',
    border: '1px solid rgba(0,0,0,0.03)',
  };

  // Left red accent bar
  const accentBarStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '12px',
    backgroundColor: COLORS.primary,
    transformOrigin: 'top',
    transform: `scaleY(${accentScaleY})`,
  };

  const contentContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    opacity: contentProgress,
    transform: `translateX(${interpolate(contentProgress, [0, 1], [20, 0])}px)`,
    flex: 1,
  };

  const termStyle: React.CSSProperties = {
    ...TYPOGRAPHY.h2,
    color: COLORS.primaryText,
    letterSpacing: '-0.01em',
  };

  const definitionStyle: React.CSSProperties = {
    ...TYPOGRAPHY.body,
    color: COLORS.secondaryText,
    fontWeight: 400,
    lineHeight: '1.5',
  };

  return (
    <AbsoluteFill style={containerStyle}>
      <div style={cardStyle}>
        <div style={accentBarStyle} />
        <div style={contentContainerStyle}>
          <h2 style={termStyle}>{term}</h2>
          <p style={definitionStyle}>{definition}</p>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const defaultDefinitionData: DefinitionCardData = {
  term: 'Cosine Similarity',
  definition: 'A metric used to measure how similar two vectors are, calculated by finding the cosine of the angle between them in a multi-dimensional space.',
  renderMode: 'fullscreen',
};
