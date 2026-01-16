/**
 * StemsUnavailable Component
 *
 * Displayed when WebGPU is not available and stems feature cannot be used.
 * Per architecture decision: NO WASM/CPU fallback is provided.
 */

import { AlertTriangle } from 'lucide-react';

export interface StemsUnavailableProps {
  /** Detailed reason why stems are unavailable */
  reason?: string;
  /** Whether to show in compact mode (for deck UI) */
  compact?: boolean;
}

export function StemsUnavailable({ reason, compact = false }: StemsUnavailableProps) {
  if (compact) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-500"
        role="img"
        aria-label="Stems feature unavailable"
      >
        <AlertTriangle size={14} className="text-amber-500" />
        <span>Stems require WebGPU</span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center gap-3 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800"
      role="alert"
      aria-live="polite"
    >
      <AlertTriangle size={24} className="text-amber-500" />
      <div className="text-center">
        <p className="text-sm font-medium text-zinc-300">
          Stems require WebGPU
        </p>
        {reason && (
          <p className="mt-1 text-xs text-zinc-500 max-w-[280px]">
            {reason}
          </p>
        )}
      </div>
      <a
        href="https://caniuse.com/webgpu"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-cyan-400 hover:text-cyan-300 underline"
      >
        Check browser compatibility
      </a>
    </div>
  );
}
