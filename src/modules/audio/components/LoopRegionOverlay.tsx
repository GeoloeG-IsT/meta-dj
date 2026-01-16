/**
 * LoopRegionOverlay - Renders loop regions over the waveform
 *
 * Displays bracketed regions for each loop with in-point and out-point markers.
 * Active loops are highlighted with pulsing borders.
 *
 * Story 2.4: Hot Cue & Loop Management
 */

import { useMemo } from 'react';
import type { LoopData } from '../types/cue-loop';
import { CUE_COLOR_HEX, calculateLoopLengthLabel } from '../types/cue-loop';

export interface LoopRegionOverlayProps {
  /** Loop data array */
  loops: LoopData[];
  /** View range in normalized coordinates (0-1) */
  viewRange: { start: number; end: number };
  /** Total number of samples in the track */
  totalSamples: number;
  /** Height of the overlay in pixels */
  height: number;
  /** Samples per beat (for calculating loop length label) */
  samplesPerBeat: number;
  /** Callback when a loop region is clicked */
  onLoopClick?: (loopIndex: number) => void;
  /** Callback when a loop region is right-clicked (context menu) */
  onLoopContextMenu?: (loopIndex: number, event: React.MouseEvent) => void;
}

/**
 * Calculate which loops are visible in the current view range.
 *
 * @param loops - Array of loop data
 * @param viewRange - Current visible range (normalized 0-1)
 * @param totalSamples - Total samples in the track
 * @returns Array of visible loops with position info
 */
// eslint-disable-next-line react-refresh/only-export-components
export function getVisibleLoops(
  loops: LoopData[],
  viewRange: { start: number; end: number },
  totalSamples: number
): Array<{
  loop: LoopData;
  startPosition: number; // 0-1 normalized position of in-point in view
  endPosition: number; // 0-1 normalized position of out-point in view
  visibleStart: number; // Clamped start position (0 if extends before view)
  visibleEnd: number; // Clamped end position (1 if extends past view)
}> {
  if (totalSamples <= 0) {
    return [];
  }

  const viewStartSample = Math.floor(viewRange.start * totalSamples);
  const viewEndSample = Math.ceil(viewRange.end * totalSamples);
  const viewWidth = viewEndSample - viewStartSample;

  const visibleLoops: Array<{
    loop: LoopData;
    startPosition: number;
    endPosition: number;
    visibleStart: number;
    visibleEnd: number;
  }> = [];

  for (const loop of loops) {
    const loopInSample = loop.inPoint;
    const loopOutSample = loop.outPoint;

    // Check if loop overlaps with view range
    // Loop is visible if: in-point < viewEnd AND out-point > viewStart
    if (loopInSample < viewEndSample && loopOutSample > viewStartSample) {
      // Calculate normalized positions within view
      const startPosition = (loopInSample - viewStartSample) / viewWidth;
      const endPosition = (loopOutSample - viewStartSample) / viewWidth;

      // Clamp visible positions to 0-1 range
      const visibleStart = Math.max(0, startPosition);
      const visibleEnd = Math.min(1, endPosition);

      visibleLoops.push({
        loop,
        startPosition,
        endPosition,
        visibleStart,
        visibleEnd,
      });
    }
  }

  return visibleLoops;
}

/**
 * LoopRegionOverlay component for rendering loop regions over the waveform.
 *
 * Renders bracketed regions for each loop within the current view range.
 * Active loops have pulsing borders in Engine Green.
 *
 * @example
 * ```tsx
 * <LoopRegionOverlay
 *   loops={deck.loops}
 *   viewRange={{ start: 0.2, end: 0.4 }}
 *   totalSamples={10000000}
 *   height={128}
 *   samplesPerBeat={22050}
 *   onLoopClick={(index) => toggleLoop(index)}
 * />
 * ```
 */
export function LoopRegionOverlay({
  loops,
  viewRange,
  totalSamples,
  height,
  samplesPerBeat,
  onLoopClick,
  onLoopContextMenu,
}: LoopRegionOverlayProps) {
  // Calculate visible loops with memoization
  const visibleLoops = useMemo(() => {
    return getVisibleLoops(loops, viewRange, totalSamples);
  }, [loops, viewRange, totalSamples]);

  // Don't render if no visible loops
  if (visibleLoops.length === 0) {
    return null;
  }

  return (
    <div
      className="loop-region-overlay absolute inset-0 pointer-events-none"
      style={{ height: `${height}px` }}
    >
      {visibleLoops.map(({ loop, visibleStart, visibleEnd }) => {
        const colorHex = CUE_COLOR_HEX[loop.color];
        const loopWidth = visibleEnd - visibleStart;
        const loopLabel = calculateLoopLengthLabel(loop, samplesPerBeat);

        return (
          <div
            key={loop.index}
            className={`absolute top-0 bottom-0 pointer-events-auto cursor-pointer ${
              loop.isActive ? 'loop-active' : ''
            }`}
            style={{
              left: `${visibleStart * 100}%`,
              width: `${loopWidth * 100}%`,
              backgroundColor: `${colorHex}20`, // 20% opacity fill
              borderLeft: visibleStart > 0 ? `2px solid ${colorHex}` : 'none',
              borderRight: visibleEnd < 1 ? `2px solid ${colorHex}` : 'none',
              borderTop: `1px solid ${colorHex}40`,
              borderBottom: `1px solid ${colorHex}40`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onLoopClick?.(loop.index);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onLoopContextMenu?.(loop.index, e);
            }}
          >
            {/* In-point bracket marker */}
            {visibleStart === (loop.inPoint - viewRange.start * totalSamples) /
              ((viewRange.end - viewRange.start) * totalSamples) && (
              <div
                className="absolute top-0 left-0 w-2"
                style={{
                  height: '8px',
                  borderLeft: `2px solid ${colorHex}`,
                  borderTop: `2px solid ${colorHex}`,
                }}
              />
            )}

            {/* Out-point bracket marker */}
            {visibleEnd === (loop.outPoint - viewRange.start * totalSamples) /
              ((viewRange.end - viewRange.start) * totalSamples) && (
              <div
                className="absolute top-0 right-0 w-2"
                style={{
                  height: '8px',
                  borderRight: `2px solid ${colorHex}`,
                  borderTop: `2px solid ${colorHex}`,
                }}
              />
            )}

            {/* Loop label (length) */}
            <div
              className="absolute top-1 left-1/2 -translate-x-1/2 whitespace-nowrap px-1"
              style={{
                color: colorHex,
                textShadow: '0 0 2px #000, 0 0 4px #000',
                fontSize: '10px',
                fontWeight: 'bold',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                borderRadius: '2px',
              }}
            >
              {loopLabel}
            </div>

            {/* Loop name (if set) */}
            {loop.name && (
              <div
                className="absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap px-1"
                style={{
                  color: colorHex,
                  textShadow: '0 0 2px #000, 0 0 4px #000',
                  fontSize: '9px',
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  borderRadius: '2px',
                }}
              >
                {loop.name}
              </div>
            )}

            {/* Active loop indicator (pulsing border) */}
            {loop.isActive && (
              <div
                className="absolute inset-0 loop-pulse"
                style={{
                  border: `2px solid ${colorHex}`,
                  boxShadow: `0 0 8px ${colorHex}, inset 0 0 8px ${colorHex}40`,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
