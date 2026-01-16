/**
 * LoopModeToggle - Toggle between Hot Loop and Saved Loop modes
 *
 * Provides a segmented control to switch between loop pad modes.
 * Keyboard shortcut: Shift+L to toggle mode.
 *
 * Story 5.6: Implement 8-Loop System (Hot Loops + Saved Loops)
 */

import { useCallback, useEffect } from 'react';
import type { LoopMode } from '../types/cue-loop';

export interface LoopModeToggleProps {
  /** Current loop mode */
  mode: LoopMode;
  /** Callback when mode changes */
  onModeChange: (mode: LoopMode) => void;
  /** Whether keyboard shortcuts are enabled */
  keyboardEnabled?: boolean;
  /** CSS class name */
  className?: string;
}

/**
 * LoopModeToggle component for switching between hot and saved loop modes.
 *
 * Features:
 * - Segmented control with [HOT] [SAVED] buttons
 * - Visual indication of current mode
 * - Shift+L keyboard shortcut to toggle
 *
 * @example
 * ```tsx
 * <LoopModeToggle
 *   mode={deck.loopMode}
 *   onModeChange={(mode) => setLoopMode(deckId, mode)}
 *   keyboardEnabled={true}
 * />
 * ```
 */
export function LoopModeToggle({
  mode,
  onModeChange,
  keyboardEnabled = true,
  className = '',
}: LoopModeToggleProps) {
  // Handle keyboard shortcut (Shift+L to toggle mode)
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

      // Shift+L toggles mode
      if (event.shiftKey && (event.key === 'l' || event.key === 'L')) {
        event.preventDefault();
        event.stopPropagation();
        onModeChange(mode === 'hot' ? 'saved' : 'hot');
      }
    },
    [keyboardEnabled, mode, onModeChange]
  );

  // Add global keyboard listener
  useEffect(() => {
    if (!keyboardEnabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardEnabled, handleKeyDown]);

  return (
    <div
      className={`loop-mode-toggle flex items-center gap-0.5 ${className}`}
      role="radiogroup"
      aria-label="Loop mode"
    >
      {/* HOT mode button */}
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'hot'}
        className={`
          px-2 py-1 text-xs font-bold uppercase
          rounded-l border transition-all
          ${
            mode === 'hot'
              ? 'bg-orange-500/20 border-orange-500 text-orange-400'
              : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:bg-zinc-800 hover:border-zinc-600'
          }
        `}
        onClick={() => onModeChange('hot')}
        title="Hot Loop mode: Press and hold to loop (Shift+L to toggle)"
      >
        HOT
      </button>

      {/* SAVED mode button */}
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'saved'}
        className={`
          px-2 py-1 text-xs font-bold uppercase
          rounded-r border transition-all
          ${
            mode === 'saved'
              ? 'bg-[#4DFA90]/20 border-[#4DFA90] text-[#4DFA90]'
              : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:bg-zinc-800 hover:border-zinc-600'
          }
        `}
        onClick={() => onModeChange('saved')}
        title="Saved Loop mode: Click to trigger saved loops (Shift+L to toggle)"
      >
        SAVED
      </button>

      {/* Keyboard hint */}
      <span className="ml-1 text-[10px] text-zinc-600" aria-hidden="true">
        ⇧L
      </span>
    </div>
  );
}
