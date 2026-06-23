import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, TYPOGRAPHY, LAYOUT } from '../../design-system/tokens';
import { useTransitionProgress } from '../../design-system/transitions';

export interface TakeawaysData {
  title: string;
  points: string[];
  renderMode?: 'fullscreen' | 'overlay' | 'picture-in-picture';
}

export const Takeaways: React.FC<{ data: TakeawaysData }> = ({ data }) => {
  const title = data?.title ?? 'Key Takeaways';
  const points = data?.points ?? [];
  const renderMode = data?.renderMode ?? 'fullscreen';

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { exitProgress, combined } = useTransitionProgress();

  const containerStyle: React.CSSProperties = {
    fontFamily: TYPOGRAPHY.fontFamily,
    backgroundColor: renderMode === 'overlay' ? 'transparent' : COLORS.white,
    color: renderMode === 'overlay' ? COLORS.white : COLORS.primaryText,
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
    justifyContent: 'center',
    opacity: combined,
  };

  const titleStyle: React.CSSProperties = {
    ...TYPOGRAPHY.h2,
    color: renderMode === 'overlay' ? COLORS.white : COLORS.primary,
    marginBottom: '56px',
    textAlign: 'left',
  };

  const listStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '36px',
    listStyle: 'none',
  };

  return (
    <AbsoluteFill style={containerStyle}>
      <div style={safeAreaStyle}>
        <h2 style={titleStyle}>{title}</h2>
        <ul style={listStyle}>
          {points.map((point, index) => {
            // 8 frames delay per takeaway item
            const staggerDelay = index * 8;
            const itemFrame = Math.max(0, frame - staggerDelay);

            // Item reveal animation
            const itemEntry = spring({
              frame: itemFrame,
              fps,
              config: { damping: 16, mass: 0.4, stiffness: 110 },
              durationInFrames: 14,
            });

            // SVG checkmark draw progress
            const checkDraw = interpolate(
              itemEntry,
              [0.4, 1],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );

            const itemOpacity = itemEntry * (1 - exitProgress);
            const itemTranslateY = interpolate(itemEntry, [0, 1], [15, 0]);

            return (
              <li
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  opacity: itemOpacity,
                  transform: `translateY(${itemTranslateY}px)`,
                  fontSize: TYPOGRAPHY.body.fontSize,
                  fontWeight: TYPOGRAPHY.body.fontWeight,
                  lineHeight: TYPOGRAPHY.body.lineHeight,
                }}
              >
                {/* SVG Checkmark */}
                <div style={{ marginRight: '24px', display: 'flex', alignItems: 'center' }}>
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={COLORS.primary}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ overflow: 'visible' }}
                  >
                    <polyline
                      points="20 6 9 17 4 12"
                      pathLength="1"
                      strokeDasharray="1"
                      strokeDashoffset={1 - checkDraw}
                    />
                  </svg>
                </div>
                <div style={{ flex: 1, color: renderMode === 'overlay' ? COLORS.white : COLORS.primaryText }}>{point}</div>
              </li>
            );
          })}
        </ul>
      </div>
    </AbsoluteFill>
  );
};

export const defaultTakeawaysData: TakeawaysData = {
  title: 'Key Takeaways',
  points: [
    'Retrieval adds external domain-specific context in real-time.',
    'Rich contexts significantly improve prompt completion accuracy.',
    'Providing sources increases auditability and user trust.',
  ],
  renderMode: 'fullscreen',
};
