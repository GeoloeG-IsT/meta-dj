import React, { useState } from 'react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { ImportControl } from './components/ImportControl';
import { TrackList, TrackRowUI } from './components/TrackList';
import { PlaylistTree } from './components/PlaylistTree';
import { playlistService } from './services/playlist.service';
import { useLibraryStore } from './store/library.store';
import { useModalStore } from '../../shared/components/modals/modal.store';

export const LibraryView: React.FC = () => {
  const { clearLibrary, fetchPlaylists, movePlaylist } = useLibraryStore();
  const { showConfirm } = useModalStore();
  const [activeTrack, setActiveTrack] = useState<any | null>(null);
  const [activePlaylist, setActivePlaylist] = useState<any | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleClearLibrary = async () => {
    showConfirm({
        title: 'Clear Library',
        message: 'Are you sure you want to delete ALL tracks from the library? This action cannot be reversed.',
        confirmLabel: 'Clear All',
        isDanger: true,
        onConfirm: async () => {
            await clearLibrary();
        }
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'playlist') {
        setActivePlaylist(active.data.current);
    } else {
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

    // CASE 1: Moving a Playlist/Crate into another Crate
    if (active.data.current?.type === 'playlist') {
        const movedId = active.data.current.playlistId;
        if (movedId !== playlistId) {
            console.log(`[DND] Moving playlist ${movedId} into ${playlistId}`);
            try {
                await movePlaylist(movedId, playlistId);
            } catch (e: any) {
                if (e.code === 409) alert(e.message);
                else console.error('Failed to move playlist:', e);
            }
        }
        return;
    }

    // CASE 2: Adding a Track to a Playlist or Crate
    if (over.id.toString().startsWith('playlist-')) {
      const trackId = Number(active.id);
      console.log(`[DND] Adding track ${trackId} to playlist/crate ${playlistId}`);
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
          <button 
            onClick={handleClearLibrary}
            className="text-[8px] border border-red-500/40 text-red-500/60 hover:bg-red-500/10 px-2 py-1 uppercase tracking-widest transition-all"
          >
            Clear Library
          </button>
        </header>

        <main className="flex gap-0 flex-1 min-h-0 border border-[#4DFA90]/20 rounded-sm overflow-hidden bg-[#121212]">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0 flex flex-col h-full overflow-hidden">
            <PlaylistTree />
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-[#000000]">
            <div className="p-4 border-b border-[#4DFA90]/10 flex flex-col gap-4">
                <ImportControl />
            </div>
            
            <section className="flex-1 min-h-0 flex flex-col p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-widest opacity-60">Tracks</span>
              </div>
              <TrackList />
            </section>
          </div>
        </main>
      </div>

      <DragOverlay>
        {activeTrack ? (
          <div className="w-[400px] pointer-events-none">
            <TrackRowUI 
                track={activeTrack} 
                isDragging 
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


