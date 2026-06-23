import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, TYPOGRAPHY, LAYOUT } from '../../design-system/tokens';
import { useTransitionProgress, useSlideLeftTransition } from '../../design-system/transitions';

export interface TakeawaysData {
  title: string;
  points: string[];
  layout?: 'fullscreen' | 'halfscreen';
  renderMode?: 'fullscreen' | 'overlay' | 'picture-in-picture';
}

export const Takeaways: React.FC<{ data: TakeawaysData }> = ({ data }) => {
  const title = data?.title ?? 'Key Takeaways';
  const points = data?.points ?? [];
  const layout = data?.layout ?? 'fullscreen';
  const renderMode = data?.renderMode ?? 'fullscreen';

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { exitProgress, combined } = useTransitionProgress();
  const slideLeftStyle = useSlideLeftTransition(150);

  // Force heading to CAPS
  const uppercaseTitle = title.toUpperCase();

  const containerStyle: React.CSSProperties = {
    fontFamily: TYPOGRAPHY.fontFamily,
    backgroundColor: (layout === 'halfscreen' && renderMode === 'overlay') ? 'transparent' : COLORS.white,
    color: COLORS.primaryText,
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  };

  // 1. Render Half Screen Layout
  if (layout === 'halfscreen') {
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

    const titleStyle: React.CSSProperties = {
      color: COLORS.white,
      fontSize: '44px',
      fontWeight: '700',
      lineHeight: '1.2',
      marginBottom: '48px',
      borderBottom: `2px solid rgba(255, 255, 255, 0.25)`,
      paddingBottom: '16px',
      letterSpacing: '0.02em',
    };

    const listStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      gap: '32px',
      listStyle: 'none',
    };

    return (
      <AbsoluteFill style={containerStyle}>
        <div style={halfScreenStyle}>
          <h2 style={titleStyle}>{uppercaseTitle}</h2>
          <ul style={listStyle}>
            {points.map((point, index) => {
              const staggerDelay = index * 8;
              const itemFrame = Math.max(0, frame - staggerDelay);

              const itemEntry = spring({
                frame: itemFrame,
                fps,
                config: { damping: 16, mass: 0.4, stiffness: 110 },
                durationInFrames: 14,
              });

              const checkDraw = interpolate(itemEntry, [0.4, 1], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });

              const itemOpacity = itemEntry * (1 - exitProgress);
              const itemTranslateX = interpolate(itemEntry, [0, 1], [30, 0]);

              return (
                <li
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    opacity: itemOpacity,
                    transform: `translateX(${itemTranslateX}px)`,
                    fontSize: '28px',
                    fontWeight: '500',
                    lineHeight: '1.4',
                    color: COLORS.white,
                  }}
                >
                  {/* SVG Checkmark in White */}
                  <div style={{ marginRight: '20px', display: 'flex', alignItems: 'center' }}>
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={COLORS.white}
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
                  <div style={{ flex: 1 }}>{point}</div>
                </li>
              );
            })}
          </ul>
        </div>
      </AbsoluteFill>
    );
  }

  // 2. Render Full Screen Layout
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
    color: COLORS.primary,
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
        <h2 style={titleStyle}>{uppercaseTitle}</h2>
        <ul style={listStyle}>
          {points.map((point, index) => {
            const staggerDelay = index * 8;
            const itemFrame = Math.max(0, frame - staggerDelay);

            const itemEntry = spring({
              frame: itemFrame,
              fps,
              config: { damping: 16, mass: 0.4, stiffness: 110 },
              durationInFrames: 14,
            });

            const checkDraw = interpolate(itemEntry, [0.4, 1], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

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
                {/* SVG Checkmark in Upgrad Red */}
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
                <div style={{ flex: 1, color: COLORS.primaryText }}>{point}</div>
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
  layout: 'fullscreen',
  renderMode: 'fullscreen',
};

export const defaultHalfScreenTakeawaysData: TakeawaysData = {
  title: 'RAG Implementation Takeaways',
  points: [
    'Retrieval adds external domain-specific context in real-time.',
    'Rich contexts significantly improve prompt completion accuracy.',
    'Providing sources increases auditability and user trust.',
  ],
  layout: 'halfscreen',
  renderMode: 'fullscreen',
};
