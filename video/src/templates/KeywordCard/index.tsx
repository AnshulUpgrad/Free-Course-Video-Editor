import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { COLORS, TYPOGRAPHY, LAYOUT } from '../../design-system/tokens';
import { useTransitionProgress } from '../../design-system/transitions';

export interface KeywordCardData {
  keyword: string;
  renderMode?: 'fullscreen' | 'overlay' | 'picture-in-picture';
}

export const KeywordCard: React.FC<{ data: KeywordCardData }> = ({ data }) => {
  const keyword = data?.keyword ?? 'KEYWORD';

  const { entryProgress, exitProgress, combined } = useTransitionProgress();

  // Underline draw animation starts slightly after text entry starts
  const drawProgress = interpolate(
    entryProgress,
    [0.3, 1],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  ) * (1 - exitProgress);

  // Subtle scale pop: 0.93 -> 1.0 on entry, 1.0 -> 0.95 on exit
  const scale = interpolate(entryProgress, [0, 1], [0.93, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) * interpolate(exitProgress, [0, 1], [1, 0.95], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const containerStyle: React.CSSProperties = {
    fontFamily: TYPOGRAPHY.fontFamily,
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  };

  const textContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    opacity: combined,
    transform: `scale(${scale})`,
    maxWidth: `${LAYOUT.width - LAYOUT.safeMargins.left - LAYOUT.safeMargins.right}px`,
  };

  const wordStyle: React.CSSProperties = {
    fontSize: '96px', // Extra large for maximum emphasis
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: '-0.02em',
    lineHeight: '1.1',
    textTransform: 'uppercase',
  };

  return (
    <AbsoluteFill style={containerStyle}>
      <div style={textContainerStyle}>
        <div style={wordStyle}>{keyword}</div>
        {/* SVG Underline */}
        <svg
          style={{
            marginTop: '24px',
            width: '320px',
            height: '8px',
            overflow: 'visible',
          }}
        >
          <line
            x1="0"
            y1="4"
            x2="320"
            y2="4"
            stroke={COLORS.white}
            strokeWidth="8"
            strokeLinecap="round"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - drawProgress}
          />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

export const defaultKeywordData: KeywordCardData = {
  keyword: 'Embeddings',
  renderMode: 'fullscreen',
};
