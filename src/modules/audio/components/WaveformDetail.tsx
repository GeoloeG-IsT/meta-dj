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
import type { WaveformData } from '../analysis/waveform-analyzer';
import type { BeatgridData } from '../analysis/track-analyzer';
import type { WaveformColorMode } from '../types';

export interface WaveformDetailProps {
  /** Waveform data to render */
  waveformData: WaveformData | null;
  /** Beatgrid data for beat markers */
  beatgridData?: BeatgridData | null;
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
}: WaveformDetailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartOffset, setDragStartOffset] = useState(0);
  const [browseOffset, setBrowseOffset] = useState(0);

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

  // Handle mouse down for drag browsing
  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (isPlaying) return; // Only allow browsing when paused

      setIsDragging(true);
      setDragStartX(event.clientX);
      setDragStartOffset(browseOffset);
    },
    [isPlaying, browseOffset]
  );

  // Handle mouse move for drag browsing
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
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
    [isDragging, dragStartX, dragStartOffset, viewRange, playheadPosition]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle click to seek
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!onSeek || !containerRef.current || isDragging) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const clickRatio = x / rect.width;

      // Convert click position to track position
      const trackPosition =
        viewRange.start + clickRatio * (viewRange.end - viewRange.start);

      onSeek(Math.max(0, Math.min(1, trackPosition)));
      setBrowseOffset(0); // Reset browse offset on seek
    },
    [onSeek, viewRange, isDragging]
  );

  // Zoom level indicator
  const zoomIndicator = `${zoomLevel} bar${zoomLevel > 1 ? 's' : ''}`;

  return (
    <div
      ref={containerRef}
      className={`waveform-detail relative ${className}`}
      style={{
        height: `${height}px`,
        backgroundColor: '#000000', // OLED Black
        borderRadius: '4px',
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : isPlaying ? 'default' : 'grab',
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
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

      {/* Browse mode indicator */}
      {!isPlaying && browseOffset !== 0 && (
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
