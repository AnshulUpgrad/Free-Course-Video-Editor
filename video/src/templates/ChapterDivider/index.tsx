import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, TYPOGRAPHY } from '../../design-system/tokens';
import { useTransitionProgress } from '../../design-system/transitions';

export interface ChapterDividerData {
  module: string;
  title: string;
  renderMode?: 'fullscreen' | 'overlay' | 'picture-in-picture';
}

export const ChapterDivider: React.FC<{ data: ChapterDividerData }> = ({ data }) => {
  const module = data?.module ?? 'MODULE 01';
  const title = data?.title ?? 'Chapter Title';
  const renderMode = data?.renderMode ?? 'fullscreen';

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { exitProgress, combined } = useTransitionProgress();

  // 1. Divider line draw (frames 0 to 15)
  const lineDraw = spring({
    frame,
    fps,
    config: { damping: 20, mass: 0.5, stiffness: 100 },
    durationInFrames: 15,
  }) * (1 - exitProgress);

  // 2. Module label fade + slide-up (frames 6 to 20)
  const moduleReveal = spring({
    frame: Math.max(0, frame - 6),
    fps,
    config: { damping: 15, mass: 0.4, stiffness: 120 },
    durationInFrames: 12,
  }) * (1 - exitProgress);

  // 3. Title fade + slide-down (frames 10 to 25)
  const titleReveal = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 15, mass: 0.4, stiffness: 120 },
    durationInFrames: 12,
  }) * (1 - exitProgress);

  const containerStyle: React.CSSProperties = {
    fontFamily: TYPOGRAPHY.fontFamily,
    backgroundColor: renderMode === 'overlay' ? 'transparent' : COLORS.primary,
    color: COLORS.white,
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  };

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '800px',
    position: 'relative',
    opacity: combined,
  };

  const moduleStyle: React.CSSProperties = {
    ...TYPOGRAPHY.caption,
    color: COLORS.white,
    fontWeight: '700',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    marginBottom: '24px',
    opacity: moduleReveal,
    transform: `translateY(${interpolate(moduleReveal, [0, 1], [15, 0])}px)`,
  };

  const titleStyle: React.CSSProperties = {
    ...TYPOGRAPHY.h1,
    color: COLORS.white,
    textAlign: 'center',
    fontWeight: '700',
    marginTop: '24px',
    letterSpacing: '-0.02em',
    lineHeight: '1.2',
    opacity: titleReveal,
    transform: `translateY(${interpolate(titleReveal, [0, 1], [-15, 0])}px)`,
  };

  return (
    <AbsoluteFill style={containerStyle}>
      <div style={contentStyle}>
        {/* Module Label */}
        <div style={moduleStyle}>{module}</div>

        {/* Divider Line */}
        <svg
          style={{
            width: '600px',
            height: '4px',
            overflow: 'visible',
          }}
        >
          <line
            x1="0"
            y1="2"
            x2="600"
            y2="2"
            stroke={COLORS.white}
            strokeWidth="4"
            strokeLinecap="round"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - lineDraw}
          />
        </svg>

        {/* Chapter Title */}
        <h1 style={titleStyle}>{title}</h1>
      </div>
    </AbsoluteFill>
  );
};

export const defaultChapterDividerData: ChapterDividerData = {
  module: 'Module 03',
  title: 'Retrieval Systems & Vector Indexing',
  renderMode: 'fullscreen',
};
