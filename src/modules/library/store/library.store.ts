import { create } from 'zustand';
import { playlistService, type DBPlaylist } from '../services/playlist.service';

interface LibraryState {
  playlists: DBPlaylist[];
  selectedPlaylistId: number | null;
  isLoading: boolean;
  
  // Actions
  fetchPlaylists: () => Promise<void>;
  setSelectedPlaylist: (id: number | null) => void;
  createPlaylist: (title: string, parentId?: number, isFolder?: boolean) => Promise<void>;
  deletePlaylist: (id: number) => Promise<void>;
  movePlaylist: (id: number, newParentId: number) => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  playlists: [],
  selectedPlaylistId: null,
  isLoading: false,

  fetchPlaylists: async () => {
    set({ isLoading: true });
    try {
      const playlists = await playlistService.getHierarchy();
      set({ playlists: playlists || [] });
    } finally {
      set({ isLoading: false });
    }
  },

  setSelectedPlaylist: (id) => set({ selectedPlaylistId: id }),

  createPlaylist: async (title, parentId = 0, isFolder = false) => {
    await playlistService.createPlaylist(title, parentId, isFolder);
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
  }
}));
