import React, { useEffect, useState } from 'react';
import { kernel } from '../../../shared/kernel/kernel-manager';
import { EventType } from '../../../shared/types/messaging';
import { Library, FolderPlus, FilePlus, Trash2 } from 'lucide-react';
import { useLibraryStore } from '../store/library.store';
import { usePlaylists } from '../hooks/usePlaylists';
import { useTracks } from '../hooks/useTracks';
import { PlaylistItem } from './PlaylistItem';
import { useModalStore } from '../../../shared/components/modals/modal.store';
import { ContextMenu } from './ContextMenu';

export const PlaylistTree: React.FC = () => {
  const { fetchPlaylists, createPlaylist, isLoading, setDbReady, selectedPlaylistId, setSelectedPlaylist, clearLibrary } = useLibraryStore();
  const { tree } = usePlaylists();
  const { showPrompt, showConfirm } = useModalStore();
  const { totalCount } = useTracks();
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

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

  const handleClearLibrary = () => {
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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  const allTracksMenuOptions = [
    {
      label: 'Clear Library',
      icon: <Trash2 size={14} />,
      danger: true,
      onClick: handleClearLibrary
    }
  ];

  return (
    <div className="flex flex-col h-full bg-[#000000] border-r border-[#4DFA90]/10 font-sans min-w-[200px]">
      <header className="p-4 border-b border-[#4DFA90]/10 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Explorer</span>
        <div className="flex gap-2">
          <button onClick={handleAddCrate} title="New Crate" className="text-[#4DFA90] hover:text-white transition-colors opacity-60 hover:opacity-100">
            <FolderPlus size={14} />
          </button>
          <button onClick={handleAddPlaylist} title="New Playlist" className="text-[#4DFA90] hover:text-white transition-colors opacity-60 hover:opacity-100">
            <FilePlus size={14} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto py-2">
        {/* All Tracks Root Item */}
        <div 
            onClick={() => setSelectedPlaylist(null)}
            onContextMenu={handleContextMenu}
            className={`flex items-center gap-2 px-4 py-2 cursor-pointer transition-colors border-l-2 mb-2 group
                ${selectedPlaylistId === null ? 'bg-[#4DFA90]/10 border-[#4DFA90] text-white' : 'border-transparent text-[#4DFA90]/40 hover:bg-[#4DFA90]/5'}
            `}
        >
            <Library size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest flex-1">All Tracks</span>
            {totalCount > 0 && (
                <span className="text-[9px] font-mono bg-[#4DFA90]/10 px-1.5 rounded-full text-[#4DFA90]/60 group-hover:text-[#4DFA90]">
                    {totalCount}
                </span>
            )}
        </div>

        {menuPos && (
          <ContextMenu 
            x={menuPos.x} 
            y={menuPos.y} 
            onClose={() => setMenuPos(null)} 
            options={allTracksMenuOptions as any} 
          />
        )}

        {isLoading && tree.length === 0 ? (
          <div className="p-4 text-[8px] uppercase opacity-20 animate-pulse text-center">Loading Tree...</div>
        ) : tree.length === 0 ? (
          <div className="p-4 text-[8px] uppercase opacity-20 italic text-center">Empty Library</div>
        ) : (
          tree.map((node) => <PlaylistItem key={node.id} node={node} />)
        )}
      </div>
    </div>
  );
};
