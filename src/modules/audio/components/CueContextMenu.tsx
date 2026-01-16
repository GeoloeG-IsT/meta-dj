/**
 * CueContextMenu - Context menu for managing cue points and loops
 *
 * Provides color picker, name editor, and delete functionality
 * for hot cue points and loops.
 *
 * Story 2.4: Hot Cue & Loop Management
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import type { CueColor, HotCueData, LoopData } from '../types/cue-loop';
import { CUE_COLOR_HEX } from '../types/cue-loop';

export interface CueContextMenuProps {
  /** Whether the menu is open */
  isOpen: boolean;
  /** Position to render the menu at */
  position: { x: number; y: number };
  /** Type of item being edited */
  type: 'cue' | 'loop';
  /** Current cue data (if type is 'cue') */
  cueData?: HotCueData;
  /** Current loop data (if type is 'loop') */
  loopData?: LoopData;
  /** Callback when color is changed */
  onColorChange: (color: CueColor) => void;
  /** Callback when name is changed */
  onNameChange: (name: string) => void;
  /** Callback when item is deleted */
  onDelete: () => void;
  /** Callback when menu is closed */
  onClose: () => void;
}

/**
 * All available colors in the Engine DJ palette.
 */
const COLORS: CueColor[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'cyan',
  'blue',
  'purple',
  'pink',
];

/**
 * Minimum hold duration for delete confirmation (ms).
 */
const HOLD_TO_DELETE_MS = 800;

/**
 * CueContextMenu component for cue/loop management.
 *
 * Features:
 * - 8-color Engine DJ palette picker
 * - Inline name editor with blur-to-save
 * - Hold-to-delete confirmation pattern
 * - Positioned at right-click location
 *
 * @example
 * ```tsx
 * <CueContextMenu
 *   isOpen={menuOpen}
 *   position={{ x: 100, y: 200 }}
 *   type="cue"
 *   cueData={selectedCue}
 *   onColorChange={(color) => updateCueColor(color)}
 *   onNameChange={(name) => updateCueName(name)}
 *   onDelete={() => deleteCue()}
 *   onClose={() => setMenuOpen(false)}
 * />
 * ```
 */
export function CueContextMenu({
  isOpen,
  position,
  type,
  cueData,
  loopData,
  onColorChange,
  onNameChange,
  onDelete,
  onClose,
}: CueContextMenuProps) {
  const data = type === 'cue' ? cueData : loopData;
  const currentColor = data?.color ?? 'green';
  const currentName = data?.name ?? '';

  // Local state for name editing
  const [editName, setEditName] = useState(currentName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Hold-to-delete state
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStartRef = useRef<number>(0);

  // Sync edit name with data when menu opens
  useEffect(() => {
    if (isOpen) {
      setEditName(currentName);
      setHoldProgress(0);
    }
  }, [isOpen, currentName]);

  // Handle name save on blur or enter
  const handleNameSave = useCallback(() => {
    const trimmedName = editName.trim();
    if (trimmedName !== currentName) {
      onNameChange(trimmedName);
    }
  }, [editName, currentName, onNameChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleNameSave();
        nameInputRef.current?.blur();
      } else if (e.key === 'Escape') {
        setEditName(currentName);
        nameInputRef.current?.blur();
      }
    },
    [handleNameSave, currentName]
  );

  // Hold-to-delete handlers
  const handleDeleteMouseDown = useCallback(() => {
    holdStartRef.current = Date.now();
    setHoldProgress(0);

    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min(elapsed / HOLD_TO_DELETE_MS, 1);
      setHoldProgress(progress);

      if (progress >= 1) {
        if (holdTimerRef.current) {
          clearInterval(holdTimerRef.current);
          holdTimerRef.current = null;
        }
        onDelete();
        onClose();
      }
    }, 16);
  }, [onDelete, onClose]);

  const handleDeleteMouseUp = useCallback(() => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHoldProgress(0);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearInterval(holdTimerRef.current);
      }
    };
  }, []);

  if (!isOpen || !data) {
    return null;
  }

  const itemLabel = type === 'cue' ? `Cue ${(data.index ?? 0) + 1}` : `Loop ${(data.index ?? 0) + 1}`;

  return (
    <Popover>
      {/* Invisible button at click position to anchor the popover */}
      <PopoverButton
        as="div"
        className="fixed pointer-events-none"
        style={{
          left: position.x,
          top: position.y,
          width: 1,
          height: 1,
        }}
      />

      <PopoverPanel
        static
        className="fixed z-50 w-56 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-3"
        style={{
          left: position.x,
          top: position.y,
          transform: 'translate(-8px, 8px)',
        }}
      >
        {/* Backdrop to close menu on outside click */}
        <div className="fixed inset-0 -z-10" onClick={onClose} />

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-sm font-bold"
            style={{ color: CUE_COLOR_HEX[currentColor] }}
          >
            {itemLabel}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Color Picker */}
        <div className="mb-3">
          <div className="text-xs text-zinc-500 mb-1.5">Color</div>
          <div className="grid grid-cols-8 gap-1">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`
                  w-6 h-6 rounded-full transition-all
                  ${currentColor === color ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-900' : ''}
                  hover:scale-110
                `}
                style={{ backgroundColor: CUE_COLOR_HEX[color] }}
                onClick={() => onColorChange(color)}
                aria-label={`Select ${color} color`}
              />
            ))}
          </div>
        </div>

        {/* Name Editor */}
        <div className="mb-3">
          <label className="text-xs text-zinc-500 mb-1.5 block">Name</label>
          <input
            ref={nameInputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={handleKeyDown}
            placeholder="Enter name..."
            className="
              w-full px-2 py-1.5 text-sm
              bg-zinc-800 border border-zinc-700 rounded
              text-zinc-200 placeholder:text-zinc-600
              focus:outline-none focus:border-[#4DFA90]
            "
            maxLength={32}
          />
        </div>

        {/* Delete Button (Hold to Confirm) */}
        <div className="border-t border-zinc-700 pt-3 mt-3">
          <button
            type="button"
            className="
              w-full relative px-3 py-2 text-sm font-medium
              bg-zinc-800 border border-red-500/30 rounded
              text-red-400 hover:bg-red-500/10
              transition-colors overflow-hidden
            "
            onMouseDown={handleDeleteMouseDown}
            onMouseUp={handleDeleteMouseUp}
            onMouseLeave={handleDeleteMouseUp}
            aria-label={`Hold to delete ${type}`}
          >
            {/* Progress fill */}
            <div
              className="absolute inset-0 bg-red-500/30"
              style={{
                width: `${holdProgress * 100}%`,
                transition: holdProgress === 0 ? 'width 0.1s' : 'none',
              }}
            />
            <span className="relative">
              {holdProgress > 0 ? 'Release to cancel...' : 'Hold to delete'}
            </span>
          </button>
        </div>
      </PopoverPanel>
    </Popover>
  );
}
