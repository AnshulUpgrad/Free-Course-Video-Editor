import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export interface TransitionProgress {
  entryProgress: number;
  exitProgress: number;
  combined: number;
}

/**
 * Returns spring-based entry and exit progress values.
 * - entryProgress: 0 -> 1 in first `entryDuration` frames
 * - exitProgress: 0 -> 1 in last `exitDuration` frames
 * - combined: transitions 0 -> 1 (entry) -> 1 (idle) -> 0 (exit)
 */
export const useTransitionProgress = (options?: {
  entryDuration?: number;
  exitDuration?: number;
}): TransitionProgress => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const entryDuration = options?.entryDuration ?? 15; // 0.5 seconds at 30fps
  const exitDuration = options?.exitDuration ?? 15;

  const entryProgress = spring({
    frame,
    fps,
    config: { damping: 20, mass: 0.5, stiffness: 100 },
    durationInFrames: entryDuration,
  });

  const exitFrame = Math.max(0, frame - (durationInFrames - exitDuration));
  const exitProgress = spring({
    frame: exitFrame,
    fps,
    config: { damping: 20, mass: 0.5, stiffness: 100 },
    durationInFrames: exitDuration,
  });

  return {
    entryProgress,
    exitProgress,
    combined: entryProgress * (1 - exitProgress),
  };
};

/**
 * Hook to get CSS styles for a simple fade-in / fade-out transition.
 */
export const useFadeTransition = (options?: { entryDuration?: number; exitDuration?: number }) => {
  const { combined } = useTransitionProgress(options);
  return { opacity: combined };
};

/**
 * Hook to get CSS styles for a slide-up transition with fade.
 */
export const useSlideUpTransition = (
  offsetPixels = 40,
  options?: { entryDuration?: number; exitDuration?: number }
) => {
  const { entryProgress, exitProgress, combined } = useTransitionProgress(options);

  // Slide up on entry (offset -> 0), slide up and away on exit (0 -> -offset)
  const translateY = interpolate(
    entryProgress,
    [0, 1],
    [offsetPixels, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  ) - interpolate(
    exitProgress,
    [0, 1],
    [0, offsetPixels],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return {
    opacity: combined,
    transform: `translateY(${translateY}px)`,
  };
};

/**
 * Hook to get CSS styles for a slide-left transition (for slide layouts).
 */
export const useSlideLeftTransition = (
  offsetPixels = 50,
  options?: { entryDuration?: number; exitDuration?: number }
) => {
  const { entryProgress, exitProgress, combined } = useTransitionProgress(options);

  const translateX = interpolate(
    entryProgress,
    [0, 1],
    [offsetPixels, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  ) - interpolate(
    exitProgress,
    [0, 1],
    [0, offsetPixels],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return {
    opacity: combined,
    transform: `translateX(${translateX}px)`,
  };
};

/**
 * Hook to get CSS styles for a scale and fade transition.
 * Standard Coursera style scales slightly (e.g. 97% to 100%).
 */
export const useScaleTransition = (
  startScale = 0.97,
  options?: { entryDuration?: number; exitDuration?: number }
) => {
  const { entryProgress, exitProgress, combined } = useTransitionProgress(options);

  const scale = interpolate(
    entryProgress,
    [0, 1],
    [startScale, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  ) * interpolate(
    exitProgress,
    [0, 1],
    [1, startScale],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return {
    opacity: combined,
    transform: `scale(${scale})`,
  };
};
