/**
 * WaveformOverview - Full-track compressed waveform view
 *
 * Displays the complete track waveform for navigation.
 * Supports "Needle Drop" seeking by clicking anywhere on the waveform.
 *
 * UX Reference: Engine DJ-style overview waveform
 */

import { useCallback, useState, useMemo } from 'react';
import { WaveformCanvas } from './WaveformCanvas';
import type { WaveformData } from '../analysis/waveform-analyzer';
import type { WaveformColorMode } from '../types';
import type { HotCueData, LoopData } from '../types/cue-loop';
import { CUE_COLOR_HEX } from '../types/cue-loop';

export interface WaveformOverviewProps {
  /** Waveform data to render */
  waveformData: WaveformData | null;
  /** Current playhead position (0-1) */
  playheadPosition?: number;
  /** Color mode for rendering */
  colorMode?: WaveformColorMode;
  /** CSS class name */
  className?: string;
  /** Callback when user seeks to a position (Needle Drop) */
  onSeek?: (normalizedPosition: number) => void;
  /** Whether the track is currently playing */
  isPlaying?: boolean;
  /** Height of the component in pixels */
  height?: number;
  /** Hot cue points to display as markers */
  cuePoints?: HotCueData[];
  /** Loop regions to display as markers */
  loops?: LoopData[];
  /** Total samples in the track (needed for cue/loop position calculation) */
  totalSamples?: number;
  /** Currently active loop index (-1 if none) */
  activeLoopIndex?: number;
  /** Callback when a loop region is clicked */
  onLoopClick?: (loopIndex: number) => void;
  /** Callback when a loop region is right-clicked (context menu) */
  onLoopContextMenu?: (loopIndex: number, event: React.MouseEvent) => void;
  /** Callback when a cue marker is clicked */
  onCueClick?: (cueIndex: number) => void;
  /** Callback when a cue marker is right-clicked (context menu) */
  onCueContextMenu?: (cueIndex: number, event: React.MouseEvent) => void;
}

/**
 * Overview waveform component for full-track navigation.
 *
 * Features:
 * - Full track waveform display
 * - Needle Drop seeking (click to seek)
 * - Visual position indicator during drag
 * - Animated playhead during playback
 *
 * @example
 * ```tsx
 * <WaveformOverview
 *   waveformData={trackWaveform}
 *   playheadPosition={normalizedPosition}
 *   onSeek={(pos) => audioWorklet.seek(pos)}
 *   isPlaying={isPlaying}
 * />
 * ```
 */
export function WaveformOverview({
  waveformData,
  playheadPosition = 0,
  colorMode = 'rgb',
  className = '',
  onSeek,
  isPlaying = false,
  height = 64,
  cuePoints = [],
  loops = [],
  totalSamples = 0,
  activeLoopIndex = -1,
  onLoopClick,
  onLoopContextMenu,
  onCueClick,
  onCueContextMenu,
}: WaveformOverviewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewPosition, setPreviewPosition] = useState<number | null>(null);

  // Calculate visible cue markers
  const visibleCues = useMemo(() => {
    if (totalSamples <= 0) return [];
    return cuePoints
      .filter((cue) => cue.isSet)
      .map((cue) => ({
        cue,
        position: cue.position / totalSamples,
      }));
  }, [cuePoints, totalSamples]);

  // Calculate visible loop regions
  const visibleLoops = useMemo(() => {
    if (totalSamples <= 0) return [];
    return loops.map((loop) => ({
      loop,
      startPosition: loop.inPoint / totalSamples,
      endPosition: loop.outPoint / totalSamples,
      isActive: loop.index === activeLoopIndex,
    }));
  }, [loops, totalSamples, activeLoopIndex]);

  // Handle click to seek (Needle Drop)
  const handleClick = useCallback(
    (normalizedPosition: number) => {
      onSeek?.(normalizedPosition);
    },
    [onSeek]
  );

  // Handle mouse down for drag-seeking
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!onSeek) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const position = x / rect.width;

      setIsDragging(true);
      setPreviewPosition(position);
    },
    [onSeek]
  );

  // Handle mouse move during drag
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
      const position = x / rect.width;

      setPreviewPosition(position);
    },
    [isDragging]
  );

  // Handle mouse up to complete seek
  const handleMouseUp = useCallback(() => {
    if (isDragging && previewPosition !== null) {
      onSeek?.(previewPosition);
    }
    setIsDragging(false);
    setPreviewPosition(null);
  }, [isDragging, previewPosition, onSeek]);

  // Handle mouse leave to cancel drag
  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setPreviewPosition(null);
    }
  }, [isDragging]);

  // Display position: preview during drag, otherwise playhead
  const displayPosition = previewPosition ?? playheadPosition;

  return (
    <div
      className={`waveform-overview relative ${className}`}
      style={{
        height: `${height}px`,
        backgroundColor: '#000000', // OLED Black
        borderRadius: '4px',
        overflow: 'hidden',
        cursor: onSeek ? (isDragging ? 'grabbing' : 'pointer') : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Waveform Canvas */}
      <WaveformCanvas
        waveformData={waveformData}
        playheadPosition={displayPosition}
        viewRange={{ start: 0, end: 1 }}
        colorMode={colorMode}
        onClick={handleClick}
        animate={isPlaying}
        className="w-full h-full"
      />

      {/* Loop region markers */}
      {visibleLoops.map(({ loop, startPosition, endPosition, isActive }) => {
        const colorHex = CUE_COLOR_HEX[loop.color];
        return (
          <div
            key={`loop-${loop.index}`}
            className="absolute top-0 bottom-0 cursor-pointer"
            style={{
              left: `${startPosition * 100}%`,
              width: `${(endPosition - startPosition) * 100}%`,
              backgroundColor: isActive ? `${colorHex}30` : `${colorHex}15`,
              borderLeft: `2px solid ${colorHex}`,
              borderRight: `2px solid ${colorHex}`,
              boxShadow: isActive ? `inset 0 0 8px ${colorHex}40` : 'none',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onLoopClick?.(loop.index);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onLoopContextMenu?.(loop.index, e);
            }}
          />
        );
      })}

      {/* Cue point markers */}
      {visibleCues.map(({ cue, position }) => {
        const colorHex = CUE_COLOR_HEX[cue.color];
        return (
          <div
            key={`cue-${cue.index}`}
            className="absolute top-0 cursor-pointer"
            style={{
              left: `${position * 100}%`,
              transform: 'translateX(-50%)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onCueClick?.(cue.index);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCueContextMenu?.(cue.index, e);
            }}
          >
            {/* Vertical line */}
            <div
              className="absolute top-0 w-0.5"
              style={{
                height: `${height}px`,
                backgroundColor: colorHex,
                opacity: 0.7,
              }}
            />
            {/* Triangle marker at top */}
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderTop: `6px solid ${colorHex}`,
                marginLeft: '-3.5px',
              }}
            />
          </div>
        );
      })}

      {/* Position indicator during drag */}
      {isDragging && previewPosition !== null && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/50 pointer-events-none"
          style={{
            left: `${previewPosition * 100}%`,
            transform: 'translateX(-50%)',
          }}
        />
      )}

      {/* Elapsed/remaining sections overlay */}
      <div
        className="absolute top-0 bottom-0 left-0 pointer-events-none"
        style={{
          width: `${displayPosition * 100}%`,
          background: 'linear-gradient(to right, rgba(77, 250, 144, 0.1), rgba(77, 250, 144, 0.05))',
        }}
      />

      {/* No waveform placeholder */}
      {!waveformData && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
          No waveform data
        </div>
      )}
    </div>
  );
}
