import React, { useEffect } from 'react';
import { kernel } from '../../../shared/kernel/kernel-manager';
import { EventType } from '../../../shared/types/messaging';
import { useLibraryStore } from '../store/library.store';
import { usePlaylists } from '../hooks/usePlaylists';
import { PlaylistItem } from './PlaylistItem';
import { useModalStore } from '../../../shared/components/modals/modal.store';

export const PlaylistTree: React.FC = () => {
  const { fetchPlaylists, createPlaylist, isLoading, setDbReady, selectedPlaylistId, setSelectedPlaylist } = useLibraryStore();
  const { tree } = usePlaylists();
  const { showPrompt } = useModalStore();

  useEffect(() => {
    fetchPlaylists();

    const unsubscribe = kernel.addHandler((msg) => {
        if (msg.type === EventType.DB_READY) {
            setDbReady(true);
        }
    });

    return () => {
      unsubscribe();
    };
  }, [fetchPlaylists, setDbReady]);

  const handleAddCrate = () => {
    showPrompt({
        title: 'New Crate',
        placeholder: 'Enter crate name',
        onConfirm: (name) => {
            if (name) createPlaylist(name, 0, true);
        }
    });
  };

  const handleAddPlaylist = () => {
    showPrompt({
        title: 'New Playlist',
        placeholder: 'Enter playlist name',
        onConfirm: (name) => {
            if (name) createPlaylist(name, 0, false);
        }
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#000000] border-r border-[#4DFA90]/10 font-sans min-w-[200px]">
      <header className="p-4 border-b border-[#4DFA90]/10 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Explorer</span>
        <div className="flex gap-2">
          <button onClick={handleAddCrate} title="New Crate" className="text-[#4DFA90] hover:text-white text-xs opacity-60 hover:opacity-100">✚📁</button>
          <button onClick={handleAddPlaylist} title="New Playlist" className="text-[#4DFA90] hover:text-white text-xs opacity-60 hover:opacity-100">✚📑</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto py-2">
        {/* All Tracks Root Item */}
        <div 
            onClick={() => setSelectedPlaylist(null)}
            className={`flex items-center gap-2 px-4 py-2 cursor-pointer transition-colors border-l-2 mb-2
                ${selectedPlaylistId === null ? 'bg-[#4DFA90]/10 border-[#4DFA90] text-white' : 'border-transparent text-[#4DFA90]/40 hover:bg-[#4DFA90]/5'}
            `}
        >
            <span className="text-[10px] font-bold uppercase tracking-widest">🎛️ All Tracks</span>
        </div>

        {isLoading && tree.length === 0 ? (
          <div className="p-4 text-[8px] uppercase opacity-20 animate-pulse">Loading Tree...</div>
        ) : tree.length === 0 ? (
          <div className="p-4 text-[8px] uppercase opacity-20 italic text-center">Empty Library</div>
        ) : (
          tree.map((node) => <PlaylistItem key={node.id} node={node} />)
        )}
      </div>
    </div>
  );
};
