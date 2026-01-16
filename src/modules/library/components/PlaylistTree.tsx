import React, { useEffect, useState } from 'react';
import { kernel } from '../../../shared/kernel/kernel-manager';
import { EventType } from '../../../shared/types/messaging';
import { Library, FolderPlus, FilePlus, Trash2, Zap, FolderInput } from 'lucide-react';
import { useLibraryStore } from '../store/library.store';
import { usePlaylists } from '../hooks/usePlaylists';
import { useTracks } from '../hooks/useTracks';
import { PlaylistItem } from './PlaylistItem';
import { useModalStore } from '../../../shared/components/modals/modal.store';
import { ContextMenu } from './ContextMenu';
import { SmartListBuilder } from './SmartListBuilder';
import { ingestService } from '../services/ingest-service';
import { toast } from '../../../shared/store/toast.store';

export const PlaylistTree: React.FC = () => {
  const {
    fetchPlaylists,
    createPlaylist,
    createSmartList,
    isLoading,
    setDbReady,
    selectedPlaylistId,
    setSelectedPlaylist,
    clearLibrary,
    editingSmartListId,
    editingSmartListTitle,
    closeSmartListEditor
  } = useLibraryStore();
  const { tree } = usePlaylists();
  const { showPrompt, showConfirm } = useModalStore();
  const { totalCount, refresh: refreshTracks } = useTracks();
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

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

  const handleAddSmartList = () => {
    showPrompt({
        title: 'New SmartList',
        placeholder: 'Enter smartlist name',
        onConfirm: (name) => {
            if (name) createSmartList(name, 0);
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

  const handleImportFolder = async () => {
    if (isImporting) {
      toast.warning('Import already in progress');
      return;
    }

    try {
      const dirHandle = await window.showDirectoryPicker();

      setIsImporting(true);
      // Duration 0 = no auto-dismiss (persistent until manually dismissed)
      const toastId = toast.info('Importing: scanning...', 60000);

      let lastTotal = 0;
      await ingestService.ingestDirectory(dirHandle, (progress) => {
        toast.update(toastId, `Importing: ${progress.currentFile} (${progress.processed}/${progress.total})`);
        lastTotal = progress.total;
      });

      // Success
      toast.dismiss(toastId);
      toast.success(`Imported ${lastTotal} tracks`);

      // Refresh the library
      await fetchPlaylists();
      refreshTracks();

    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'AbortError') {
        // User cancelled folder picker - silently ignore
        return;
      }
      console.error('Import failed:', error);
      toast.error(`Import failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  const allTracksMenuOptions = [
    {
      label: 'Import Folder...',
      icon: <FolderInput size={14} />,
      onClick: handleImportFolder,
      disabled: isImporting
    },
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
          <button onClick={handleAddSmartList} title="New SmartList" className="text-[#4DFA90] hover:text-white transition-colors opacity-60 hover:opacity-100">
            <Zap size={14} />
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

      {/* SmartList Builder Modal */}
      {editingSmartListId !== null && editingSmartListTitle !== null && (
        <SmartListBuilder
          playlistId={editingSmartListId}
          playlistTitle={editingSmartListTitle}
          onClose={closeSmartListEditor}
          onSave={() => {
            fetchPlaylists();
          }}
        />
      )}
    </div>
  );
};
