import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, staticFile } from 'remotion';
import { COLORS, TYPOGRAPHY, LAYOUT } from '../../design-system/tokens';
import { useTransitionProgress } from '../../design-system/transitions';

export interface PostcardData {
  image?: string; // Optional image URL
  variant: 'bullets' | 'paragraph';
  title: string;
  bullets?: string[];
  paragraph?: string;
  renderMode?: 'fullscreen' | 'overlay' | 'picture-in-picture';
}

// A beautiful default vector SVG diagram for the Postcard when no image is provided
const PostcardDefaultDiagram: React.FC = () => {
  return (
    <svg width="100%" height="100%" viewBox="0 0 500 500" fill="none" style={{ background: COLORS.lightBg, borderRadius: '12px' }}>
      {/* Grid Pattern */}
      <defs>
        <pattern id="postcard-grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#E5E7EB" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#postcard-grid)" />

      {/* Central Database Stack Graphic */}
      <rect x="150" y="150" width="200" height="60" rx="8" fill={COLORS.white} stroke={COLORS.primary} strokeWidth="3" />
      <text x="250" y="185" fill={COLORS.primaryText} fontSize="16" fontWeight="700" textAnchor="middle">Query Vector</text>

      <path d="M 250 210 L 250 260" stroke={COLORS.primary} strokeWidth="3" strokeDasharray="6 4" />

      <rect x="130" y="260" width="240" height="120" rx="8" fill={COLORS.white} stroke={COLORS.primary} strokeWidth="3" />
      <text x="250" y="300" fill={COLORS.primaryText} fontSize="18" fontWeight="700" textAnchor="middle">Vector Index</text>
      <rect x="150" y="325" width="200" height="35" rx="4" fill="#FEE2E2" />
      <text x="250" y="347" fill={COLORS.secondaryRed} fontSize="14" fontWeight="600" textAnchor="middle">Nearest Neighbors</text>
    </svg>
  );
};

export const Postcard: React.FC<{ data: PostcardData }> = ({ data }) => {
  const image = data?.image;
  const variant = data?.variant ?? 'bullets';
  const title = data?.title ?? 'Postcard Title';
  const bullets = data?.bullets ?? [];
  const paragraph = data?.paragraph ?? 'Paragraph text goes here.';


  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const { exitProgress, combined } = useTransitionProgress();

  // Slow subtle zoom for the visual container (Ken Burns effect)
  const zoomScale = interpolate(
    frame,
    [0, durationInFrames],
    [1, 1.03],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Stagger delays for components
  // 1. Left visual slide-in (slides in from left: -40px to 0)
  const visualEntry = spring({
    frame,
    fps,
    config: { damping: 18, mass: 0.5, stiffness: 100 },
    durationInFrames: 15,
  });
  const visualTranslateX = interpolate(visualEntry, [0, 1], [-40, 0]);

  // 2. Right content block entry (slides in from right: 40px to 0)
  const contentEntry = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 18, mass: 0.5, stiffness: 100 },
    durationInFrames: 15,
  });
  const contentTranslateX = interpolate(contentEntry, [0, 1], [40, 0]);

  const containerStyle: React.CSSProperties = {
    fontFamily: TYPOGRAPHY.fontFamily,
    backgroundColor: COLORS.white,
    color: COLORS.primaryText,
    width: '100%',
    height: '100%',
  };

  const safeAreaStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${LAYOUT.safeMargins.left}px`,
    right: `${LAYOUT.safeMargins.right}px`,
    top: `${LAYOUT.safeMargins.top}px`,
    bottom: `${LAYOUT.safeMargins.bottom}px`,
    display: 'grid',
    gridTemplateColumns: '46fr 8fr 46fr', // Left visual, central gap, right text
    alignItems: 'center',
    opacity: combined,
  };

  const visualStyle: React.CSSProperties = {
    gridColumn: 1,
    height: '680px',
    borderRadius: '12px',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.04)',
    border: '1px solid rgba(0,0,0,0.03)',
    overflow: 'hidden',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: visualEntry * (1 - exitProgress),
    transform: `translateX(${visualTranslateX}px)`,
    backgroundColor: COLORS.lightBg,
  };

  const zoomWrapperStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    transform: `scale(${zoomScale})`,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  };

  const contentStyle: React.CSSProperties = {
    gridColumn: 3,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    opacity: contentEntry * (1 - exitProgress),
    transform: `translateX(${contentTranslateX}px)`,
  };

  const titleStyle: React.CSSProperties = {
    ...TYPOGRAPHY.h2,
    color: COLORS.primary,
    marginBottom: '32px',
    textAlign: 'left',
    lineHeight: '1.2',
  };

  return (
    <AbsoluteFill style={containerStyle}>
      <div style={safeAreaStyle}>
        {/* Left Side: Visual Container */}
        <div style={visualStyle}>
          <div style={zoomWrapperStyle}>
            {image ? (
              <img
                src={image}
                alt="Postcard Visual"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <PostcardDefaultDiagram />
            )}
          </div>
        </div>

        {/* Central Space (Grid Column 2) */}
        <div />

        {/* Right Side: Text Container */}
        <div style={contentStyle}>
          <h2 style={titleStyle}>{title}</h2>

          {variant === 'paragraph' ? (
            <p
              style={{
                ...TYPOGRAPHY.body,
                color: COLORS.primaryText,
                fontWeight: 400,
                lineHeight: '1.6',
              }}
            >
              {paragraph}
            </p>
          ) : (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '20px', listStyle: 'none', width: '100%' }}>
              {bullets.map((bullet, index) => {
                const bulletStagger = index * 6;
                const bulletFrame = Math.max(0, frame - bulletStagger - 12);
                
                const bulletEntry = spring({
                  frame: bulletFrame,
                  fps,
                  config: { damping: 15, mass: 0.4, stiffness: 120 },
                  durationInFrames: 12,
                });

                return (
                  <li
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      opacity: bulletEntry * (1 - exitProgress),
                      transform: `translateY(${interpolate(bulletEntry, [0, 1], [10, 0])}px)`,
                      fontSize: TYPOGRAPHY.caption.fontSize,
                      fontWeight: TYPOGRAPHY.body.fontWeight,
                      lineHeight: '1.5',
                      color: COLORS.secondaryText,
                    }}
                  >
                    <div
                      style={{
                        minWidth: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: COLORS.primary,
                        marginTop: '10px',
                        marginRight: '16px',
                      }}
                    />
                    <div style={{ flex: 1, color: COLORS.primaryText }}>{bullet}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const defaultPostcardBulletsData: PostcardData = {
  image: staticFile('image.png'),
  variant: 'bullets',
  title: 'Similarity Matching Process',
  bullets: [
    'User submits query which is converted into query embedding vector.',
    'Nearest neighbors are computed using cosine distance metric.',
    'Matches are fetched from the semantic index database.',
    'Result context is returned to prompt synthesis engine.',
  ],
};

export const defaultPostcardParagraphData: PostcardData = {
  image: staticFile('image.png'),
  variant: 'paragraph',
  title: 'Understanding Semantic Search',
  paragraph: 'Semantic search seeks to improve search accuracy by understanding the searcher\'s intent and the contextual meaning of terms. Instead of looking for exact word matches, it maps concepts into a high-dimensional vector space, allowing computers to associate related meanings, synonyms, and multi-modal assets dynamically.',
};
