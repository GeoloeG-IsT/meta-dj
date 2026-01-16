/**
 * CueMarkerOverlay - Renders hot cue markers over the waveform
 *
 * Displays triangle markers at each hot cue position with color coding.
 * Markers show the pad number (1-8) and use the cue's assigned color.
 *
 * Story 2.4: Hot Cue & Loop Management
 */

import { useMemo } from 'react';
import type { HotCueData } from '../types/cue-loop';
import { CUE_COLOR_HEX } from '../types/cue-loop';

export interface CueMarkerOverlayProps {
  /** Hot cue data array (8 slots, some may be unset) */
  cuePoints: HotCueData[];
  /** View range in normalized coordinates (0-1) */
  viewRange: { start: number; end: number };
  /** Total number of samples in the track */
  totalSamples: number;
  /** Height of the overlay in pixels */
  height: number;
  /** Callback when a cue marker is clicked */
  onCueClick?: (cueIndex: number) => void;
  /** Callback when a cue marker is right-clicked (context menu) */
  onCueContextMenu?: (cueIndex: number, event: React.MouseEvent) => void;
}

/**
 * Calculate which cues are visible in the current view range.
 *
 * @param cuePoints - Array of hot cue data
 * @param viewRange - Current visible range (normalized 0-1)
 * @param totalSamples - Total samples in the track
 * @returns Array of visible cues with position info
 */
export function getVisibleCues(
  cuePoints: HotCueData[],
  viewRange: { start: number; end: number },
  totalSamples: number
): Array<{
  cue: HotCueData;
  position: number; // 0-1 normalized position in view
}> {
  if (totalSamples <= 0) {
    return [];
  }

  const viewStartSample = Math.floor(viewRange.start * totalSamples);
  const viewEndSample = Math.ceil(viewRange.end * totalSamples);
  const viewWidth = viewEndSample - viewStartSample;

  const visibleCues: Array<{
    cue: HotCueData;
    position: number;
  }> = [];

  for (const cue of cuePoints) {
    // Skip unset cues
    if (!cue.isSet) continue;

    const cueSample = cue.position;

    // Check if cue is in view range
    if (cueSample >= viewStartSample && cueSample <= viewEndSample) {
      // Calculate normalized position within view (0 = left edge, 1 = right edge)
      const position = (cueSample - viewStartSample) / viewWidth;

      visibleCues.push({
        cue,
        position,
      });
    }
  }

  return visibleCues;
}

/**
 * CueMarkerOverlay component for rendering hot cue markers over the waveform.
 *
 * Renders triangle markers at each cue position within the current view range.
 * Each marker shows the pad number and uses the cue's assigned color.
 *
 * @example
 * ```tsx
 * <CueMarkerOverlay
 *   cuePoints={deck.cuePoints}
 *   viewRange={{ start: 0.2, end: 0.4 }}
 *   totalSamples={10000000}
 *   height={128}
 *   onCueClick={(index) => triggerCue(index)}
 * />
 * ```
 */
export function CueMarkerOverlay({
  cuePoints,
  viewRange,
  totalSamples,
  height,
  onCueClick,
  onCueContextMenu,
}: CueMarkerOverlayProps) {
  // Calculate visible cues with memoization
  const visibleCues = useMemo(() => {
    return getVisibleCues(cuePoints, viewRange, totalSamples);
  }, [cuePoints, viewRange, totalSamples]);

  // Don't render if no visible cues
  if (visibleCues.length === 0) {
    return null;
  }

  return (
    <div
      className="cue-marker-overlay absolute inset-0 pointer-events-none"
      style={{ height: `${height}px` }}
    >
      {visibleCues.map(({ cue, position }) => {
        const colorHex = CUE_COLOR_HEX[cue.color];
        const padNumber = cue.index + 1; // Display 1-8 instead of 0-7

        return (
          <div
            key={cue.index}
            className="absolute top-0 bottom-0 pointer-events-auto cursor-pointer"
            style={{
              left: `${position * 100}%`,
              transform: 'translateX(-50%)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onCueClick?.(cue.index);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCueContextMenu?.(cue.index, e);
            }}
          >
            {/* Triangle marker pointing down */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: `10px solid ${colorHex}`,
              }}
            />
            {/* Pad number label */}
            <div
              className="absolute top-2.5 left-1/2 -translate-x-1/2 text-xs font-bold"
              style={{
                color: colorHex,
                textShadow: '0 0 2px #000, 0 0 4px #000',
                fontSize: '10px',
                lineHeight: 1,
              }}
            >
              {padNumber}
            </div>
            {/* Vertical line extending down */}
            <div
              className="absolute top-4 left-1/2 -translate-x-1/2"
              style={{
                width: '1px',
                height: `calc(${height}px - 16px)`,
                backgroundColor: colorHex,
                opacity: 0.6,
              }}
            />
            {/* Cue name (if set) */}
            {cue.name && (
              <div
                className="absolute top-5 left-1/2 whitespace-nowrap"
                style={{
                  color: colorHex,
                  textShadow: '0 0 2px #000, 0 0 4px #000',
                  fontSize: '9px',
                  transform: 'translateX(-50%) rotate(-90deg)',
                  transformOrigin: 'top center',
                  marginTop: '4px',
                }}
              >
                {cue.name}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
