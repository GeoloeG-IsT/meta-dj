import React, { useState, useEffect } from 'react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { TrackList, TrackRowUI } from './components/TrackList';
import { PlaylistTree } from './components/PlaylistTree';
import { playlistService } from './services/playlist.service';
import { useLibraryStore } from './store/library.store';
import { useModalStore } from '../../shared/components/modals/modal.store';
import { SearchOverlay } from './components/SearchOverlay';
import { LibraryWaveform } from './components/LibraryWaveform';

export const LibraryView: React.FC = () => {
  const { fetchPlaylists, movePlaylist } = useLibraryStore();
  const { isOpen: isModalOpen } = useModalStore();
  const [activeTrack, setActiveTrack] = useState<any | null>(null);
  const [activePlaylist, setActivePlaylist] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Global Type-Ahead Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen) return;
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        setSearchQuery('');
        return;
      }

      if (e.key === 'Backspace') {
        setSearchQuery(prev => prev.slice(0, -1));
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === ' ') e.preventDefault();
        setSearchQuery(prev => prev + e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'playlist') {
        setActivePlaylist(active.data.current);
    }
    else {
        setActiveTrack(active.data.current?.track || null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTrack(null);
    setActivePlaylist(null);
    
    if (!over) return;

    const targetId = over.id.toString().replace('playlist-', '');
    const playlistId = Number(targetId);

    if (active.data.current?.type === 'playlist') {
        const movedId = active.data.current.playlistId;
        if (movedId !== playlistId) {
            try {
                await movePlaylist(movedId, playlistId);
            } catch (e: any) {
                if (e.code === 409) alert(e.message);
                else console.error('Failed to move playlist:', e);
            }
        }
        return;
    }

    if (over.id.toString().startsWith('playlist-')) {
      const trackId = Number(active.id);
      try {
        await playlistService.addTrackToPlaylist(trackId, playlistId);
        await fetchPlaylists(); 
      } catch (e) {
        console.error('Failed to add track:', e);
      }
    }
  };

  return (
    <DndContext 
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-6 h-full min-h-0">
        <header className="flex items-center justify-between">
          <h2 className="text-xl font-bold uppercase tracking-[0.2em] text-[#4DFA90]">
            Librarian <span className="opacity-40 text-sm font-normal tracking-normal">/ Collection</span>
          </h2>
        </header>

        <main className="flex gap-0 flex-1 min-h-0 border border-[#4DFA90]/20 rounded-sm overflow-hidden bg-[#121212]">
          <div className="w-64 flex-shrink-0 flex flex-col h-full overflow-hidden">
            <PlaylistTree />
          </div>

          <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-[#000000]">
            {/* Waveform preview of loaded track (Deck A) */}
            <div className="p-4 border-b border-[#4DFA90]/10">
              <LibraryWaveform />
            </div>

            <section className="flex-1 min-h-0 flex flex-col p-4">
              <div className="flex items-center justify-between mb-4 gap-4">
                <span className="text-[10px] uppercase tracking-widest opacity-60">Tracks</span>
                
                <div className="relative flex-1 max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4DFA90]/40 text-xs">🔍</span>
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    placeholder="Search Library..."
                    className="w-full bg-[#121212] border border-[#4DFA90]/20 rounded-sm py-1.5 pl-9 pr-4 text-xs text-[#4DFA90] focus:outline-none focus:border-[#4DFA90]/50 placeholder:text-[#4DFA90]/20 transition-all font-mono tracking-wider"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4DFA90]/40 hover:text-[#4DFA90] text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <TrackList searchQuery={debouncedSearch} />
            </section>
          </div>
        </main>
      </div>

      <SearchOverlay query={isSearchFocused ? '' : debouncedSearch} />

      <DragOverlay>
        {activeTrack ? (
          <div className="w-[400px] pointer-events-none">
            <TrackRowUI 
                track={activeTrack} 
                isDragging 
                actionIcon={null}
            />
          </div>
        ) : activePlaylist ? (
            <div className="bg-[#4DFA90]/20 text-[#4DFA90] px-4 py-2 border border-[#4DFA90] font-mono text-[10px] uppercase pointer-events-none">
                Moving Item...
            </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};