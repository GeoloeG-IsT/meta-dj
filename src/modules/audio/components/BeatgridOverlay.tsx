/**
 * BeatgridOverlay - Renders beat markers over the waveform
 *
 * Displays vertical lines for each beat position from the beatgrid data.
 * Normal beats are subtle gray, downbeats (beat 1 of bar) are Engine Green.
 *
 * Story 2.3: "Slip-Under" Beatgrid Editing
 */

import { useMemo } from 'react';
import type { BeatgridData } from '../analysis/track-analyzer';

export interface BeatgridOverlayProps {
  /** Beatgrid data containing beat positions */
  beatgridData: BeatgridData | null;
  /** View range in normalized coordinates (0-1) */
  viewRange: { start: number; end: number };
  /** Total number of samples in the track */
  totalSamples: number;
  /** Height of the overlay in pixels */
  height: number;
  /** Optional sample offset for slip mode preview */
  slipOffset?: number;
  /** Index of beat that is snapped (for magnetic snap highlight) */
  snappedBeatIndex?: number | null;
}

/** Colors matching UX Design Specification */
const BEAT_COLOR_NORMAL = '#333333'; // Subtle gray for regular beats
const BEAT_COLOR_DOWNBEAT = '#4DFA90'; // Engine Green for downbeats (beat 1 of bar)
const BEAT_COLOR_SNAPPED = '#4DFA90'; // Engine Green with glow for snapped beat

/**
 * Calculate which beats are visible in the current view range.
 *
 * @param beatgrid - Beatgrid data with anchor positions
 * @param viewRange - Current visible range (normalized 0-1)
 * @param totalSamples - Total samples in the track
 * @param slipOffset - Optional sample offset for slip mode preview
 * @returns Array of visible beats with position and type info
 */
// eslint-disable-next-line react-refresh/only-export-components
export function getVisibleBeats(
  beatgrid: BeatgridData,
  viewRange: { start: number; end: number },
  totalSamples: number,
  slipOffset: number = 0
): Array<{
  index: number;
  position: number; // 0-1 normalized position in view
  isDownbeat: boolean;
  samplePosition: number;
}> {
  if (totalSamples <= 0 || beatgrid.beatCount === 0) {
    return [];
  }

  const viewStartSample = Math.floor(viewRange.start * totalSamples);
  const viewEndSample = Math.ceil(viewRange.end * totalSamples);
  const viewWidth = viewEndSample - viewStartSample;

  const visibleBeats: Array<{
    index: number;
    position: number;
    isDownbeat: boolean;
    samplePosition: number;
  }> = [];

  for (let i = 0; i < beatgrid.anchors.length; i++) {
    // Apply slip offset to beat position
    const beatSample = beatgrid.anchors[i] + slipOffset;

    // Check if beat is in view range
    if (beatSample >= viewStartSample && beatSample <= viewEndSample) {
      // Calculate normalized position within view (0 = left edge, 1 = right edge)
      const position = (beatSample - viewStartSample) / viewWidth;

      // Determine if this is a downbeat (beat 1 of a 4-beat bar)
      // First beat in grid is always a downbeat, then every 4th beat after
      const isDownbeat = i % 4 === 0;

      visibleBeats.push({
        index: i,
        position,
        isDownbeat,
        samplePosition: beatSample,
      });
    }
  }

  return visibleBeats;
}

/**
 * BeatgridOverlay component for rendering beat markers over the waveform.
 *
 * Renders vertical lines at each beat position within the current view range.
 * Downbeats (beat 1 of each bar) are highlighted in Engine Green.
 * Supports slip offset for live preview during beatgrid editing.
 *
 * @example
 * ```tsx
 * <BeatgridOverlay
 *   beatgridData={beatgrid}
 *   viewRange={{ start: 0.2, end: 0.4 }}
 *   totalSamples={10000000}
 *   height={128}
 * />
 * ```
 */
export function BeatgridOverlay({
  beatgridData,
  viewRange,
  totalSamples,
  height,
  slipOffset = 0,
  snappedBeatIndex = null,
}: BeatgridOverlayProps) {
  // Calculate visible beats with memoization
  const visibleBeats = useMemo(() => {
    if (!beatgridData) return [];
    return getVisibleBeats(beatgridData, viewRange, totalSamples, slipOffset);
  }, [beatgridData, viewRange, totalSamples, slipOffset]);

  // Don't render if no beatgrid data
  if (!beatgridData || visibleBeats.length === 0) {
    return null;
  }

  return (
    <div
      className="beatgrid-overlay absolute inset-0 pointer-events-none"
      style={{ height: `${height}px` }}
    >
      {visibleBeats.map((beat) => {
        const isSnapped = snappedBeatIndex === beat.index;
        const color = isSnapped
          ? BEAT_COLOR_SNAPPED
          : beat.isDownbeat
            ? BEAT_COLOR_DOWNBEAT
            : BEAT_COLOR_NORMAL;

        return (
          <div
            key={beat.index}
            className={`absolute top-0 bottom-0 ${isSnapped ? 'beatgrid-snapped' : ''}`}
            style={{
              left: `${beat.position * 100}%`,
              width: beat.isDownbeat ? '2px' : '1px',
              backgroundColor: color,
              opacity: beat.isDownbeat ? 0.8 : 0.4,
              transform: 'translateX(-50%)',
            }}
          />
        );
      })}
    </div>
  );
}
