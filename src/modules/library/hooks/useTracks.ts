import { useState, useEffect, useCallback } from 'react';
import { kernel } from '../../../shared/kernel/kernel-manager';
import { EventType } from '../../../shared/types/messaging';

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

  const fetchTracks = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Get total count
      const countResult = await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql: 'SELECT COUNT(*) as count FROM Track',
        method: 'get',
        targetDb: 'm'
      });
      setTotalCount(countResult.count);

      // 2. Fetch all tracks (optimized for MVP, windowing can be added later)
      // We only fetch essential columns
      const queryResult = await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql: `SELECT id, title, artist, album, bpm, key, duration, genre, path, filename 
              FROM Track 
              ORDER BY ${sort.field} ${sort.order}`,
        method: 'all',
        targetDb: 'm'
      });

      setTracks(queryResult || []);
    } catch (error) {
      console.error('[useTracks] Failed to fetch tracks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    fetchTracks();
    
    // Listen for DB_READY which might signal a fresh import
    const unsubscribe = kernel.addHandler((msg) => {
      if (msg.type === EventType.DB_QUERY_RESPONSE && (msg.payload as any)?.success) {
        // Refresh after successful query
      }
    });

    return () => {
      unsubscribe();
    };
  }, [fetchTracks]);

  const toggleSort = (field: SortField) => {
    setSort(prev => ({
      field,
      order: prev.field === field && prev.order === 'ASC' ? 'DESC' : 'ASC'
    }));
  };

  return { tracks, totalCount, isLoading, sort, toggleSort, refresh: fetchTracks };
}
