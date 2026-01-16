/**
 * Analysis Service - Database Operations for Track Analysis
 *
 * Handles storing and retrieving BPM, Key, and Beatgrid data.
 * Communicates with the database worker via the kernel message bus.
 */

import { kernel } from '../../../shared/kernel/kernel-manager';
import { EventType } from '../../../shared/types/messaging';
import type { BeatgridData } from '../analysis/track-analyzer';
import { serializeBeatgrid } from '../analysis/track-analyzer';
import type { HotCueData, LoopData } from '../types/cue-loop';
import {
  serializeHotCue,
  deserializeHotCue,
  serializeLoop,
  deserializeLoop,
} from '../types/cue-loop';

/**
 * Performance data type constants matching Engine DJ schema.
 */
export const PERFORMANCE_DATA_TYPE = {
  HOT_CUE: 1,
  LOOP: 2,
  BEATGRID: 3,
  WAVEFORM: 4,
} as const;

/**
 * Track analysis data from database.
 */
export interface TrackAnalysisData {
  id: number;
  bpm: number | null;
  key: string | null;
  isAnalyzed: boolean;
}

/**
 * Beatgrid data from database.
 */
export interface StoredBeatgridData {
  trackId: number;
  data: Uint8Array;
}

/**
 * Analysis Service for persisting track analysis results.
 */
export class AnalysisService {
  private readonly DB = 'm';

  /**
   * Store track analysis results (BPM, Key, Beatgrid) in the database.
   * Uses a transactional approach to ensure data consistency.
   *
   * @param trackId - The track ID to update
   * @param bpm - Detected BPM (integer)
   * @param key - Detected key in Camelot notation (e.g., "8A")
   * @param beatgridData - Serialized beatgrid data
   * @throws Error if database operations fail
   */
  async storeAnalysisResults(
    trackId: number,
    bpm: number,
    key: string,
    beatgridData: Uint8Array
  ): Promise<void> {
    try {
      // Update Track table with BPM and Key
      await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql: `UPDATE Track SET bpm = ?, key = ?, isAnalyzed = 1 WHERE id = ?`,
        params: [bpm, key, trackId],
        method: 'run',
        targetDb: this.DB,
      });
    } catch (error) {
      console.error(`[AnalysisService] Failed to update Track ${trackId}:`, error);
      throw new Error(`Failed to store analysis results for track ${trackId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Check if beatgrid already exists
      const existingBeatgrid = await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql: `SELECT id FROM PerformanceData WHERE trackId = ? AND type = ?`,
        params: [trackId, PERFORMANCE_DATA_TYPE.BEATGRID],
        method: 'get',
        targetDb: this.DB,
      });

      if (existingBeatgrid) {
        // Update existing beatgrid
        await kernel.send(EventType.DB_QUERY_REQUEST, {
          sql: `UPDATE PerformanceData SET data = ? WHERE trackId = ? AND type = ?`,
          params: [beatgridData, trackId, PERFORMANCE_DATA_TYPE.BEATGRID],
          method: 'run',
          targetDb: this.DB,
        });
      } else {
        // Insert new beatgrid
        await kernel.send(EventType.DB_QUERY_REQUEST, {
          sql: `INSERT INTO PerformanceData (trackId, type, position, data) VALUES (?, ?, 0, ?)`,
          params: [trackId, PERFORMANCE_DATA_TYPE.BEATGRID, beatgridData],
          method: 'run',
          targetDb: this.DB,
        });
      }
    } catch (error) {
      console.error(`[AnalysisService] Failed to store beatgrid for track ${trackId}:`, error);
      throw new Error(`Failed to store beatgrid for track ${trackId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get track analysis data.
   */
  async getTrackAnalysis(trackId: number): Promise<TrackAnalysisData | null> {
    const result = await kernel.send<unknown, { id: number; bpm: number | null; key: string | null; isAnalyzed: number } | null>(EventType.DB_QUERY_REQUEST, {
      sql: `SELECT id, bpm, key, isAnalyzed FROM Track WHERE id = ?`,
      params: [trackId],
      method: 'get',
      targetDb: this.DB,
    });

    if (!result) return null;

    return {
      id: result.id,
      bpm: result.bpm,
      key: result.key,
      isAnalyzed: result.isAnalyzed === 1,
    };
  }

  /**
   * Get beatgrid data for a track.
   */
  async getBeatgrid(trackId: number): Promise<Uint8Array | null> {
    const result = await kernel.send<unknown, { data: Uint8Array | ArrayBuffer | number[] | null } | null>(EventType.DB_QUERY_REQUEST, {
      sql: `SELECT data FROM PerformanceData WHERE trackId = ? AND type = ?`,
      params: [trackId, PERFORMANCE_DATA_TYPE.BEATGRID],
      method: 'get',
      targetDb: this.DB,
    });

    if (!result || !result.data) return null;

    // Handle blob data - may come as ArrayBuffer or Uint8Array
    if (result.data instanceof Uint8Array) {
      return result.data;
    }
    if (result.data instanceof ArrayBuffer) {
      return new Uint8Array(result.data);
    }
    // SQLite WASM may return as array-like object
    if (Array.isArray(result.data)) {
      return new Uint8Array(result.data);
    }

    return null;
  }

  /**
   * Check if a track has been analyzed.
   */
  async isTrackAnalyzed(trackId: number): Promise<boolean> {
    const result = await kernel.send<unknown, { isAnalyzed: number } | null>(EventType.DB_QUERY_REQUEST, {
      sql: `SELECT isAnalyzed FROM Track WHERE id = ?`,
      params: [trackId],
      method: 'get',
      targetDb: this.DB,
    });

    return result?.isAnalyzed === 1;
  }

  /**
   * Get all unanalyzed tracks.
   */
  async getUnanalyzedTracks(): Promise<number[]> {
    const results = await kernel.send<unknown, Array<{ id: number }>>(EventType.DB_QUERY_REQUEST, {
      sql: `SELECT id FROM Track WHERE isAnalyzed = 0 OR isAnalyzed IS NULL`,
      method: 'all',
      targetDb: this.DB,
    });

    return (results || []).map((r) => r.id);
  }

  /**
   * Update beatgrid with a sample offset.
   * Used after slip mode editing to persist the new beat positions.
   *
   * @param trackId - Track ID to update
   * @param beatgridData - Updated beatgrid data with new positions
   * @returns Promise that resolves when update is complete
   */
  async updateBeatgridOffset(trackId: number, beatgridData: BeatgridData): Promise<void> {
    try {
      // Serialize the beatgrid data
      const serializedData = serializeBeatgrid(beatgridData);

      // Update in database
      await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql: `UPDATE PerformanceData SET data = ? WHERE trackId = ? AND type = ?`,
        params: [serializedData, trackId, PERFORMANCE_DATA_TYPE.BEATGRID],
        method: 'run',
        targetDb: this.DB,
      });

      console.log(`[AnalysisService] Updated beatgrid for track ${trackId}: firstBeat=${beatgridData.firstBeatSample}`);
    } catch (error) {
      console.error(`[AnalysisService] Failed to update beatgrid for track ${trackId}:`, error);
      throw new Error(`Failed to update beatgrid: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear analysis data for a track.
   */
  async clearAnalysis(trackId: number): Promise<void> {
    await kernel.send(EventType.DB_QUERY_REQUEST, {
      sql: `UPDATE Track SET bpm = NULL, key = NULL, isAnalyzed = 0 WHERE id = ?`,
      params: [trackId],
      method: 'run',
      targetDb: this.DB,
    });

    await kernel.send(EventType.DB_QUERY_REQUEST, {
      sql: `DELETE FROM PerformanceData WHERE trackId = ? AND type = ?`,
      params: [trackId, PERFORMANCE_DATA_TYPE.BEATGRID],
      method: 'run',
      targetDb: this.DB,
    });
  }

  // ============================================================
  // Hot Cue Methods (PerformanceData type=1)
  // ============================================================

  /**
   * Save a hot cue point to the database.
   * Uses upsert pattern - inserts new or updates existing cue at the same index.
   *
   * @param trackId - Track ID
   * @param cue - Hot cue data to save
   * @throws Error if database operation fails
   */
  async saveCuePoint(trackId: number, cue: HotCueData): Promise<void> {
    try {
      const serializedData = serializeHotCue(cue);

      // Check if cue at this index already exists
      const existing = await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql: `SELECT id FROM PerformanceData WHERE trackId = ? AND type = ? AND position = ?`,
        params: [trackId, PERFORMANCE_DATA_TYPE.HOT_CUE, cue.index],
        method: 'get',
        targetDb: this.DB,
      });

      if (existing) {
        // Update existing cue
        await kernel.send(EventType.DB_QUERY_REQUEST, {
          sql: `UPDATE PerformanceData SET data = ? WHERE trackId = ? AND type = ? AND position = ?`,
          params: [serializedData, trackId, PERFORMANCE_DATA_TYPE.HOT_CUE, cue.index],
          method: 'run',
          targetDb: this.DB,
        });
      } else {
        // Insert new cue (position field stores the pad index 0-7)
        await kernel.send(EventType.DB_QUERY_REQUEST, {
          sql: `INSERT INTO PerformanceData (trackId, type, position, data) VALUES (?, ?, ?, ?)`,
          params: [trackId, PERFORMANCE_DATA_TYPE.HOT_CUE, cue.index, serializedData],
          method: 'run',
          targetDb: this.DB,
        });
      }

      console.log(`[AnalysisService] Saved cue point ${cue.index + 1} for track ${trackId}`);
    } catch (error) {
      console.error(`[AnalysisService] Failed to save cue point for track ${trackId}:`, error);
      throw new Error(`Failed to save cue point: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all hot cue points for a track.
   *
   * @param trackId - Track ID
   * @returns Array of hot cue data (only set cues, not empty pads)
   */
  async getCuePoints(trackId: number): Promise<HotCueData[]> {
    try {
      const results = await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql: `SELECT data FROM PerformanceData WHERE trackId = ? AND type = ? ORDER BY position`,
        params: [trackId, PERFORMANCE_DATA_TYPE.HOT_CUE],
        method: 'all',
        targetDb: this.DB,
      });

      if (!results || !Array.isArray(results)) {
        return [];
      }

      const cues: HotCueData[] = [];
      for (const row of results) {
        if (row.data) {
          const cue = deserializeHotCue(row.data);
          if (cue) {
            cues.push(cue);
          }
        }
      }

      return cues;
    } catch (error) {
      console.error(`[AnalysisService] Failed to get cue points for track ${trackId}:`, error);
      return [];
    }
  }

  /**
   * Update a hot cue point (color, name, or position).
   *
   * @param trackId - Track ID
   * @param cueIndex - Pad index 0-7
   * @param updates - Partial cue data to update
   * @throws Error if cue not found or update fails
   */
  async updateCuePoint(
    trackId: number,
    cueIndex: number,
    updates: Partial<Pick<HotCueData, 'color' | 'name' | 'position'>>
  ): Promise<void> {
    try {
      // Get existing cue
      const result = await kernel.send<unknown, { data: Uint8Array } | null>(EventType.DB_QUERY_REQUEST, {
        sql: `SELECT data FROM PerformanceData WHERE trackId = ? AND type = ? AND position = ?`,
        params: [trackId, PERFORMANCE_DATA_TYPE.HOT_CUE, cueIndex],
        method: 'get',
        targetDb: this.DB,
      });

      if (!result || !result.data) {
        throw new Error(`Cue point ${cueIndex + 1} not found`);
      }

      const existingCue = deserializeHotCue(result.data);
      if (!existingCue) {
        throw new Error(`Failed to deserialize cue point ${cueIndex + 1}`);
      }

      // Apply updates
      const updatedCue: HotCueData = {
        ...existingCue,
        ...updates,
      };

      // Save updated cue
      const serializedData = serializeHotCue(updatedCue);
      await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql: `UPDATE PerformanceData SET data = ? WHERE trackId = ? AND type = ? AND position = ?`,
        params: [serializedData, trackId, PERFORMANCE_DATA_TYPE.HOT_CUE, cueIndex],
        method: 'run',
        targetDb: this.DB,
      });

      console.log(`[AnalysisService] Updated cue point ${cueIndex + 1} for track ${trackId}`);
    } catch (error) {
      console.error(`[AnalysisService] Failed to update cue point for track ${trackId}:`, error);
      throw new Error(`Failed to update cue point: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a hot cue point.
   *
   * @param trackId - Track ID
   * @param cueIndex - Pad index 0-7
   * @throws Error if delete fails
   */
  async deleteCuePoint(trackId: number, cueIndex: number): Promise<void> {
    try {
      await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql: `DELETE FROM PerformanceData WHERE trackId = ? AND type = ? AND position = ?`,
        params: [trackId, PERFORMANCE_DATA_TYPE.HOT_CUE, cueIndex],
        method: 'run',
        targetDb: this.DB,
      });

      console.log(`[AnalysisService] Deleted cue point ${cueIndex + 1} for track ${trackId}`);
    } catch (error) {
      console.error(`[AnalysisService] Failed to delete cue point for track ${trackId}:`, error);
      throw new Error(`Failed to delete cue point: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================
  // Loop Methods (PerformanceData type=2)
  // ============================================================

  /**
   * Save a loop to the database.
   * Uses upsert pattern - inserts new or updates existing loop at the same index.
   *
   * @param trackId - Track ID
   * @param loop - Loop data to save
   * @throws Error if database operation fails
   */
  async saveLoop(trackId: number, loop: LoopData): Promise<void> {
    try {
      const serializedData = serializeLoop(loop);

      // Check if loop at this index already exists
      const existing = await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql: `SELECT id FROM PerformanceData WHERE trackId = ? AND type = ? AND position = ?`,
        params: [trackId, PERFORMANCE_DATA_TYPE.LOOP, loop.index],
        method: 'get',
        targetDb: this.DB,
      });

      if (existing) {
        // Update existing loop
        await kernel.send(EventType.DB_QUERY_REQUEST, {
          sql: `UPDATE PerformanceData SET data = ? WHERE trackId = ? AND type = ? AND position = ?`,
          params: [serializedData, trackId, PERFORMANCE_DATA_TYPE.LOOP, loop.index],
          method: 'run',
          targetDb: this.DB,
        });
      } else {
        // Insert new loop (position field stores the loop slot index 0-7)
        await kernel.send(EventType.DB_QUERY_REQUEST, {
          sql: `INSERT INTO PerformanceData (trackId, type, position, data) VALUES (?, ?, ?, ?)`,
          params: [trackId, PERFORMANCE_DATA_TYPE.LOOP, loop.index, serializedData],
          method: 'run',
          targetDb: this.DB,
        });
      }

      console.log(`[AnalysisService] Saved loop ${loop.index + 1} for track ${trackId}`);
    } catch (error) {
      console.error(`[AnalysisService] Failed to save loop for track ${trackId}:`, error);
      throw new Error(`Failed to save loop: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all loops for a track.
   *
   * @param trackId - Track ID
   * @returns Array of loop data
   */
  async getLoops(trackId: number): Promise<LoopData[]> {
    try {
      const results = await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql: `SELECT data FROM PerformanceData WHERE trackId = ? AND type = ? ORDER BY position`,
        params: [trackId, PERFORMANCE_DATA_TYPE.LOOP],
        method: 'all',
        targetDb: this.DB,
      });

      if (!results || !Array.isArray(results)) {
        return [];
      }

      const loops: LoopData[] = [];
      for (const row of results) {
        if (row.data) {
          const loop = deserializeLoop(row.data);
          if (loop) {
            loops.push(loop);
          }
        }
      }

      return loops;
    } catch (error) {
      console.error(`[AnalysisService] Failed to get loops for track ${trackId}:`, error);
      return [];
    }
  }

  /**
   * Update a loop (color, name, or boundaries).
   *
   * @param trackId - Track ID
   * @param loopIndex - Loop slot index 0-7
   * @param updates - Partial loop data to update
   * @throws Error if loop not found or update fails
   */
  async updateLoop(
    trackId: number,
    loopIndex: number,
    updates: Partial<Pick<LoopData, 'color' | 'name' | 'inPoint' | 'outPoint'>>
  ): Promise<void> {
    try {
      // Get existing loop
      const result = await kernel.send<unknown, { data: Uint8Array } | null>(EventType.DB_QUERY_REQUEST, {
        sql: `SELECT data FROM PerformanceData WHERE trackId = ? AND type = ? AND position = ?`,
        params: [trackId, PERFORMANCE_DATA_TYPE.LOOP, loopIndex],
        method: 'get',
        targetDb: this.DB,
      });

      if (!result || !result.data) {
        throw new Error(`Loop ${loopIndex + 1} not found`);
      }

      const existingLoop = deserializeLoop(result.data);
      if (!existingLoop) {
        throw new Error(`Failed to deserialize loop ${loopIndex + 1}`);
      }

      // Apply updates
      const updatedLoop: LoopData = {
        ...existingLoop,
        ...updates,
      };

      // Save updated loop
      const serializedData = serializeLoop(updatedLoop);
      await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql: `UPDATE PerformanceData SET data = ? WHERE trackId = ? AND type = ? AND position = ?`,
        params: [serializedData, trackId, PERFORMANCE_DATA_TYPE.LOOP, loopIndex],
        method: 'run',
        targetDb: this.DB,
      });

      console.log(`[AnalysisService] Updated loop ${loopIndex + 1} for track ${trackId}`);
    } catch (error) {
      console.error(`[AnalysisService] Failed to update loop for track ${trackId}:`, error);
      throw new Error(`Failed to update loop: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a loop.
   *
   * @param trackId - Track ID
   * @param loopIndex - Loop slot index 0-7
   * @throws Error if delete fails
   */
  async deleteLoop(trackId: number, loopIndex: number): Promise<void> {
    try {
      await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql: `DELETE FROM PerformanceData WHERE trackId = ? AND type = ? AND position = ?`,
        params: [trackId, PERFORMANCE_DATA_TYPE.LOOP, loopIndex],
        method: 'run',
        targetDb: this.DB,
      });

      console.log(`[AnalysisService] Deleted loop ${loopIndex + 1} for track ${trackId}`);
    } catch (error) {
      console.error(`[AnalysisService] Failed to delete loop for track ${trackId}:`, error);
      throw new Error(`Failed to delete loop: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const analysisService = new AnalysisService();
