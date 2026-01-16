import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDraggable } from '@dnd-kit/core';
import { useTracks, type SortField } from '../hooks/useTracks';

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const TrackRow: React.FC<{ track: any; virtualItem: any }> = ({ track, virtualItem }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: track.id,
  });

  const style = {
    height: `${virtualItem.size}px`,
    transform: transform 
        ? `translate3d(${virtualItem.start + transform.x}px, ${transform.y}px, 0)` 
        : `translateY(${virtualItem.start}px)`,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`absolute top-0 left-0 w-full flex items-center border-b border-[#4DFA90]/5 hover:bg-[#0055FF]/20 group transition-colors tabular-nums cursor-grab active:cursor-grabbing
        ${virtualItem.index % 2 === 0 ? 'bg-transparent' : 'bg-[#4DFA90]/5'}`}
      style={style}
    >
      <div className="flex-[3] px-2 text-sm truncate text-[#4DFA90] group-hover:text-white">
        {track.title}
      </div>
      <div className="flex-[2] px-2 text-xs truncate opacity-60">
        {track.artist}
      </div>
      <div className="w-24 px-2 text-xs font-mono text-right tabular-nums">
        {(track.bpm || 0).toFixed(1)}
      </div>
      <div className="w-20 px-2 text-xs font-mono text-center text-[#4DFA90]/80">
        {track.key || '-'}
      </div>
      <div className="w-20 px-2 text-xs font-mono text-right opacity-60">
        {formatDuration(track.duration || 0)}
      </div>
    </div>
  );
};

export const TrackList: React.FC = () => {
  const { tracks, isLoading, sort, toggleSort } = useTracks();
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
            {rowVirtualizer.getVirtualItems().map((virtualItem) => (
              <TrackRow 
                key={virtualItem.key} 
                track={tracks[virtualItem.index]} 
                virtualItem={virtualItem} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

