import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, TYPOGRAPHY, LAYOUT } from '../../design-system/tokens';
import { useTransitionProgress } from '../../design-system/transitions';

export interface ProcessFlowData {
  nodes: string[];
  isOverlay?: boolean;
}

export const ProcessFlow: React.FC<{ data: ProcessFlowData }> = ({ data }) => {
  const nodes = data?.nodes ?? [];
  const isOverlay = data?.isOverlay ?? false;

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { exitProgress, combined } = useTransitionProgress();

  const containerStyle: React.CSSProperties = {
    fontFamily: TYPOGRAPHY.fontFamily,
    backgroundColor: isOverlay ? 'transparent' : COLORS.lightBg,
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
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: combined,
  };

  const flowContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    maxWidth: '800px',
  };

  return (
    <AbsoluteFill style={containerStyle}>
      <div style={safeAreaStyle}>
        <div style={flowContainerStyle}>
          {nodes.map((node, index) => {
            // Timing for node and connector reveals
            // Each stage (node + connector) takes 14 frames
            const nodeDelay = index * 14;
            const connDelay = nodeDelay + 8;

            const nodeFrame = Math.max(0, frame - nodeDelay);
            const connFrame = Math.max(0, frame - connDelay);

            const nodeEntry = spring({
              frame: nodeFrame,
              fps,
              config: { damping: 15, mass: 0.4, stiffness: 120 },
              durationInFrames: 10,
            });

            const connEntry = spring({
              frame: connFrame,
              fps,
              config: { damping: 15, mass: 0.4, stiffness: 100 },
              durationInFrames: 10,
            });

            const nodeOpacity = nodeEntry * (1 - exitProgress);
            const nodeScale = interpolate(nodeEntry, [0, 1], [0.95, 1]);
            const drawProgress = connEntry * (1 - exitProgress);

            const isLast = index === nodes.length - 1;

            return (
              <React.Fragment key={index}>
                {/* Node Card */}
                <div
                  style={{
                    backgroundColor: COLORS.white,
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.04)',
                    border: '1px solid rgba(0,0,0,0.02)',
                    padding: '20px 48px',
                    width: '100%',
                    textAlign: 'center',
                    opacity: nodeOpacity,
                    transform: `scale(${nodeScale})`,
                    fontSize: TYPOGRAPHY.body.fontSize,
                    fontWeight: '600',
                    color: COLORS.primaryText,
                    zIndex: 2,
                  }}
                >
                  {node}
                </div>

                {/* Connector Arrow */}
                {!isLast && (
                  <div
                    style={{
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1,
                      margin: '4px 0',
                    }}
                  >
                    <svg
                      width="40"
                      height="40"
                      viewBox="0 0 40 40"
                      fill="none"
                      style={{ overflow: 'visible' }}
                    >
                      <line
                        x1="20"
                        y1="0"
                        x2="20"
                        y2="30"
                        stroke={COLORS.primary}
                        strokeWidth="4"
                        strokeLinecap="round"
                        pathLength="1"
                        strokeDasharray="1"
                        strokeDashoffset={1 - drawProgress}
                      />
                      <path
                        d="M12 22 L20 30 L28 22"
                        stroke={COLORS.primary}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          opacity: drawProgress > 0.8 ? 1 : 0,
                          transition: 'opacity 0.1s ease',
                        }}
                      />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const defaultProcessFlowData: ProcessFlowData = {
  nodes: [
    'Raw PDF Documents',
    'Embedding Model Pipeline',
    'Vector Database Storage',
    'Similarity Context Retrieval',
    'LLM Answer Generation',
  ],
  isOverlay: false,
};
