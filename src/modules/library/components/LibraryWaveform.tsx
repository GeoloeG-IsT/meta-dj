/**
 * LibraryWaveform - Waveform preview component for library view
 *
 * Displays the waveform of the track loaded in Deck A above the track list.
 * Supports needle drop seeking and zoom controls.
 */

import { useCallback } from 'react';
import { WaveformOverview } from '@/modules/audio/components/WaveformOverview';
import { useAudioStore, selectDeck, selectColorMode } from '@/modules/audio/store/audio.store';

/**
 * Formats track duration in mm:ss format
 */
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Placeholder component shown when no track is loaded in Deck A
 */
function PlaceholderState() {
  return (
    <div className="flex items-center justify-center h-[88px] bg-[#000] rounded-sm border border-[#4DFA90]/10">
      <span className="text-[#4DFA90]/40 text-sm font-mono">
        Load a track in Deck A to preview
      </span>
    </div>
  );
}

/**
 * Track info display component
 */
interface TrackInfoProps {
  title: string;
  artist: string;
  bpm: number;
  duration: number;
}

function TrackInfo({ title, artist, bpm, duration }: TrackInfoProps) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-sm font-medium text-[#4DFA90] truncate">
          {title || 'Unknown Title'}
        </span>
        <span className="text-xs text-[#4DFA90]/50">—</span>
        <span className="text-xs text-[#4DFA90]/60 truncate">
          {artist || 'Unknown Artist'}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs font-mono text-[#4DFA90]/70 flex-shrink-0 ml-4">
        <span>{bpm.toFixed(1)} BPM</span>
        <span className="text-[#4DFA90]/30">•</span>
        <span>{formatDuration(duration)}</span>
      </div>
    </div>
  );
}

/**
 * Zoom control buttons component
 */
interface ZoomControlsProps {
  zoomLevel: 1 | 2 | 4 | 8;
  onChange: (level: 1 | 2 | 4 | 8) => void;
}

function ZoomControls({ zoomLevel, onChange }: ZoomControlsProps) {
  const levels: Array<1 | 2 | 4 | 8> = [1, 2, 4, 8];

  return (
    <div className="flex items-center gap-1 mt-2">
      <span className="text-[10px] font-mono text-[#4DFA90]/40 uppercase mr-2">Zoom</span>
      {levels.map((level) => (
        <button
          key={level}
          onClick={() => onChange(level)}
          className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
            zoomLevel === level
              ? 'bg-[#4DFA90]/20 text-[#4DFA90] border border-[#4DFA90]/50'
              : 'bg-[#121212] text-[#4DFA90]/50 border border-[#4DFA90]/20 hover:border-[#4DFA90]/40'
          }`}
        >
          {level}x
        </button>
      ))}
    </div>
  );
}

/**
 * LibraryWaveform component - displays waveform preview of Deck A track
 */
export function LibraryWaveform() {
  const deck = useAudioStore(selectDeck('A'));
  const colorMode = useAudioStore(selectColorMode);
  const setPosition = useAudioStore((s) => s.setPosition);
  const setZoomLevel = useAudioStore((s) => s.setZoomLevel);

  // Handle seek (Needle Drop)
  const handleSeek = useCallback(
    (normalizedPosition: number) => {
      setPosition('A', normalizedPosition);
    },
    [setPosition]
  );

  // Handle zoom level change
  const handleZoomChange = useCallback(
    (level: 1 | 2 | 4 | 8) => {
      setZoomLevel('A', level);
    },
    [setZoomLevel]
  );

  // Show placeholder when no track is loaded
  if (!deck.trackId) {
    return <PlaceholderState />;
  }

  return (
    <div className="library-waveform">
      {/* Track Info */}
      <TrackInfo
        title={deck.title}
        artist={deck.artist}
        bpm={deck.bpm}
        duration={deck.duration}
      />

      {/* Waveform */}
      <WaveformOverview
        waveformData={deck.waveformData}
        playheadPosition={deck.position}
        colorMode={colorMode}
        onSeek={handleSeek}
        isPlaying={deck.isPlaying}
        height={48}
      />

      {/* Zoom Controls */}
      <ZoomControls zoomLevel={deck.zoomLevel} onChange={handleZoomChange} />
    </div>
  );
}
