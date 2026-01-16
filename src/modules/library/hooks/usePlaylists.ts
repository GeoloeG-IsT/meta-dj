import { useMemo } from 'react';
import { useLibraryStore } from '../store/library.store';
import { type DBPlaylist } from '../services/playlist.service';

export interface PlaylistNode extends DBPlaylist {
  children: PlaylistNode[];
}

export function usePlaylists() {
  const playlists = useLibraryStore((state) => state.playlists);

  const tree = useMemo(() => {
    const nodes: Record<number, PlaylistNode> = {};
    const root: PlaylistNode[] = [];

    // 1. Initialize nodes
    playlists.forEach((p) => {
      nodes[p.id] = { ...p, children: [] };
    });

    // 2. Build tree
    playlists.forEach((p) => {
      if (p.parentListId === 0) {
        root.push(nodes[p.id]);
      } else if (nodes[p.parentListId]) {
        nodes[p.parentListId].children.push(nodes[p.id]);
      }
    });

    return root;
  }, [playlists]);

  return { tree };
}
