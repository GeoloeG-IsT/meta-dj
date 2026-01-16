import { useState, useEffect, useCallback } from 'react';
import { kernel } from '../../../shared/kernel/kernel-manager';
import { EventType } from '../../../shared/types/messaging';

const METADATA_DB = 'm';

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

export function useTracks() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [sort, setSort] = useState<{ field: SortField; order: SortOrder }>({ field: 'title', order: 'ASC' });
  const [isDbReady, setIsDbReady] = useState(false);

  const fetchTracks = useCallback(async () => {
    if (!isDbReady) return;

    setIsLoading(true);
    try {
      const countResult = await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql: 'SELECT COUNT(*) as count FROM Track',
        method: 'get',
        targetDb: METADATA_DB
      });
      setTotalCount(countResult.count);

      const queryResult = await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql: `SELECT id, title, artist, album, bpm, key, duration, genre, path, filename 
              FROM Track 
              ORDER BY ${sort.field} ${sort.order}`,
        method: 'all',
        targetDb: METADATA_DB
      });

      setTracks(queryResult || []);
    } catch (error) {
      console.error('[useTracks] Failed to fetch tracks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sort, isDbReady]);

  useEffect(() => {
    let isMounted = true;

    // Initial check
    const checkReady = async () => {
        try {
            const result = await kernel.send(EventType.DB_PING, {});
            if (isMounted && result?.ready) setIsDbReady(true);
        } catch (e) {
            // Silently wait for DB_READY event
        }
    };
    checkReady();

    const unsubscribe = kernel.addHandler((msg) => {
      if (!isMounted) return;

      if (msg.type === EventType.DB_READY) {
        setIsDbReady(true);
      } else if (msg.type === EventType.DB_QUERY_RESPONSE) {
        // Safe check for successful write operations which might require a refresh
        // Assuming payload structure { success: boolean } for non-select queries
        const payload = msg.payload as { success?: boolean };
        if (payload?.success) {
          fetchTracks();
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [fetchTracks]); // fetchTracks includes sort and isDbReady dependencies

  const toggleSort = (field: SortField) => {
    setSort(prev => ({
      field,
      order: prev.field === field && prev.order === 'ASC' ? 'DESC' : 'ASC'
    }));
  };

  return { tracks, totalCount, isLoading, sort, toggleSort, refresh: fetchTracks };
}
