/**
 * StemControls - Stem Separation Control UI
 *
 * Provides controls for muting/soloing individual stems (Vocals, Drums, Bass, Other)
 * and triggering stem analysis.
 *
 * Story 2.5: Client-Side Stem Separation (WebGPU)
 */

import { useCallback, useEffect } from 'react';
import { Mic, Drum, Music2, Piano, Loader2, X } from 'lucide-react';
import type { StemType, StemState, StemAnalysisStage } from '../types/stems';
import { STEM_COLORS, STEM_LABELS } from '../types/stems';
import { StemsUnavailable } from './StemsUnavailable';

export interface StemControlsProps {
  /** Current stem state */
  stemState: StemState;
  /** Whether WebGPU is available */
  hasWebGPU: boolean;
  /** Reason for WebGPU unavailability */
  webGPUUnavailableReason?: string | null;
  /** Callback when mute is toggled */
  onToggleMute: (stemType: StemType) => void;
  /** Callback when solo is toggled */
  onToggleSolo: (stemType: StemType) => void;
  /** Callback when analyze button is clicked */
  onAnalyzeStems: () => void;
  /** Callback when cancel button is clicked */
  onCancelAnalysis: () => void;
  /** Whether keyboard shortcuts are enabled */
  keyboardEnabled?: boolean;
  /** CSS class name */
  className?: string;
}

/** Stem button config */
const STEM_CONFIG: { type: StemType; icon: typeof Mic }[] = [
  { type: 'vocals', icon: Mic },
  { type: 'drums', icon: Drum },
  { type: 'bass', icon: Music2 },
  { type: 'other', icon: Piano },
];

/** Keyboard shortcuts for stems */
const STEM_SHORTCUTS: Record<string, StemType> = {
  v: 'vocals',
  d: 'drums',
  b: 'bass',
  o: 'other',
};

/**
 * StemControls component for stem separation control.
 *
 * Features:
 * - 4 stem buttons with mute/solo toggle
 * - Click = toggle mute, Shift+Click = toggle solo
 * - Analyze button when stems not available
 * - Progress bar during analysis
 * - Keyboard shortcuts (v, d, b, o for mute; Shift+key for solo)
 */
export function StemControls({
  stemState,
  hasWebGPU,
  webGPUUnavailableReason,
  onToggleMute,
  onToggleSolo,
  onAnalyzeStems,
  onCancelAnalysis,
  keyboardEnabled = true,
  className = '',
}: StemControlsProps) {
  const { available, analyzing, progress, stage, muted, solo } = stemState;

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!keyboardEnabled || !available) return;

      // Check if the event target is an input element
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      const stemType = STEM_SHORTCUTS[event.key.toLowerCase()];
      if (!stemType) return;

      event.preventDefault();
      event.stopPropagation();

      if (event.shiftKey) {
        onToggleSolo(stemType);
      } else {
        onToggleMute(stemType);
      }
    },
    [keyboardEnabled, available, onToggleMute, onToggleSolo]
  );

  // Add global keyboard listener
  useEffect(() => {
    if (!keyboardEnabled || !available) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardEnabled, available, handleKeyDown]);

  // If WebGPU not available, show unavailable message
  if (!hasWebGPU) {
    return (
      <div className={className}>
        <StemsUnavailable reason={webGPUUnavailableReason ?? undefined} compact />
      </div>
    );
  }

  // If analyzing, show progress
  if (analyzing) {
    return (
      <div className={`stem-controls ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
          <span className="text-xs text-zinc-300">
            {getStageLabel(stage)} ({progress}%)
          </span>
          <button
            type="button"
            className="ml-auto p-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800"
            onClick={onCancelAnalysis}
            title="Cancel stem analysis"
          >
            <X size={14} />
          </button>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // If stems not available, show analyze button
  if (!available) {
    return (
      <div className={`stem-controls ${className}`}>
        <button
          type="button"
          className="w-full px-3 py-2 text-sm font-medium rounded border
            bg-zinc-900 border-zinc-700 text-zinc-300
            hover:bg-zinc-800 hover:border-cyan-600 hover:text-cyan-400
            transition-all"
          onClick={onAnalyzeStems}
          title="Analyze and separate stems using AI"
        >
          Analyze Stems
        </button>
        <p className="mt-1 text-xs text-zinc-500 text-center">
          Separate vocals, drums, bass & other
        </p>
      </div>
    );
  }

  // Show stem controls
  return (
    <div className={`stem-controls ${className}`}>
      <div className="flex items-center gap-1">
        {STEM_CONFIG.map(({ type, icon: Icon }) => {
          const isMuted = muted[type];
          const isSoloed = solo === type;
          const isOtherSoloed = solo !== null && solo !== type;
          const color = STEM_COLORS[type];
          const label = STEM_LABELS[type];
          const shortcut = Object.entries(STEM_SHORTCUTS).find(
            ([_, t]) => t === type
          )?.[0];

          // Effective state: if another stem is soloed, this one is effectively muted
          const effectivelyMuted = isMuted || isOtherSoloed;

          return (
            <button
              key={type}
              type="button"
              className={`
                relative flex flex-col items-center justify-center
                flex-1 px-2 py-1.5 rounded border transition-all
                ${
                  effectivelyMuted
                    ? 'bg-zinc-900 border-zinc-800 opacity-40'
                    : 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800'
                }
                ${isSoloed ? 'border-2' : ''}
              `}
              style={
                isSoloed
                  ? {
                      borderColor: color,
                      backgroundColor: `${color}20`,
                      boxShadow: `0 0 8px ${color}40`,
                    }
                  : effectivelyMuted
                  ? undefined
                  : { borderColor: `${color}60` }
              }
              onClick={(e) => {
                if (e.shiftKey) {
                  onToggleSolo(type);
                } else {
                  onToggleMute(type);
                }
              }}
              title={`${label}: Click to mute, Shift+Click to solo (${shortcut?.toUpperCase()})`}
              aria-label={`${type} stem${isMuted ? ' (muted)' : ''}${isSoloed ? ' (solo)' : ''}`}
            >
              {/* Solo badge */}
              {isSoloed && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold
                    flex items-center justify-center rounded-full"
                  style={{ backgroundColor: color, color: '#000' }}
                >
                  S
                </span>
              )}

              {/* Icon */}
              <Icon
                size={16}
                className={effectivelyMuted ? 'text-zinc-600' : ''}
                style={effectivelyMuted ? undefined : { color }}
              />

              {/* Label */}
              <span
                className={`text-[10px] font-bold mt-0.5 ${
                  effectivelyMuted
                    ? 'text-zinc-600 line-through'
                    : 'text-zinc-300'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Help text */}
      <p className="mt-1 text-[10px] text-zinc-500 text-center">
        Click: mute | Shift+Click: solo
      </p>
    </div>
  );
}

/**
 * Get human-readable label for analysis stage.
 */
function getStageLabel(stage: StemAnalysisStage | null): string {
  switch (stage) {
    case 'loading_model':
      return 'Loading model';
    case 'preprocessing':
      return 'Preprocessing';
    case 'inference':
      return 'Separating';
    case 'postprocessing':
      return 'Finalizing';
    default:
      return 'Analyzing';
  }
}
