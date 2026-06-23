import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { COLORS, TYPOGRAPHY, LAYOUT } from '../../design-system/tokens';
import { useSlideLeftTransition, useTransitionProgress } from '../../design-system/transitions';

export interface DefinitionCardData {
  term: string;
  definition: string;
  renderMode?: 'fullscreen' | 'overlay' | 'picture-in-picture';
}

export const DefinitionCard: React.FC<{ data: DefinitionCardData }> = ({ data }) => {
  const term = data?.term ?? 'Cosine Similarity';
  const definition = data?.definition ?? 'A metric used to measure how similar two vectors are, calculated by finding the cosine of the angle between them in a multi-dimensional space.';
  const renderMode = data?.renderMode ?? 'fullscreen';

  // Determine if definition is short (<= 15 words) or long (> 15 words)
  const wordCount = definition.trim().split(/\s+/).filter(Boolean).length;
  const isShort = wordCount <= 20;

  // Use transition hooks based on layout type
  const { entryProgress, exitProgress, combined } = useTransitionProgress();
  const slideLeftStyle = useSlideLeftTransition(150);

  // Vertical slide-up calculation for centered box: from +50px offset to 0px
  const translateYOffset = interpolate(
    entryProgress,
    [0, 1],
    [50, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  ) - interpolate(
    exitProgress,
    [0, 1],
    [0, 50],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Root container styling
  // In overlay mode (e.g. over a video in showcase), the background is transparent.
  // In standalone/fullscreen mode, we render a soft neutral gradient to simulate a clean slide.
  const containerStyle: React.CSSProperties = {
    fontFamily: TYPOGRAPHY.fontFamily,
    backgroundColor: renderMode === 'overlay' ? 'transparent' : '#F3F4F6',
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  };

  // 1. Render Short Definition (Corner Box - Right Center)
  if (isShort) {
    const cornerBoxStyle: React.CSSProperties = {
      position: 'absolute',
      right: `${LAYOUT.cornerBox.right}px`,
      top: LAYOUT.cornerBox.top,
      transform: `translateY(calc(-50% + ${translateYOffset}px))`,
      opacity: combined,
      width: '920px',
      minHeight: '320px',
      backgroundColor: COLORS.upgradRed,
      borderRadius: '16px',
      padding: '56px 64px',
      boxShadow: '0 24px 50px rgba(0, 0, 0, 0.25)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderLeft: `8px solid ${COLORS.white}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      boxSizing: 'border-box',
    };

    const termStyle: React.CSSProperties = {
      color: COLORS.white,
      fontSize: '60px',
      fontWeight: '700',
      lineHeight: '1.2',
      letterSpacing: '-0.01em',
    };

    const definitionStyle: React.CSSProperties = {
      color: COLORS.white,
      fontSize: '34px',
      fontWeight: '400',
      lineHeight: '1.5',
    };

    return (
      <AbsoluteFill style={containerStyle}>
        <div style={cornerBoxStyle}>
          <h2 style={termStyle}>{term}</h2>
          <p style={definitionStyle}>{definition}</p>
        </div>
      </AbsoluteFill>
    );
  }

  // 2. Render Long Definition (Half Screen - Covers Right Half)
  const halfScreenStyle: React.CSSProperties = {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: `${LAYOUT.halfScreen.width}px`,
    backgroundColor: COLORS.upgradRed,
    borderLeft: `10px solid ${COLORS.white}`,
    boxShadow: '-20px 0 50px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '80px 72px',
    boxSizing: 'border-box',
    ...slideLeftStyle,
  };

  const termStyle: React.CSSProperties = {
    color: COLORS.white,
    fontSize: '60px',
    fontWeight: '700',
    lineHeight: '1.25',
    letterSpacing: '-0.01em',
    marginBottom: '32px',
  };

  const definitionStyle: React.CSSProperties = {
    color: COLORS.white,
    fontSize: '34px',
    fontWeight: '400',
    lineHeight: '1.6',
  };

  return (
    <AbsoluteFill style={containerStyle}>
      <div style={halfScreenStyle}>
        <h2 style={termStyle}>{term}</h2>
        <p style={definitionStyle}>{definition}</p>
      </div>
    </AbsoluteFill>
  );
};

export const defaultDefinitionData: DefinitionCardData = {
  term: 'Cosine Similarity',
  definition: 'A metric used to measure how similar two vectors are, calculated by finding the cosine of the angle between them in a multi-dimensional space.',
  renderMode: 'fullscreen',
};

export const defaultShortDefinitionData: DefinitionCardData = {
  term: 'Large Language Model',
  definition: 'An AI model trained on massive text corpora to understand and generate human-like language.Its advantages are the ease of adoption ',
  renderMode: 'fullscreen',
};
