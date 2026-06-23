import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COLORS, TYPOGRAPHY, LAYOUT } from '../../design-system/tokens';
import { useScaleTransition } from '../../design-system/transitions';

export interface ConceptCardData {
  concept: string;
  renderMode?: 'fullscreen' | 'overlay' | 'picture-in-picture';
}

export const ConceptCard: React.FC<{ data: ConceptCardData }> = ({ data }) => {
  const concept = data?.concept ?? 'Concept Name';
  const renderMode = data?.renderMode ?? 'fullscreen';

  // Fade in + scale from 97% to 100% on entry, and out on exit
  const transitionStyle = useScaleTransition(0.97);

  const containerStyle: React.CSSProperties = {
    fontFamily: TYPOGRAPHY.fontFamily,
    backgroundColor: renderMode === 'overlay' ? 'transparent' : COLORS.primary,
    color: COLORS.white,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  };

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '32px',
    maxWidth: `${LAYOUT.width - LAYOUT.safeMargins.left - LAYOUT.safeMargins.right}px`,
    ...transitionStyle,
  };

  const lineStyle: React.CSSProperties = {
    width: '80px',
    height: '6px',
    backgroundColor: COLORS.white,
    borderRadius: '3px',
  };

  const textStyle: React.CSSProperties = {
    ...TYPOGRAPHY.h1,
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: '-0.02em',
    lineHeight: '1.2',
  };

  return (
    <AbsoluteFill style={containerStyle}>
      <div style={contentStyle}>
        {/* Small Red Accent Line Above Title */}
        <div style={lineStyle} />
        <h1 style={textStyle}>{concept}</h1>
      </div>
    </AbsoluteFill>
  );
};

export const defaultConceptData: ConceptCardData = {
  concept: 'Retrieval-Augmented Generation',
  renderMode: 'fullscreen',
};
