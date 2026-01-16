import { useState, useEffect, useCallback } from 'react';
import { kernel } from '../../../shared/kernel/kernel-manager';
import { EventType } from '../../../shared/types/messaging';
import { useLibraryStore } from '../store/library.store';

const METADATA_DB = 'm';
const SORT_WHITELIST = ['title', 'artist', 'album', 'bpm', 'key', 'duration', 'genre'];

export interface Track {
  id: number;
  title: string;
  artist: string;
  album: string;
  bpm: number;
  key: string;
  duration: number;
  genre: string;
  path: string;
  filename: string;
}

export type SortField = 'title' | 'artist' | 'album' | 'bpm' | 'key' | 'duration' | 'genre';
export type SortOrder = 'ASC' | 'DESC';

export function useTracks(searchQuery?: string) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [sort, setSort] = useState<{ field: SortField; order: SortOrder }>({ field: 'title', order: 'ASC' });
  const [isDbReady, setIsDbReady] = useState(false);
  
  const selectedPlaylistId = useLibraryStore(state => state.selectedPlaylistId);

  const fetchTracks = useCallback(async () => {
    if (!isDbReady) return;

    setIsLoading(true);
    try {
      // Validate sort field
      const safeSortField = SORT_WHITELIST.includes(sort.field) ? sort.field : 'title';
      const safeSortOrder = sort.order === 'DESC' ? 'DESC' : 'ASC';

      let countSql = 'SELECT COUNT(*) as count FROM Track';
      let dataSql = `SELECT id, title, artist, album, bpm, key, duration, genre, path, filename FROM Track`;
      const params: (string | number)[] = [];

      // 1. Playlist Filter (Recursive)
      if (selectedPlaylistId) {
        countSql = `
          WITH RECURSIVE descendants(id) AS (
            SELECT id FROM Playlist WHERE id = ?
            UNION ALL
            SELECT p.id FROM Playlist p INNER JOIN descendants d ON p.parentListId = d.id
          )
          SELECT COUNT(DISTINCT pe.trackId) as count 
          FROM PlaylistEntity pe 
          INNER JOIN Track t ON pe.trackId = t.id
          WHERE pe.listId IN (SELECT id FROM descendants)
        `;
        dataSql = `
          WITH RECURSIVE descendants(id) AS (
            SELECT id FROM Playlist WHERE id = ?
            UNION ALL
            SELECT p.id FROM Playlist p INNER JOIN descendants d ON p.parentListId = d.id
          )
          SELECT DISTINCT t.id, t.title, t.artist, t.album, t.bpm, t.key, t.duration, t.genre, t.path, t.filename 
          FROM Track t
          INNER JOIN PlaylistEntity pe ON t.id = pe.trackId
          WHERE pe.listId IN (SELECT id FROM descendants)
        `;
        params.push(selectedPlaylistId);
      }

      // 2. Search Filter (FTS5)
      if (searchQuery && searchQuery.trim().length > 0) {
        // Robust FTS5 Sanitization: 
        // 1. Remove double quotes to prevent phrase syntax breaking
        // 2. Collapse multiple spaces
        // 3. Keep Unicode characters (letters/numbers) for international support
        const cleanQuery = searchQuery.trim()
            .replace(/"/g, ' ') 
            .replace(/\s+/g, ' ');
            
        const ftsMatch = `"${cleanQuery}"*`; 
        const ftsSubquery = `id IN (SELECT rowid FROM Track_fts WHERE Track_fts MATCH ?)`;
        
        if (selectedPlaylistId) {
            countSql += ` AND t.${ftsSubquery}`;
            dataSql += ` AND t.${ftsSubquery}`;
        } else {
            countSql = `SELECT COUNT(*) as count FROM Track t WHERE t.${ftsSubquery}`;
            dataSql = `SELECT id, title, artist, album, bpm, key, duration, genre, path, filename FROM Track t WHERE t.${ftsSubquery}`;
        }
        params.push(ftsMatch);
      }

      // 1. Get total count
      const countResult = await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql: countSql,
        params,
        method: 'get',
        targetDb: METADATA_DB
      });
      setTotalCount(countResult?.count || 0);

      // 2. Fetch tracks
      const queryResult = await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql: `${dataSql} ORDER BY ${safeSortField} ${safeSortOrder}`,
        params,
        method: 'all',
        targetDb: METADATA_DB
      });

      setTracks(queryResult || []);
    } catch (error) {
      console.error('[useTracks] Failed to fetch tracks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sort, isDbReady, selectedPlaylistId, searchQuery]);

  useEffect(() => {
    let isMounted = true;

    if (isDbReady) {
      fetchTracks();
    }

    const checkReady = async () => {
        try {
            const result = await kernel.send(EventType.DB_PING, {});
            if (isMounted && result?.ready) {
              setIsDbReady(true);
            }
        } catch {
          // DB not ready yet, will be notified via DB_READY event
        }
    };
    checkReady();

    const unsubscribe = kernel.addHandler((msg) => {
      if (!isMounted) return;

      if (msg.type === EventType.DB_READY) {
        setIsDbReady(true);
      } else if (msg.type === EventType.DB_QUERY_RESPONSE) {
        // Only refresh on operations that likely affect track membership
        const payload = msg.payload as { success?: boolean; changes?: number } | undefined;
        if (payload?.success && payload?.changes !== undefined && payload?.changes > 0) {
          fetchTracks();
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [fetchTracks, isDbReady]);

  const toggleSort = (field: SortField) => {
    setSort(prev => ({
      field,
      order: prev.field === field && prev.order === 'ASC' ? 'DESC' : 'ASC'
    }));
  };

  return { tracks, totalCount, isLoading, sort, toggleSort, refresh: fetchTracks };
}