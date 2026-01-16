/**
 * LoopControls - Loop Management UI
 *
 * Provides controls for setting loop in/out points, selecting loop length,
 * and activating/deactivating loop playback.
 *
 * Story 2.4: Hot Cue & Loop Management
 */

import { useCallback, useEffect } from 'react';
import type { LoopData } from '../types/cue-loop';
import { CUE_COLOR_HEX, DEFAULT_CUE_COLOR } from '../types/cue-loop';

export interface LoopControlsProps {
  /** Current loop data (if active) */
  activeLoop: LoopData | null;
  /** All stored loops */
  loops: LoopData[];
  /** Current playhead position in samples */
  currentPositionSamples: number;
  /** Samples per beat (for loop length calculations) */
  samplesPerBeat: number;
  /** BPM of the track */
  bpm: number;
  /** Callback when loop in point is set */
  onSetLoopIn: (samplePosition: number) => void;
  /** Callback when loop out point is set (creates/updates loop) */
  onSetLoopOut: (samplePosition: number) => void;
  /** Callback when loop is toggled on/off */
  onToggleLoop: () => void;
  /** Callback when a specific loop length is selected (auto-creates loop) */
  onSetLoopLength: (beats: number) => void;
  /** Whether keyboard shortcuts are enabled */
  keyboardEnabled?: boolean;
  /** CSS class name */
  className?: string;
}

/**
 * Available loop lengths in beats.
 * Represents standard DJ loop divisions.
 */
const LOOP_LENGTHS = [
  { beats: 0.25, label: '1/4' },
  { beats: 0.5, label: '1/2' },
  { beats: 1, label: '1' },
  { beats: 2, label: '2' },
  { beats: 4, label: '4' },
  { beats: 8, label: '8' },
  { beats: 16, label: '16' },
] as const;

/**
 * LoopControls component for loop management.
 *
 * Features:
 * - Loop In / Loop Out buttons for manual loop setting
 * - Loop length buttons for quick loop creation
 * - Visual feedback for active loop state
 * - L key shortcut for toggling loop
 *
 * @example
 * ```tsx
 * <LoopControls
 *   activeLoop={deck.activeLoopIndex >= 0 ? deck.loops.find(l => l.isActive) : null}
 *   loops={deck.loops}
 *   currentPositionSamples={playheadSamples}
 *   samplesPerBeat={22050}
 *   bpm={128}
 *   onSetLoopIn={(pos) => setLoopInPoint(pos)}
 *   onSetLoopOut={(pos) => setLoopOutPoint(pos)}
 *   onToggleLoop={() => toggleLoop()}
 *   onSetLoopLength={(beats) => createLoop(beats)}
 * />
 * ```
 */
export function LoopControls({
  activeLoop,
  loops,
  currentPositionSamples,
  samplesPerBeat,
  bpm,
  onSetLoopIn,
  onSetLoopOut,
  onToggleLoop,
  onSetLoopLength,
  keyboardEnabled = true,
  className = '',
}: LoopControlsProps) {
  const isLoopActive = activeLoop !== null && activeLoop.isActive;
  const loopColor = activeLoop?.color ?? DEFAULT_CUE_COLOR;
  const loopColorHex = CUE_COLOR_HEX[loopColor];

  // Calculate active loop length in beats for display
  const activeLoopBeats = activeLoop
    ? (activeLoop.outPoint - activeLoop.inPoint) / samplesPerBeat
    : 0;

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!keyboardEnabled) return;

      // Check if the event target is an input element
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      if (event.key === 'l' || event.key === 'L') {
        event.preventDefault();
        event.stopPropagation();
        onToggleLoop();
      }
    },
    [keyboardEnabled, onToggleLoop]
  );

  // Add global keyboard listener
  useEffect(() => {
    if (!keyboardEnabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardEnabled, handleKeyDown]);

  return (
    <div className={`loop-controls ${className}`}>
      {/* Loop In/Out/Active Controls */}
      <div className="flex items-center gap-2 mb-2">
        {/* Loop In Button */}
        <button
          type="button"
          className={`
            flex-1 px-2 py-1.5 text-xs font-bold uppercase
            rounded border transition-all
            ${
              activeLoop
                ? 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:bg-zinc-700'
                : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:bg-zinc-800'
            }
          `}
          onClick={() => onSetLoopIn(currentPositionSamples)}
          title="Set loop in point at current position"
        >
          IN
        </button>

        {/* Loop Out Button */}
        <button
          type="button"
          className={`
            flex-1 px-2 py-1.5 text-xs font-bold uppercase
            rounded border transition-all
            ${
              activeLoop
                ? 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:bg-zinc-700'
                : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:bg-zinc-800'
            }
          `}
          onClick={() => onSetLoopOut(currentPositionSamples)}
          title="Set loop out point at current position"
        >
          OUT
        </button>

        {/* Loop Active Toggle */}
        <button
          type="button"
          className={`
            flex-1 px-2 py-1.5 text-xs font-bold uppercase
            rounded border transition-all
            ${
              isLoopActive
                ? 'border-2'
                : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:bg-zinc-800'
            }
          `}
          style={
            isLoopActive
              ? {
                  backgroundColor: `${loopColorHex}20`,
                  borderColor: loopColorHex,
                  color: loopColorHex,
                  boxShadow: `0 0 8px ${loopColorHex}40`,
                }
              : undefined
          }
          onClick={onToggleLoop}
          title="Toggle loop playback (L)"
          aria-label={isLoopActive ? 'Deactivate loop' : 'Activate loop'}
        >
          {isLoopActive ? 'ACTIVE' : 'LOOP'}
        </button>
      </div>

      {/* Loop Length Selector */}
      <div className="flex items-center gap-1">
        {LOOP_LENGTHS.map(({ beats, label }) => {
          const isCurrentLength =
            isLoopActive && Math.abs(activeLoopBeats - beats) < 0.1;

          return (
            <button
              key={beats}
              type="button"
              className={`
                flex-1 px-1 py-1 text-xs font-mono
                rounded border transition-all
                ${
                  isCurrentLength
                    ? 'border-2'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-600'
                }
              `}
              style={
                isCurrentLength
                  ? {
                      backgroundColor: `${loopColorHex}20`,
                      borderColor: loopColorHex,
                      color: loopColorHex,
                    }
                  : undefined
              }
              onClick={() => onSetLoopLength(beats)}
              title={`Create ${label} beat loop at current position`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Active Loop Info */}
      {isLoopActive && activeLoop && (
        <div
          className="mt-2 px-2 py-1 text-xs font-mono rounded"
          style={{
            backgroundColor: `${loopColorHex}10`,
            color: loopColorHex,
            border: `1px solid ${loopColorHex}40`,
          }}
        >
          <span className="opacity-60">Loop:</span>{' '}
          {formatLoopLength(activeLoopBeats)}
          {activeLoop.name && (
            <>
              {' • '}
              <span className="opacity-80">{activeLoop.name}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Format loop length for display.
 */
function formatLoopLength(beats: number): string {
  if (beats >= 4) {
    const bars = beats / 4;
    return bars === 1 ? '1 bar' : `${bars} bars`;
  } else if (beats >= 1) {
    return beats === 1 ? '1 beat' : `${beats} beats`;
  } else if (beats >= 0.5) {
    return '1/2 beat';
  } else if (beats >= 0.25) {
    return '1/4 beat';
  } else {
    return `${beats.toFixed(2)} beats`;
  }
}
