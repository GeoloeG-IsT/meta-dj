/**
 * PerformancePads - 8 Hot Cue Performance Pads
 *
 * Displays 8 pad buttons for setting and triggering hot cue points.
 * Supports keyboard shortcuts (1-8) and mouse interaction.
 *
 * Story 2.4: Hot Cue & Loop Management
 */

import { useCallback, useEffect, useRef } from 'react';
import type { HotCueData } from '../types/cue-loop';
import { CUE_COLOR_HEX } from '../types/cue-loop';

export interface PerformancePadsProps {
  /** Hot cue data array (8 slots) */
  cuePoints: HotCueData[];
  /** Callback when a pad is clicked (set cue if empty, trigger if set) */
  onPadClick: (padIndex: number) => void;
  /** Callback when a pad is right-clicked (context menu) */
  onPadContextMenu?: (padIndex: number, event: React.MouseEvent) => void;
  /** Whether keyboard shortcuts are enabled */
  keyboardEnabled?: boolean;
  /** Whether the component should capture keyboard focus */
  autoFocus?: boolean;
  /** CSS class name */
  className?: string;
}

/**
 * Keyboard shortcut mappings for pads 1-8.
 * Uses number keys 1-8 on the main keyboard.
 */
const PAD_SHORTCUTS: Record<string, number> = {
  '1': 0,
  '2': 1,
  '3': 2,
  '4': 3,
  '5': 4,
  '6': 5,
  '7': 6,
  '8': 7,
};

/**
 * PerformancePads component for hot cue control.
 *
 * Features:
 * - 8 pad buttons in a 2x4 grid
 * - Shows pad number and cue color
 * - Empty state for unassigned pads
 * - Keyboard shortcuts (1-8 keys)
 * - Right-click for context menu
 *
 * @example
 * ```tsx
 * <PerformancePads
 *   cuePoints={deck.cuePoints}
 *   onPadClick={(index) => triggerOrSetCue(index)}
 *   onPadContextMenu={(index, event) => showCueMenu(index, event)}
 *   keyboardEnabled={true}
 * />
 * ```
 */
export function PerformancePads({
  cuePoints,
  onPadClick,
  onPadContextMenu,
  keyboardEnabled = true,
  autoFocus = false,
  className = '',
}: PerformancePadsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!keyboardEnabled) return;

      // Check if the event target is an input or contenteditable element
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      const padIndex = PAD_SHORTCUTS[event.key];
      if (padIndex !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        onPadClick(padIndex);
      }
    },
    [keyboardEnabled, onPadClick]
  );

  // Add global keyboard listener
  useEffect(() => {
    if (!keyboardEnabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardEnabled, handleKeyDown]);

  // Auto-focus on mount if requested
  useEffect(() => {
    if (autoFocus && containerRef.current) {
      containerRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div
      ref={containerRef}
      className={`performance-pads grid grid-cols-4 gap-1 ${className}`}
      tabIndex={autoFocus ? 0 : -1}
      role="group"
      aria-label="Hot cue performance pads"
    >
      {cuePoints.map((cue, index) => {
        const padNumber = index + 1;
        const colorHex = CUE_COLOR_HEX[cue.color];
        const isEmpty = !cue.isSet;

        return (
          <button
            key={index}
            type="button"
            className={`
              performance-pad
              relative flex flex-col items-center justify-center
              min-h-[44px] min-w-[44px]
              rounded-md
              transition-all duration-75
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black
              ${isEmpty ? 'hover:bg-zinc-700' : 'hover:brightness-110'}
            `}
            style={{
              backgroundColor: isEmpty ? '#1f1f1f' : `${colorHex}20`,
              border: isEmpty
                ? '1px dashed #404040'
                : `2px solid ${colorHex}`,
              color: isEmpty ? '#666' : colorHex,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onPadClick(index);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPadContextMenu?.(index, e);
            }}
            aria-label={
              isEmpty
                ? `Pad ${padNumber}: Empty (press to set cue)`
                : `Pad ${padNumber}: ${cue.name || 'Cue'} (press to trigger)`
            }
          >
            {/* Pad number */}
            <span
              className="text-sm font-bold"
              style={{
                textShadow: isEmpty ? 'none' : '0 0 4px currentColor',
              }}
            >
              {padNumber}
            </span>

            {/* Cue name (if set and has name) */}
            {cue.isSet && cue.name && (
              <span
                className="text-xs truncate max-w-full px-1"
                style={{
                  color: colorHex,
                }}
              >
                {cue.name}
              </span>
            )}

            {/* Empty indicator */}
            {isEmpty && (
              <span className="text-xs text-zinc-500">—</span>
            )}

            {/* Keyboard shortcut hint */}
            <span
              className="absolute top-0.5 right-0.5 text-xs opacity-30"
              aria-hidden="true"
            >
              {padNumber}
            </span>
          </button>
        );
      })}
    </div>
  );
}
