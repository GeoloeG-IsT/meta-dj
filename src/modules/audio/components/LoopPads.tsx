/**
 * LoopPads - 8 Loop Performance Pads
 *
 * Displays 8 pad buttons for triggering and managing loop slots.
 * Supports two modes: Hot Loop (press-and-hold) and Saved Loop (click-to-trigger).
 * Keyboard shortcuts: Alt+1 through Alt+8 (to avoid conflict with hot cue shortcuts).
 *
 * Story 5.6: Implement 8-Loop System (Hot Loops + Saved Loops)
 */

import { useCallback, useEffect, useMemo } from 'react';
import type { LoopData, LoopMode } from '../types/cue-loop';
import { CUE_COLOR_HEX, DEFAULT_CUE_COLOR } from '../types/cue-loop';

export interface LoopPadsProps {
  /** Loop data array (up to 8 slots) */
  loops: LoopData[];
  /** Currently active loop index (-1 if none) */
  activeLoopIndex: number;
  /** Current loop mode */
  loopMode: LoopMode;
  /** Callback when a pad is clicked (saved mode) or pressed (hot mode) */
  onPadClick: (padIndex: number) => void;
  /** Callback when a pad is released (hot mode only) */
  onPadRelease?: (padIndex: number) => void;
  /** Callback when a pad is right-clicked (context menu) */
  onPadContextMenu?: (padIndex: number, event: React.MouseEvent) => void;
  /** Whether keyboard shortcuts are enabled */
  keyboardEnabled?: boolean;
  /** CSS class name */
  className?: string;
}

/**
 * Keyboard shortcut mappings for loop pads 1-8.
 * Uses Alt+1-8 to avoid conflict with hot cue shortcuts (1-8).
 */
const LOOP_PAD_SHORTCUTS: Record<string, number> = {
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
 * LoopPads component for loop slot control.
 *
 * Features:
 * - 8 pad buttons in a grid layout
 * - Shows pad number and loop color
 * - Empty state for unassigned pads
 * - Active loop glow indication
 * - Alt+1-8 keyboard shortcuts
 * - Hot Loop mode: press-and-hold activation
 * - Saved Loop mode: click-to-trigger
 *
 * @example
 * ```tsx
 * <LoopPads
 *   loops={deck.loops}
 *   activeLoopIndex={deck.activeLoopIndex}
 *   loopMode={deck.loopMode}
 *   onPadClick={(index) => handleLoopPadClick(index)}
 *   onPadRelease={(index) => handleLoopPadRelease(index)}
 *   onPadContextMenu={(index, event) => showLoopMenu(index, event)}
 *   keyboardEnabled={true}
 * />
 * ```
 */
export function LoopPads({
  loops,
  activeLoopIndex,
  loopMode,
  onPadClick,
  onPadRelease,
  onPadContextMenu,
  keyboardEnabled = true,
  className = '',
}: LoopPadsProps) {
  // Create a map of loop index to loop data for quick lookup
  const loopMap = useMemo(() => {
    const map = new Map<number, LoopData>();
    for (const loop of loops) {
      map.set(loop.index, loop);
    }
    return map;
  }, [loops]);

  // Handle keyboard shortcuts (Alt+1-8)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!keyboardEnabled) return;

      // Only handle Alt+number combinations
      if (!event.altKey) return;

      // Check if the event target is an input element
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      const padIndex = LOOP_PAD_SHORTCUTS[event.key];
      if (padIndex !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        onPadClick(padIndex);
      }
    },
    [keyboardEnabled, onPadClick]
  );

  // Handle keyboard release for hot loop mode
  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      if (!keyboardEnabled || loopMode !== 'hot' || !onPadRelease) return;

      // Only handle Alt+number combinations
      if (!event.altKey) return;

      const padIndex = LOOP_PAD_SHORTCUTS[event.key];
      if (padIndex !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        onPadRelease(padIndex);
      }
    },
    [keyboardEnabled, loopMode, onPadRelease]
  );

  // Add global keyboard listeners
  useEffect(() => {
    if (!keyboardEnabled) return;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [keyboardEnabled, handleKeyDown, handleKeyUp]);

  // Render 8 loop pads
  const pads = useMemo(() => {
    return Array.from({ length: 8 }, (_, index) => {
      const loop = loopMap.get(index);
      const padNumber = index + 1;
      const isEmpty = !loop;
      const isActive = activeLoopIndex === index;
      const colorHex = loop ? CUE_COLOR_HEX[loop.color] : CUE_COLOR_HEX[DEFAULT_CUE_COLOR];

      return {
        index,
        padNumber,
        loop,
        isEmpty,
        isActive,
        colorHex,
      };
    });
  }, [loopMap, activeLoopIndex]);

  return (
    <div
      className={`loop-pads grid grid-cols-8 gap-1 ${className}`}
      role="group"
      aria-label="Loop performance pads"
    >
      {pads.map(({ index, padNumber, loop, isEmpty, isActive, colorHex }) => (
        <button
          key={index}
          type="button"
          className={`
            loop-pad
            relative flex flex-col items-center justify-center
            min-h-[44px] min-w-[44px]
            rounded-md
            transition-all duration-75
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black
            ${isEmpty ? 'hover:bg-zinc-700' : 'hover:brightness-110'}
            ${isActive ? 'ring-2 ring-offset-1 ring-offset-black' : ''}
          `}
          style={{
            backgroundColor: isEmpty
              ? '#1f1f1f'
              : isActive
                ? `${colorHex}40`
                : `${colorHex}20`,
            border: isEmpty
              ? '1px dashed #404040'
              : isActive
                ? `2px solid ${colorHex}`
                : `1px solid ${colorHex}80`,
            color: isEmpty ? '#666' : colorHex,
            boxShadow: isActive ? `0 0 12px ${colorHex}60` : 'none',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onPadClick(index);
          }}
          onMouseDown={(e) => {
            // For hot loop mode, trigger on mouse down
            if (loopMode === 'hot' && e.button === 0) {
              e.stopPropagation();
              // Click handler already fires, no need to duplicate
            }
          }}
          onMouseUp={(e) => {
            // For hot loop mode, release on mouse up
            if (loopMode === 'hot' && e.button === 0 && onPadRelease) {
              e.stopPropagation();
              onPadRelease(index);
            }
          }}
          onMouseLeave={(e) => {
            // For hot loop mode, also release if mouse leaves while pressed
            if (loopMode === 'hot' && e.buttons === 1 && onPadRelease) {
              onPadRelease(index);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPadContextMenu?.(index, e);
          }}
          aria-label={
            isEmpty
              ? `Loop ${padNumber}: Empty (${loopMode === 'hot' ? 'press to create hot loop' : 'click to create loop'})`
              : isActive
                ? `Loop ${padNumber}: ${loop?.name || 'Active'} (${loopMode === 'hot' ? 'release to exit' : 'click to deactivate'})`
                : `Loop ${padNumber}: ${loop?.name || 'Saved'} (${loopMode === 'hot' ? 'press to activate' : 'click to jump and activate'})`
          }
        >
          {/* Loop icon indicator for set slots */}
          {!isEmpty && (
            <span
              className="absolute top-0.5 left-0.5 text-[8px] opacity-60"
              aria-hidden="true"
            >
              ⟳
            </span>
          )}

          {/* Pad number */}
          <span
            className="text-sm font-bold"
            style={{
              textShadow: isEmpty ? 'none' : isActive ? `0 0 8px ${colorHex}` : `0 0 4px ${colorHex}`,
            }}
          >
            {padNumber}
          </span>

          {/* Loop name (if set and has name) */}
          {loop?.name && (
            <span
              className="text-xs truncate max-w-full px-1"
              style={{
                color: colorHex,
              }}
            >
              {loop.name}
            </span>
          )}

          {/* Empty indicator */}
          {isEmpty && (
            <span className="text-xs text-zinc-500">—</span>
          )}

          {/* Active indicator */}
          {isActive && (
            <span
              className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-2 h-1 rounded-full"
              style={{ backgroundColor: colorHex }}
              aria-hidden="true"
            />
          )}

          {/* Keyboard shortcut hint */}
          <span
            className="absolute top-0.5 right-0.5 text-[8px] opacity-30"
            aria-hidden="true"
          >
            ⌥{padNumber}
          </span>
        </button>
      ))}
    </div>
  );
}
