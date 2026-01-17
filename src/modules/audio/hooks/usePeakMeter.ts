/**
 * usePeakMeter - React hook for reading peak meter data
 *
 * Reads peak and RMS values from SharedArrayBuffer at ~60Hz
 * for VU meter rendering in the UI.
 *
 * Usage:
 * ```tsx
 * function VUMeter({ deckId }: { deckId: DeckId }) {
 *   const { peak, rms } = usePeakMeter(deckId);
 *
 *   return (
 *     <div className="vu-meter">
 *       <div className="peak-bar" style={{ height: `${peak * 100}%` }} />
 *       <div className="rms-bar" style={{ height: `${rms * 100}%` }} />
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useRef } from 'react';
import type { DeckId } from '../types';
import { MeterReader, type MeterData } from '../dsp/peak-meter';

/** Options for usePeakMeter hook */
export interface UsePeakMeterOptions {
  /** Update rate in Hz (default: 60) */
  updateRate?: number;
  /** Decay rate for peak hold (0-1, default: 0.95) */
  peakDecay?: number;
}

const DEFAULT_OPTIONS: Required<UsePeakMeterOptions> = {
  updateRate: 60,
  peakDecay: 0.95,
};

/**
 * Hook for reading deck peak meter data from SharedArrayBuffer
 *
 * @param deckId - Deck to monitor ('A', 'B', 'C', 'D')
 * @param sab - SharedArrayBuffer containing meter data
 * @param options - Update rate and decay options
 * @returns Current peak and RMS values
 */
export function usePeakMeter(
  deckId: DeckId,
  sab: SharedArrayBuffer | null,
  options?: UsePeakMeterOptions
): MeterData {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [meterData, setMeterData] = useState<MeterData>({ peak: 0, rms: 0 });
  const readerRef = useRef<MeterReader | null>(null);
  const animationFrameRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!sab) {
      return;
    }

    // Create reader if not exists or SAB changed
    readerRef.current = new MeterReader(sab);

    const intervalMs = 1000 / opts.updateRate;

    const update = (timestamp: number) => {
      if (timestamp - lastUpdateRef.current >= intervalMs) {
        lastUpdateRef.current = timestamp;

        if (readerRef.current) {
          const data = readerRef.current.getDeckMeter(deckId);
          setMeterData(data);
        }
      }

      animationFrameRef.current = requestAnimationFrame(update);
    };

    animationFrameRef.current = requestAnimationFrame(update);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [deckId, sab, opts.updateRate]);

  return meterData;
}

/**
 * Hook for reading master peak meter data from SharedArrayBuffer
 *
 * @param sab - SharedArrayBuffer containing meter data
 * @param options - Update rate and decay options
 * @returns Current peak and RMS values
 */
export function useMasterPeakMeter(
  sab: SharedArrayBuffer | null,
  options?: UsePeakMeterOptions
): MeterData {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [meterData, setMeterData] = useState<MeterData>({ peak: 0, rms: 0 });
  const readerRef = useRef<MeterReader | null>(null);
  const animationFrameRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!sab) {
      return;
    }

    // Create reader if not exists or SAB changed
    readerRef.current = new MeterReader(sab);

    const intervalMs = 1000 / opts.updateRate;

    const update = (timestamp: number) => {
      if (timestamp - lastUpdateRef.current >= intervalMs) {
        lastUpdateRef.current = timestamp;

        if (readerRef.current) {
          const data = readerRef.current.getMasterMeter();
          setMeterData(data);
        }
      }

      animationFrameRef.current = requestAnimationFrame(update);
    };

    animationFrameRef.current = requestAnimationFrame(update);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [sab, opts.updateRate]);

  return meterData;
}
