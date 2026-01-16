/**
 * WaveformDetail - Zoomed waveform view centered on playhead
 *
 * Displays a zoomed-in portion of the waveform for precise editing.
 * Centers on the playhead during playback, allows browsing when paused.
 *
 * UX Reference: Engine DJ-style detail waveform with configurable zoom
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { WaveformCanvas } from './WaveformCanvas';
import { BeatgridOverlay } from './BeatgridOverlay';
import { findNearestTransient, DEFAULT_TRANSIENT_CONFIG } from '../utils/transient-detector';
import type { WaveformData } from '../analysis/waveform-analyzer';
import type { BeatgridData } from '../analysis/track-analyzer';
import type { WaveformColorMode } from '../types';

export interface WaveformDetailProps {
  /** Waveform data to render */
  waveformData: WaveformData | null;
  /** Beatgrid data for beat markers */
  beatgridData?: BeatgridData | null;
  /** Detected transient positions for magnetic snap (sample positions) */
  transients?: number[];
  /** Current playhead position (0-1) */
  playheadPosition?: number;
  /** Color mode for rendering */
  colorMode?: WaveformColorMode;
  /** CSS class name */
  className?: string;
  /** Callback when user seeks to a position */
  onSeek?: (normalizedPosition: number) => void;
  /** Whether the track is currently playing */
  isPlaying?: boolean;
  /** BPM of the track (for calculating bars) */
  bpm?: number;
  /** Sample rate for time calculations */
  sampleRate?: number;
  /** Zoom level: number of bars visible (1, 2, 4, 8) */
  zoomLevel?: 1 | 2 | 4 | 8;
  /** Callback when zoom level changes */
  onZoomChange?: (zoomLevel: 1 | 2 | 4 | 8) => void;
  /** Height of the component in pixels */
  height?: number;
  /** Whether slip mode is currently active */
  isSlipModeActive?: boolean;
  /** Current slip offset in samples (for live preview) */
  slipOffset?: number;
  /** Callback when slip mode starts (Shift+Drag) */
  onSlipStart?: (startX: number, originalFirstBeat: number) => void;
  /** Callback when slip offset changes during drag */
  onSlipUpdate?: (offset: number) => void;
  /** Callback when slip mode is committed (mouse up) */
  onSlipCommit?: () => void;
  /** Callback when slip mode is cancelled (Shift release) */
  onSlipCancel?: () => void;
  /** Index of currently snapped beat (for highlight) */
  snappedBeatIndex?: number | null;
  /** Callback when snap state changes */
  onSnapChange?: (beatIndex: number | null, isSnapped: boolean) => void;
  /** Callback for keyboard nudge (Shift+Arrow keys). Offset is sample delta (±44 for 1ms at 44.1kHz) */
  onKeyboardNudge?: (sampleOffset: number) => void;
}

/** Calculate view range based on zoom level and center position */
function calculateViewRange(
  centerPosition: number,
  zoomLevel: number,
  bpm: number,
  duration: number
): { start: number; end: number } {
  // Calculate how much of the track to show
  // At 120 BPM, 1 bar = 2 seconds. zoomLevel bars visible.
  const secondsPerBar = 60 / bpm * 4; // 4 beats per bar
  const visibleSeconds = secondsPerBar * zoomLevel;
  const visibleFraction = Math.min(1, visibleSeconds / duration);

  const halfRange = visibleFraction / 2;
  let start = centerPosition - halfRange;
  let end = centerPosition + halfRange;

  // Clamp to valid range
  if (start < 0) {
    start = 0;
    end = visibleFraction;
  }
  if (end > 1) {
    end = 1;
    start = Math.max(0, 1 - visibleFraction);
  }

  return { start, end };
}

/**
 * Detail waveform component for zoomed playhead-centered view.
 *
 * Features:
 * - Configurable zoom levels (1, 2, 4, 8 bars)
 * - Centers on playhead during playback
 * - Scroll/drag to browse when paused
 * - Mouse wheel zoom
 * - Click to seek
 *
 * @example
 * ```tsx
 * <WaveformDetail
 *   waveformData={trackWaveform}
 *   playheadPosition={normalizedPosition}
 *   bpm={125}
 *   zoomLevel={4}
 *   onSeek={(pos) => audioWorklet.seek(pos)}
 *   isPlaying={isPlaying}
 * />
 * ```
 */
export function WaveformDetail({
  waveformData,
  beatgridData,
  transients = [],
  playheadPosition = 0,
  colorMode = 'rgb',
  className = '',
  onSeek,
  isPlaying = false,
  bpm = 120,
  sampleRate = 44100,
  zoomLevel = 4,
  onZoomChange,
  height = 128,
  isSlipModeActive = false,
  slipOffset = 0,
  onSlipStart,
  onSlipUpdate,
  onSlipCommit,
  onSlipCancel,
  snappedBeatIndex = null,
  onSnapChange,
  onKeyboardNudge,
}: WaveformDetailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSlipDragging, setIsSlipDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartOffset, setDragStartOffset] = useState(0);
  const [browseOffset, setBrowseOffset] = useState(0);
  const slipStartXRef = useRef<number>(0);

  // Calculate duration and total samples
  const duration = waveformData?.duration ?? 0;
  const totalSamples = Math.round(duration * sampleRate);

  // Reset browse offset when playback starts
  useEffect(() => {
    if (isPlaying) {
      setBrowseOffset(0);
    }
  }, [isPlaying]);

  // Calculate center position (playhead + browse offset)
  const centerPosition = useMemo(() => {
    if (isPlaying) {
      return playheadPosition;
    }
    return Math.max(0, Math.min(1, playheadPosition + browseOffset));
  }, [isPlaying, playheadPosition, browseOffset]);

  // Calculate view range
  const viewRange = useMemo(() => {
    if (duration <= 0) {
      return { start: 0, end: 1 };
    }
    return calculateViewRange(centerPosition, zoomLevel, bpm, duration);
  }, [centerPosition, zoomLevel, bpm, duration]);

  // Calculate samples per pixel for offset conversion
  const samplesPerPixel = useMemo(() => {
    const containerWidth = containerRef.current?.clientWidth || 800;
    const viewWidthSamples = (viewRange.end - viewRange.start) * totalSamples;
    return viewWidthSamples / containerWidth;
  }, [viewRange, totalSamples]);

  // Listen for Shift key release to cancel slip mode
  useEffect(() => {
    if (!isSlipModeActive) return;

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift' && isSlipDragging) {
        // Cancel slip mode on Shift release
        setIsSlipDragging(false);
        onSlipCancel?.();
      }
    };

    window.addEventListener('keyup', handleKeyUp);
    return () => window.removeEventListener('keyup', handleKeyUp);
  }, [isSlipModeActive, isSlipDragging, onSlipCancel]);

  // Handle mouse wheel for zoom
  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      if (!onZoomChange) return;

      // Prevent page scroll
      event.preventDefault();

      const zoomLevels: (1 | 2 | 4 | 8)[] = [1, 2, 4, 8];
      const currentIndex = zoomLevels.indexOf(zoomLevel);

      if (event.deltaY > 0 && currentIndex < zoomLevels.length - 1) {
        // Zoom out (show more bars)
        onZoomChange(zoomLevels[currentIndex + 1]);
      } else if (event.deltaY < 0 && currentIndex > 0) {
        // Zoom in (show fewer bars)
        onZoomChange(zoomLevels[currentIndex - 1]);
      }
    },
    [zoomLevel, onZoomChange]
  );

  // Handle mouse down for drag browsing or slip mode
  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (isPlaying) return; // Only allow browsing/slip when paused

      // Check for Shift+Drag to enter slip mode
      if (event.shiftKey && beatgridData && onSlipStart) {
        event.preventDefault();
        setIsSlipDragging(true);
        slipStartXRef.current = event.clientX;
        onSlipStart(event.clientX, beatgridData.firstBeatSample);
        return;
      }

      // Normal browse mode
      setIsDragging(true);
      setDragStartX(event.clientX);
      setDragStartOffset(browseOffset);
    },
    [isPlaying, browseOffset, beatgridData, onSlipStart]
  );

  // Handle mouse move for drag browsing or slip mode
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      // Slip mode dragging
      if (isSlipDragging && onSlipUpdate) {
        const deltaX = event.clientX - slipStartXRef.current;
        // Convert pixel delta to sample offset
        // Dragging left (negative delta) = move waveform left = increase first beat sample
        // Dragging right (positive delta) = move waveform right = decrease first beat sample
        const sampleOffset = Math.round(-deltaX * samplesPerPixel);
        onSlipUpdate(sampleOffset);

        // Check for magnetic snap: is any beat (with offset applied) near a transient?
        if (onSnapChange && beatgridData && transients.length > 0) {
          let snappedIndex: number | null = null;

          // Check each beat anchor with offset applied
          for (let i = 0; i < beatgridData.anchors.length; i++) {
            const beatPosition = beatgridData.anchors[i] + sampleOffset;
            const snapResult = findNearestTransient(
              transients,
              beatPosition,
              DEFAULT_TRANSIENT_CONFIG.snapThreshold
            );

            if (snapResult.found) {
              snappedIndex = i;
              break; // Snap to first matching beat
            }
          }

          onSnapChange(snappedIndex, snappedIndex !== null);
        }
        return;
      }

      // Normal browse mode
      if (!isDragging || !containerRef.current) return;

      const containerWidth = containerRef.current.clientWidth;
      const deltaX = event.clientX - dragStartX;

      // Convert pixel delta to position delta
      const viewWidth = viewRange.end - viewRange.start;
      const positionDelta = -(deltaX / containerWidth) * viewWidth;

      setBrowseOffset(
        Math.max(
          -playheadPosition,
          Math.min(1 - playheadPosition, dragStartOffset + positionDelta)
        )
      );
    },
    [isDragging, isSlipDragging, dragStartX, dragStartOffset, viewRange, playheadPosition, samplesPerPixel, onSlipUpdate, onSnapChange, beatgridData, transients]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isSlipDragging) {
      // Commit slip mode changes
      setIsSlipDragging(false);
      onSlipCommit?.();
      return;
    }
    setIsDragging(false);
  }, [isSlipDragging, onSlipCommit]);

  // Handle keyboard nudge (Shift+Arrow keys)
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // Only handle Shift+Arrow for nudge when we have beatgrid data
      if (!event.shiftKey || !beatgridData || !onKeyboardNudge) return;

      // 1ms nudge = ~44 samples at 44.1kHz
      const NUDGE_SAMPLES = Math.round(sampleRate / 1000); // 44 samples for 44.1kHz

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        event.stopPropagation();
        // Left arrow = move grid earlier = decrease first beat sample
        onKeyboardNudge(-NUDGE_SAMPLES);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        event.stopPropagation();
        // Right arrow = move grid later = increase first beat sample
        onKeyboardNudge(NUDGE_SAMPLES);
      }
    },
    [beatgridData, sampleRate, onKeyboardNudge]
  );

  // Handle click to seek
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      // Don't seek during drag or slip operations
      if (!onSeek || !containerRef.current || isDragging || isSlipDragging || isSlipModeActive) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const clickRatio = x / rect.width;

      // Convert click position to track position
      const trackPosition =
        viewRange.start + clickRatio * (viewRange.end - viewRange.start);

      onSeek(Math.max(0, Math.min(1, trackPosition)));
      setBrowseOffset(0); // Reset browse offset on seek
    },
    [onSeek, viewRange, isDragging, isSlipDragging, isSlipModeActive]
  );

  // Zoom level indicator
  const zoomIndicator = `${zoomLevel} bar${zoomLevel > 1 ? 's' : ''}`;

  // Determine cursor style
  const getCursor = () => {
    if (isSlipDragging || isSlipModeActive) return 'ew-resize';
    if (isDragging) return 'grabbing';
    if (isPlaying) return 'default';
    return 'grab';
  };

  return (
    <div
      ref={containerRef}
      className={`waveform-detail relative ${className}`}
      style={{
        height: `${height}px`,
        backgroundColor: '#000000', // OLED Black
        borderRadius: '4px',
        overflow: 'hidden',
        cursor: getCursor(),
        outline: 'none', // Hide focus outline (we have our own visual feedback)
      }}
      tabIndex={0}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Waveform Canvas */}
      <WaveformCanvas
        waveformData={waveformData}
        playheadPosition={playheadPosition}
        viewRange={viewRange}
        colorMode={colorMode}
        animate={isPlaying}
        className="w-full h-full pointer-events-none"
      />

      {/* Beatgrid Overlay */}
      {beatgridData && (
        <BeatgridOverlay
          beatgridData={beatgridData}
          viewRange={viewRange}
          totalSamples={totalSamples}
          height={height}
          slipOffset={slipOffset}
          snappedBeatIndex={snappedBeatIndex}
        />
      )}

      {/* Center line (playhead target) */}
      <div
        className="absolute top-0 bottom-0 w-px pointer-events-none"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(77, 250, 144, 0.3)', // Engine Green faded
          boxShadow: '0 0 4px rgba(77, 250, 144, 0.5)',
        }}
      />

      {/* Zoom indicator */}
      <div
        className="absolute top-2 right-2 px-2 py-1 text-xs font-mono pointer-events-none"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: '#4DFA90', // Engine Green
          borderRadius: '4px',
        }}
      >
        {zoomIndicator}
      </div>

      {/* Slip mode indicator */}
      {(isSlipModeActive || isSlipDragging) && (
        <div
          className="absolute bottom-2 left-2 px-2 py-1 text-xs font-bold pointer-events-none"
          style={{
            backgroundColor: 'rgba(77, 250, 144, 0.2)',
            color: '#4DFA90', // Engine Green
            borderRadius: '4px',
            border: '1px solid #4DFA90',
          }}
        >
          SLIP
        </div>
      )}

      {/* Browse mode indicator */}
      {!isPlaying && browseOffset !== 0 && !isSlipModeActive && !isSlipDragging && (
        <div
          className="absolute bottom-2 left-2 px-2 py-1 text-xs pointer-events-none"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#FFCC00', // Warning Yellow
            borderRadius: '4px',
          }}
        >
          BROWSE
        </div>
      )}

      {/* No waveform placeholder */}
      {!waveformData && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
          No waveform data
        </div>
      )}
    </div>
  );
}
