import { create } from 'zustand';
import { kernel } from '../../../shared/kernel/kernel-manager';
import { EventType } from '../../../shared/types/messaging';
import { playlistService, type DBPlaylist } from '../services/playlist.service';

interface LibraryState {
  playlists: DBPlaylist[];
  selectedPlaylistId: number | null;
  isLoading: boolean;
  isDbReady: boolean;

  // Smartlist editing state
  editingSmartListId: number | null;
  editingSmartListTitle: string | null;

  // Actions
  fetchPlaylists: () => Promise<void>;
  setDbReady: (ready: boolean) => void;
  setSelectedPlaylist: (id: number | null) => void;
  createPlaylist: (title: string, parentId?: number, isFolder?: boolean) => Promise<void>;
  createSmartList: (title: string, parentId?: number) => Promise<void>;
  renamePlaylist: (id: number, title: string) => Promise<void>;
  deletePlaylist: (id: number) => Promise<void>;
  movePlaylist: (id: number, newParentId: number) => Promise<void>;
  deleteTrack: (id: number) => Promise<void>;
  removeTrackFromPlaylist: (trackId: number, playlistId: number) => Promise<void>;
  clearLibrary: () => Promise<void>;
  openSmartListEditor: (id: number, title: string) => void;
  closeSmartListEditor: () => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  playlists: [],
  selectedPlaylistId: null,
  isLoading: false,
  isDbReady: false,
  editingSmartListId: null,
  editingSmartListTitle: null,

  fetchPlaylists: async () => {
    if (!get().isDbReady) {
        try {
            const check = await kernel.send<unknown, { ready: boolean }>(EventType.DB_PING, {});
            if (check?.ready) {
                set({ isDbReady: true });
            } else {
                return;
            }
        } catch {
            // DB not ready, will be notified via event
            return;
        }
    }

    set({ isLoading: true });
    try {
      const playlists = await playlistService.getHierarchy();
      set({ playlists: playlists || [] });
    } catch (e) {
        console.error('Failed to fetch playlists:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  setDbReady: (ready) => {
    set({ isDbReady: ready });
    if (ready) get().fetchPlaylists();
  },

  setSelectedPlaylist: (id) => set({ selectedPlaylistId: id }),

  createPlaylist: async (title, parentId = 0, isFolder = false) => {
    await playlistService.createPlaylist(title, parentId, isFolder);
    await get().fetchPlaylists();
  },

  createSmartList: async (title, parentId = 0) => {
    await playlistService.createSmartList(title, parentId);
    await get().fetchPlaylists();
  },

  renamePlaylist: async (id, title) => {
    await playlistService.rename(id, title);
    await get().fetchPlaylists();
  },

  deletePlaylist: async (id) => {
    await playlistService.delete(id);
    if (get().selectedPlaylistId === id) {
      set({ selectedPlaylistId: null });
    }
    await get().fetchPlaylists();
  },

  movePlaylist: async (id, newParentId) => {
    await playlistService.move(id, newParentId);
    await get().fetchPlaylists();
  },

  deleteTrack: async (id) => {
    await playlistService.deleteTrack(id);
    // Refresh playlists because track counts might change
    await get().fetchPlaylists();
  },

  removeTrackFromPlaylist: async (trackId, playlistId) => {
    await playlistService.removeFromPlaylist(trackId, playlistId);
    await get().fetchPlaylists();
  },

  clearLibrary: async () => {
    await playlistService.deleteAllTracks();
    await get().fetchPlaylists();
  },

  openSmartListEditor: (id, title) => {
    set({ editingSmartListId: id, editingSmartListTitle: title });
  },

  closeSmartListEditor: () => {
    set({ editingSmartListId: null, editingSmartListTitle: null });
  }
}));