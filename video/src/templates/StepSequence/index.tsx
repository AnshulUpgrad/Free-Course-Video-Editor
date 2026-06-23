import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { COLORS, TYPOGRAPHY, LAYOUT } from '../../design-system/tokens';
import { useTransitionProgress } from '../../design-system/transitions';

export interface StepSequenceData {
  steps: string[];
  renderMode?: 'fullscreen' | 'overlay' | 'picture-in-picture';
}

export const StepSequence: React.FC<{ data: StepSequenceData }> = ({ data }) => {
  const steps = data?.steps ?? [];
  const renderMode = data?.renderMode ?? 'fullscreen';

  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { exitProgress, combined } = useTransitionProgress();

  // Division of timeline for sequential highlighting
  const entryDuration = 30; // first 1s is for intro stagger
  const exitDuration = 15;
  const activeDuration = durationInFrames - entryDuration - exitDuration;
  const framesPerStep = Math.max(1, activeDuration / steps.length);

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
    justifyContent: 'center',
    opacity: combined,
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
        <ul style={listStyle}>
          {steps.map((step, index) => {
            // 1. Staggered reveal on entry
            const staggerDelay = index * 6;
            const itemFrame = Math.max(0, frame - staggerDelay);
            const itemEntry = spring({
              frame: itemFrame,
              fps,
              config: { damping: 15, mass: 0.5, stiffness: 120 },
              durationInFrames: 12,
            });

            // 2. Sequential highlight logic
            // Step index is active if current frame falls in its window
            const stepStartFrame = entryDuration + index * framesPerStep;
            const stepEndFrame = stepStartFrame + framesPerStep;
            
            const isActive = frame >= stepStartFrame && frame < stepEndFrame;
            // If we are before the highlight phase, step 0 is highlighted by default
            const isHighlighted = frame < entryDuration ? index === 0 : isActive;

            // Layout styling
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
                  backgroundColor: isHighlighted ? (renderMode === 'overlay' ? 'rgba(255,255,255,0.08)' : `${COLORS.primary}05`) : 'transparent',
                  border: isHighlighted ? `1px solid ${renderMode === 'overlay' ? 'rgba(255,255,255,0.2)' : `${COLORS.primary}15`}` : '1px solid transparent',
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
                    color: isHighlighted ? (renderMode === 'overlay' ? COLORS.white : COLORS.primaryText) : COLORS.secondaryText,
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
  steps: [
    'Parse documents and extract clean text raw content.',
    'Split text into standard chunks with overlap.',
    'Submit chunks to embedding API to generate vectors.',
    'Index vectors into a vector database for quick search.',
  ],
  renderMode: 'fullscreen',
};
