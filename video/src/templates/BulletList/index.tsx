import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, TYPOGRAPHY, LAYOUT } from '../../design-system/tokens';
import { useTransitionProgress, useSlideLeftTransition } from '../../design-system/transitions';

export interface BulletListData {
  title: string;
  items: string[];
  layout?: 'fullscreen' | 'halfscreen';
  renderMode?: 'fullscreen' | 'overlay' | 'picture-in-picture';
}

export const BulletList: React.FC<{ data: BulletListData }> = ({ data }) => {
  const title = data?.title ?? 'Key Concept Overview';
  const items = data?.items ?? [];
  const layout = data?.layout ?? 'fullscreen';
  const renderMode = data?.renderMode ?? 'fullscreen';

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Root entry/exit progress
  const { exitProgress, combined } = useTransitionProgress();
  const slideLeftStyle = useSlideLeftTransition(150);

  const uppercaseTitle = title.toUpperCase();

  // Root container styling
  // In overlay mode (showcase), the container is transparent.
  // In standalone fullscreen mode, render a soft light gray background.
  const containerStyle: React.CSSProperties = {
    fontFamily: TYPOGRAPHY.fontFamily,
    backgroundColor: renderMode === 'overlay' ? 'transparent' : COLORS.lightBg,
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  };

  // 1. Render Half Screen Variant
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
      gap: '24px',
      listStyle: 'none',
    };

    return (
      <AbsoluteFill style={containerStyle}>
        <div style={halfScreenStyle}>
          <h2 style={titleStyle}>{uppercaseTitle}</h2>
          <ul style={listStyle}>
            {items.map((item, index) => {
              // Stagger delay of 6 frames per item
              const staggerDelay = index * 6;
              const itemFrame = Math.max(0, frame - staggerDelay);

              const itemEntry = spring({
                frame: itemFrame,
                fps,
                config: { damping: 15, mass: 0.4, stiffness: 120 },
                durationInFrames: 12,
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
                    lineHeight: '1.5',
                    color: COLORS.white,
                  }}
                >
                  {/* White Circular Bullet Point */}
                  <div
                    style={{
                      minWidth: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: COLORS.white,
                      marginTop: '14px',
                      marginRight: '20px',
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
  }

  // 2. Render Full Screen Variant (Original Safe Area Layout)
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
    textTransform: 'uppercase',
    color: renderMode === 'overlay' ? COLORS.white : COLORS.primary,
    marginBottom: '64px',
    borderBottom: `2px solid ${renderMode === 'overlay' ? 'rgba(255,255,255,0.2)' : `${COLORS.primary}22`}`,
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
      <div style={safeAreaStyle}>
        <h2 style={titleStyle}>{uppercaseTitle}</h2>
        <ul style={listStyle}>
          {items.map((item, index) => {
            const staggerDelay = index * 6;
            const itemFrame = Math.max(0, frame - staggerDelay);

            const itemEntry = spring({
              frame: itemFrame,
              fps,
              config: { damping: 15, mass: 0.4, stiffness: 120 },
              durationInFrames: 12,
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
                  fontSize: TYPOGRAPHY.body.fontSize,
                  fontWeight: TYPOGRAPHY.body.fontWeight,
                  lineHeight: TYPOGRAPHY.body.lineHeight,
                  color: renderMode === 'overlay' ? COLORS.white : COLORS.primaryText,
                }}
              >
                {/* Upgrad Red Circular Bullet Point */}
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

export const defaultHalfScreenBulletListData: BulletListData = {
  title: 'RAG Pipeline Components',
  items: [
    'Document Loader & Preprocessing',
    'Vector Embedding Generation API',
    'Vector DB Storage & Indexing',
    'Semantic Search & Context Retrieval',
    'LLM Prompt Augmentation',
  ],
  layout: 'halfscreen',
  renderMode: 'fullscreen',
};
