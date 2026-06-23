import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, TYPOGRAPHY, LAYOUT } from '../../design-system/tokens';
import { useTransitionProgress, useSlideLeftTransition } from '../../design-system/transitions';

export interface StepSequenceData {
  title?: string;
  steps: string[];
  layout?: 'fullscreen' | 'halfscreen';
  renderMode?: 'fullscreen' | 'overlay' | 'picture-in-picture';
}

export const StepSequence: React.FC<{ data: StepSequenceData }> = ({ data }) => {
  const title = data?.title ?? 'Process Steps';
  const steps = data?.steps ?? [];
  const layout = data?.layout ?? 'fullscreen';
  const renderMode = data?.renderMode ?? 'fullscreen';

  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { exitProgress, combined } = useTransitionProgress();
  const slideLeftStyle = useSlideLeftTransition(150);

  // Force heading to all CAPS
  const uppercaseTitle = title.toUpperCase();

  // Division of timeline for sequential highlighting
  const entryDuration = 30; // first 1s is for intro stagger
  const exitDuration = 15;
  const activeDuration = durationInFrames - entryDuration - exitDuration;
  const framesPerStep = Math.max(1, activeDuration / steps.length);

  const containerStyle: React.CSSProperties = {
    fontFamily: TYPOGRAPHY.fontFamily,
    backgroundColor: (layout === 'halfscreen' && renderMode === 'overlay') ? 'transparent' : COLORS.lightBg,
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
      gap: '24px',
      listStyle: 'none',
    };

    return (
      <AbsoluteFill style={containerStyle}>
        <div style={halfScreenStyle}>
          <h2 style={titleStyle}>{uppercaseTitle}</h2>
          <ul style={listStyle}>
            {steps.map((step, index) => {
              const staggerDelay = index * 6;
              const itemFrame = Math.max(0, frame - staggerDelay);
              const itemEntry = spring({
                frame: itemFrame,
                fps,
                config: { damping: 15, mass: 0.5, stiffness: 120 },
                durationInFrames: 12,
              });

              const stepStartFrame = entryDuration + index * framesPerStep;
              const stepEndFrame = stepStartFrame + framesPerStep;
              
              const isActive = frame >= stepStartFrame && frame < stepEndFrame;
              const isHighlighted = frame < entryDuration ? index === 0 : isActive;

              const itemOpacity = itemEntry * (1 - exitProgress) * (isHighlighted ? 1 : 0.4);
              const itemTranslateX = interpolate(itemEntry, [0, 1], [30, 0]);
              const scale = isHighlighted ? 1.02 : 1.0;

              return (
                <li
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    opacity: itemOpacity,
                    transform: `translateX(${itemTranslateX}px) scale(${scale})`,
                    transition: 'transform 0.2s ease, opacity 0.2s ease',
                    padding: '16px 24px',
                    borderRadius: '12px',
                    backgroundColor: isHighlighted ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                    border: isHighlighted ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent',
                  }}
                >
                  {/* Number Badge (White when active, transparent-white when inactive) */}
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: isHighlighted ? COLORS.white : 'rgba(255, 255, 255, 0.3)',
                      color: isHighlighted ? COLORS.upgradRed : COLORS.white,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      fontSize: '24px',
                      fontWeight: '700',
                      marginRight: '24px',
                      boxShadow: isHighlighted ? '0 8px 16px rgba(0, 0, 0, 0.15)' : 'none',
                      transition: 'background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
                      flexShrink: 0,
                    }}
                  >
                    {index + 1}
                  </div>
                  {/* Label */}
                  <div
                    style={{
                      fontSize: '26px',
                      fontWeight: isHighlighted ? '600' : '500',
                      color: isHighlighted ? COLORS.white : 'rgba(255, 255, 255, 0.6)',
                      transition: 'color 0.2s ease',
                      lineHeight: '1.4',
                    }}
                  >
                    {step}
                  </div>
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
    justifyContent: 'flex-start',
    opacity: combined,
  };

  const titleStyle: React.CSSProperties = {
    ...TYPOGRAPHY.h2,
    textTransform: 'uppercase',
    color: COLORS.primary,
    marginBottom: '48px',
    borderBottom: `2px solid ${COLORS.primary}22`,
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
      <div style={safeAreaStyle}>
        <h2 style={titleStyle}>{uppercaseTitle}</h2>
        <ul style={listStyle}>
          {steps.map((step, index) => {
            const staggerDelay = index * 6;
            const itemFrame = Math.max(0, frame - staggerDelay);
            const itemEntry = spring({
              frame: itemFrame,
              fps,
              config: { damping: 15, mass: 0.5, stiffness: 120 },
              durationInFrames: 12,
            });

            const stepStartFrame = entryDuration + index * framesPerStep;
            const stepEndFrame = stepStartFrame + framesPerStep;
            
            const isActive = frame >= stepStartFrame && frame < stepEndFrame;
            const isHighlighted = frame < entryDuration ? index === 0 : isActive;

            const itemOpacity = itemEntry * (1 - exitProgress) * (isHighlighted ? 1 : 0.4);
            const scale = isHighlighted ? 1.02 : 1.0;
            
            return (
              <li
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  opacity: itemOpacity,
                  transform: `scale(${scale})`,
                  transition: 'transform 0.2s ease, opacity 0.2s ease',
                  padding: '16px 24px',
                  borderRadius: '12px',
                  backgroundColor: isHighlighted ? `${COLORS.primary}05` : 'transparent',
                  border: isHighlighted ? `1px solid ${COLORS.primary}15` : '1px solid transparent',
                }}
              >
                {/* Red Circular Number Badge */}
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: isHighlighted ? COLORS.primary : COLORS.secondaryText,
                    color: COLORS.white,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: '28px',
                    fontWeight: '700',
                    marginRight: '32px',
                    boxShadow: isHighlighted ? '0 8px 16px rgba(239, 44, 60, 0.2)' : 'none',
                    transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
                  }}
                >
                  {index + 1}
                </div>
                {/* Label */}
                <div
                  style={{
                    fontSize: TYPOGRAPHY.body.fontSize,
                    fontWeight: isHighlighted ? '600' : '500',
                    color: isHighlighted ? COLORS.primaryText : COLORS.secondaryText,
                    transition: 'color 0.2s ease',
                  }}
                >
                  {step}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </AbsoluteFill>
  );
};

export const defaultStepSequenceData: StepSequenceData = {
  title: 'RAG Pipeline Steps',
  steps: [
    'Parse documents and extract clean text raw content.',
    'Split text into standard chunks with overlap.',
    'Submit chunks to embedding API to generate vectors.',
    'Index vectors into a vector database for quick search.',
  ],
  layout: 'fullscreen',
  renderMode: 'fullscreen',
};

export const defaultHalfScreenStepSequenceData: StepSequenceData = {
  title: 'RAG Query Process',
  steps: [
    'Embed the user query using the embedding model',
    'Retrieve the top k similar vectors from the database',
    'Construct the prompt with retrieved context and query',
    'Pass the context-enriched prompt to the LLM',
    'Generate and return the response'
  ],
  layout: 'halfscreen',
  renderMode: 'fullscreen',
};
