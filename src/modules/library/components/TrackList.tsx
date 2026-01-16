import React, { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDraggable } from '@dnd-kit/core';
import { Trash2, XCircle, Zap } from 'lucide-react';
import { useTracks, type SortField } from '../hooks/useTracks';
import { useLibraryStore } from '../store/library.store';
import { useModalStore } from '../../../shared/components/modals/modal.store';
import { CSS } from '@dnd-kit/utilities';
import { loadTrackFromLibrary } from '../../audio/services/deck-loader.service';
import { useAnalysisStore, selectTrackAnalysis } from '../../audio/store/analysis.store';
import { AnalysisProgressInline } from '../../audio/components/AnalysisProgress';

export const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface TrackRowUIProps {
    track: any;
    isDragging?: boolean;
    isVirtual?: boolean;
    style?: React.CSSProperties;
    onAction?: () => void;
    onDoubleClick?: () => void;
    onAnalyze?: () => void;
    actionIcon: React.ReactNode;
    className?: string;
    isAnalyzing?: boolean;
}

export const TrackRowUI: React.FC<TrackRowUIProps> = ({
    track,
    isDragging,
    isVirtual,
    style,
    onAction,
    onDoubleClick,
    onAnalyze,
    actionIcon,
    className,
    isAnalyzing
}) => {
    const needsAnalysis = !track.isAnalyzed && !isAnalyzing;

    return (
        <div
            className={`flex items-center border-b border-[#4DFA90]/5 hover:bg-[#0055FF]/20 group transition-colors tabular-nums
                ${isVirtual ? 'absolute top-0 left-0 w-full' : 'w-full bg-[#121212] border border-[#4DFA90]/20 shadow-xl'}
                ${isDragging ? 'opacity-40 cursor-grabbing' : 'cursor-grab'}
                ${className || ''}
            `}
            style={style}
            onDoubleClick={onDoubleClick}
        >
            <div className="flex-[3] px-2 text-sm truncate text-[#4DFA90] group-hover:text-white py-2">
                {track.title}
            </div>
            <div className="flex-[2] px-2 text-xs truncate opacity-60">
                {track.artist}
            </div>
            <div className="w-24 px-2 text-xs font-mono text-right tabular-nums">
                {isAnalyzing ? (
                    <AnalysisProgressInline trackId={track.id} compact />
                ) : (
                    (track.bpm || 0).toFixed(1)
                )}
            </div>
            <div className="w-20 px-2 text-xs font-mono text-center text-[#4DFA90]/80">
                {track.key || '-'}
            </div>
            <div className="w-20 px-2 text-xs font-mono text-right opacity-60">
                {formatDuration(track.duration || 0)}
            </div>
            <div className="w-24 flex justify-center gap-1">
                {!isDragging && (
                    <>
                        {needsAnalysis && onAnalyze && (
                            <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={onAnalyze}
                                className="text-[#4DFA90]/40 hover:text-[#4DFA90] transition-colors p-2"
                                title="Analyze track (BPM, Key, Beatgrid)"
                            >
                                <Zap size={14} />
                            </button>
                        )}
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={onAction}
                            className="text-red-500/40 hover:text-red-500 transition-colors p-2"
                        >
                            {actionIcon}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

const TrackRow: React.FC<{ track: any; virtualItem: any }> = ({ track, virtualItem }) => {
  const { deleteTrack, removeTrackFromPlaylist, selectedPlaylistId } = useLibraryStore();
  const { showConfirm } = useModalStore();
  const analyzeTrack = useAnalysisStore((state) => state.analyzeTrack);
  const analysisState = useAnalysisStore(selectTrackAnalysis(track.id));
  const isAnalyzing = analysisState?.status === 'analyzing';

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: track.id,
    data: { track }
  });

  const handleDoubleClick = useCallback(async () => {
    try {
      // Load track using stored file handle (falls back to file picker if needed)
      await loadTrackFromLibrary('A', {
        id: track.id,
        title: track.title,
        artist: track.artist,
        bpm: track.bpm,
        duration: track.duration,
      });
    } catch (error) {
      console.error('Failed to load track to deck:', error);
    }
  }, [track]);

  const handleAction = () => {
    if (selectedPlaylistId) {
        showConfirm({
            title: 'Remove from Playlist',
            message: `Remove "${track.title}" from this playlist? The track will remain in your collection.`,
            confirmLabel: 'Remove',
            onConfirm: () => removeTrackFromPlaylist(track.id, selectedPlaylistId)
        });
    } else {
        showConfirm({
            title: 'Delete Track',
            message: `Are you sure you want to delete "${track.title}" from the library? This removes it from ALL playlists.`,
            confirmLabel: 'Delete Entirely',
            isDanger: true,
            onConfirm: () => deleteTrack(track.id)
        });
    }
  };

  const handleAnalyze = useCallback(() => {
    analyzeTrack(track.id);
  }, [track.id, analyzeTrack]);

  const style = {
    height: `${virtualItem.size}px`,
    top: `${virtualItem.start}px`,
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className="absolute left-0 w-full"
        style={style}
    >
        <TrackRowUI
            track={track}
            isDragging={isDragging}
            onAction={handleAction}
            onDoubleClick={handleDoubleClick}
            onAnalyze={handleAnalyze}
            actionIcon={selectedPlaylistId ? <XCircle size={14} /> : <Trash2 size={14} />}
            className={virtualItem.index % 2 === 0 ? 'bg-transparent' : 'bg-[#4DFA90]/5'}
            isAnalyzing={isAnalyzing}
        />
    </div>
  );
};
export const TrackList: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
  const { tracks, isLoading, sort, toggleSort } = useTracks(searchQuery);
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const renderHeader = (label: string, field: SortField, width: string) => (
    <div 
      className={`flex items-center gap-2 px-2 py-3 cursor-pointer hover:bg-[#4DFA90]/10 transition-colors uppercase text-[10px] font-bold tracking-widest border-b border-[#4DFA90]/20 ${width}`}
      onClick={() => toggleSort(field)}
    >
      {label}
      {sort.field === field && (
        <span className="text-[#4DFA90]">{sort.order === 'ASC' ? '↑' : '↓'}</span>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#000000] border border-[#4DFA90]/20 rounded-sm overflow-hidden font-sans">
      {/* Table Header */}
      <div className="flex bg-[#121212] sticky top-0 z-10">
        {renderHeader('Title', 'title', 'flex-[3]')}
        {renderHeader('Artist', 'artist', 'flex-[2]')}
        {renderHeader('BPM', 'bpm', 'w-24')}
        {renderHeader('Key', 'key', 'w-20')}
        {renderHeader('Time', 'duration', 'w-20')}
        <div className="w-24 border-b border-[#4DFA90]/20 px-2 py-3 text-[10px] font-bold tracking-widest uppercase text-center opacity-40">
          Actions
        </div>
      </div>

      {/* Virtualized Body */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto scrollbar-hide"
        style={{ height: '400px' }}
      >
        {isLoading && tracks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#4DFA90]/40 font-mono text-sm uppercase animate-pulse">
            Loading Tracks...
          </div>
        ) : tracks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#4DFA90]/20 font-mono text-sm uppercase italic">
            No tracks in library
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const track = tracks[virtualItem.index];
              if (!track) return null;
              return (
                <TrackRow 
                  key={track.id} 
                  track={track} 
                  virtualItem={virtualItem} 
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};


