import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, TYPOGRAPHY, LAYOUT } from '../../design-system/tokens';
import { useTransitionProgress } from '../../design-system/transitions';

export interface ComparisonCardData {
  leftTitle: string;
  rightTitle: string;
  rows: [string, string][];
  renderMode?: 'fullscreen' | 'overlay' | 'picture-in-picture';
}

export const ComparisonCard: React.FC<{ data: ComparisonCardData }> = ({ data }) => {
  const leftTitle = data?.leftTitle ?? 'Option A';
  const rightTitle = data?.rightTitle ?? 'Option B';
  const rows = data?.rows ?? [];
  const renderMode = data?.renderMode ?? 'fullscreen';

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { exitProgress, combined } = useTransitionProgress();

  // Central divider line draw (runs in first 15 frames)
  const dividerHeight = spring({
    frame,
    fps,
    config: { damping: 20, mass: 0.5, stiffness: 100 },
    durationInFrames: 15,
  }) * (1 - exitProgress);

  // Header entry progress (runs in frames 5-20)
  const headerOpacity = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 15, mass: 0.4, stiffness: 120 },
    durationInFrames: 12,
  }) * (1 - exitProgress);

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

  const tableContainerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    columnGap: '80px',
    rowGap: '40px',
    width: '100%',
  };

  // Center vertical divider
  const verticalDividerStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '0',
    bottom: '0',
    width: '4px',
    backgroundColor: COLORS.primary,
    transformOrigin: 'top',
    transform: `scaleY(${dividerHeight}) translateX(-50%)`,
    borderRadius: '2px',
  };

  const headerStyle = (align: 'right' | 'left' | 'center'): React.CSSProperties => ({
    ...TYPOGRAPHY.h2,
    color: renderMode === 'overlay' ? COLORS.white : COLORS.primary,
    textAlign: align,
    opacity: headerOpacity,
    transform: `translateY(${interpolate(headerOpacity, [0, 1], [15, 0])}px)`,
    paddingBottom: '16px',
    borderBottom: `2px solid ${renderMode === 'overlay' ? 'rgba(255, 255, 255, 0.2)' : `${COLORS.primary}22`}`,
  });

  return (
    <AbsoluteFill style={containerStyle}>
      <div style={safeAreaStyle}>
        <div style={tableContainerStyle}>
          {/* Vertical Divider */}
          <div style={verticalDividerStyle} />

          {/* Table Headers */}
          <h2 style={headerStyle('center')}>{leftTitle}</h2>
          <h2 style={headerStyle('center')}>{rightTitle}</h2>

          {/* Comparison Rows */}
          {rows.map((row, index) => {
            // Row-by-row stagger delay
            const staggerDelay = 12 + index * 10;
            const rowFrame = Math.max(0, frame - staggerDelay);

            const rowEntry = spring({
              frame: rowFrame,
              fps,
              config: { damping: 18, mass: 0.4, stiffness: 120 },
              durationInFrames: 14,
            });

            const rowOpacity = rowEntry * (1 - exitProgress);
            const rowTranslateY = interpolate(rowEntry, [0, 1], [20, 0]);

            return (
              <React.Fragment key={index}>
                {/* Left Column Cell */}
                <div
                  style={{
                    opacity: rowOpacity,
                    transform: `translateY(${rowTranslateY}px)`,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    gap: '16px',
                    paddingRight: '20px',
                  }}
                >
                  {/* Red circular bullet */}
                  <div
                    style={{
                      minWidth: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: COLORS.primary,
                      marginTop: '14px',
                    }}
                  />
                  <div
                    style={{
                      textAlign: 'center',
                      fontSize: TYPOGRAPHY.body.fontSize,
                      fontWeight: TYPOGRAPHY.body.fontWeight,
                      lineHeight: TYPOGRAPHY.body.lineHeight,
                      color: renderMode === 'overlay' ? COLORS.white : COLORS.primaryText,
                    }}
                  >
                    {row[0]}
                  </div>
                </div>

                {/* Right Column Cell */}
                <div
                  style={{
                    opacity: rowOpacity,
                    transform: `translateY(${rowTranslateY}px)`,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    gap: '16px',
                    paddingLeft: '20px',
                  }}
                >
                  {/* Red circular bullet */}
                  <div
                    style={{
                      minWidth: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: COLORS.primary,
                      marginTop: '14px',
                    }}
                  />
                  <div
                    style={{
                      textAlign: 'center',
                      fontSize: TYPOGRAPHY.body.fontSize,
                      fontWeight: TYPOGRAPHY.body.fontWeight,
                      lineHeight: TYPOGRAPHY.body.lineHeight,
                      color: renderMode === 'overlay' ? 'rgba(255, 255, 255, 0.8)' : COLORS.secondaryText,
                    }}
                  >
                    {row[1]}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const defaultComparisonData: ComparisonCardData = {
  leftTitle: 'Traditional Search',
  rightTitle: 'Semantic Search',
  rows: [
    ['Keyword Matching and additonal concepts that will be covered as we follow through with the rest of this content', 'Concept & Context Matching'],
    ['Requires Exact Query Words', 'Handles Synonyms & Intent'],
    ['No Multi-modal Support', 'Compares Text, Images, and Audio'],
    ['Fails on Complex Questions', 'Synthesizes Semantic Similarity'],
  ],
  renderMode: 'fullscreen',
};
