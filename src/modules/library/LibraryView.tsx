import React from 'react';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { ImportControl } from './components/ImportControl';
import { TrackList } from './components/TrackList';
import { PlaylistTree } from './components/PlaylistTree';
import { playlistService } from './services/playlist.service';

export const LibraryView: React.FC = () => {
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && over.id.toString().startsWith('playlist-')) {
      const playlistId = over.data.current?.playlistId;
      const trackId = active.id as number;
      const isFolder = over.data.current?.isFolder;

      if (!isFolder && playlistId) {
        console.log(`[DND] Adding track ${trackId} to playlist ${playlistId}`);
        try {
          await playlistService.addTrackToPlaylist(trackId, playlistId);
          alert('Track added to playlist');
        } catch (e) {
          console.error('Failed to add track:', e);
        }
      }
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-6 h-full min-h-0">
        <header className="flex items-center justify-between">
          <h2 className="text-xl font-bold uppercase tracking-[0.2em] text-[#4DFA90]">
            Librarian <span className="opacity-40 text-sm font-normal tracking-normal">/ Collection</span>
          </h2>
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
    </DndContext>
  );
};

