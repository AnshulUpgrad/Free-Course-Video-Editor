import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, TYPOGRAPHY, LAYOUT } from '../../design-system/tokens';
import { useTransitionProgress } from '../../design-system/transitions';

export interface BulletListData {
  title: string;
  items: string[];
  renderMode?: 'fullscreen' | 'overlay' | 'picture-in-picture';
}

export const BulletList: React.FC<{ data: BulletListData }> = ({ data }) => {
  const title = data?.title ?? 'Key Concept Overview';
  const items = data?.items ?? [];
  const renderMode = data?.renderMode ?? 'fullscreen';

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Root entry/exit progress
  const { exitProgress, combined } = useTransitionProgress();

  const containerStyle: React.CSSProperties = {
    fontFamily: TYPOGRAPHY.fontFamily,
    backgroundColor: renderMode === 'overlay' ? 'transparent' : COLORS.lightBg,
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
    justifyContent: 'flex-start',
    opacity: combined,
  };

  const titleStyle: React.CSSProperties = {
    ...TYPOGRAPHY.h2,
    color: renderMode === 'overlay' ? COLORS.white : COLORS.primary,
    marginBottom: '64px',
    borderBottom: `2px solid ${renderMode === 'overlay' ? 'rgba(255,255,255,0.2)' : `${COLORS.primary}22`}`,
    paddingBottom: '16px',
  };

  const listStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
    listStyle: 'none',
  };

  return (
    <AbsoluteFill style={containerStyle}>
      <div style={safeAreaStyle}>
        <h2 style={titleStyle}>{title}</h2>
        <ul style={listStyle}>
          {items.map((item, index) => {
            // Stagger delay of 6 frames per item
            const staggerDelay = index * 6;
            const itemFrame = Math.max(0, frame - staggerDelay);
            
            // Item entry progress
            const itemEntry = spring({
              frame: itemFrame,
              fps,
              config: { damping: 15, mass: 0.4, stiffness: 120 },
              durationInFrames: 12,
            });

            // Combine with root exit progress
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
                  fontSize: TYPOGRAPHY.body.fontSize,
                  fontWeight: TYPOGRAPHY.body.fontWeight,
                  lineHeight: TYPOGRAPHY.body.lineHeight,
                }}
              >
                {/* Red Circular Bullet Point */}
                <div
                  style={{
                    minWidth: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: COLORS.primary,
                    marginTop: '14px',
                    marginRight: '24px',
                  }}
                />
                <div style={{ flex: 1 }}>{item}</div>
              </li>
            );
          })}
        </ul>
      </div>
    </AbsoluteFill>
  );
};

export const defaultBulletListData: BulletListData = {
  title: 'Benefits of Vector Embeddings',
  items: [
    'Captures semantic meaning beyond exact keywords',
    'Enables multi-modal comparison (text, images, audio)',
    'Reduces dimensionality while retaining critical context',
    'Powers similarity search in high-dimensional vector databases',
  ],
  renderMode: 'fullscreen',
};
