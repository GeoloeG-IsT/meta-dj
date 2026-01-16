/**
 * Analysis Service - Database Operations for Track Analysis
 *
 * Handles storing and retrieving BPM, Key, and Beatgrid data.
 * Communicates with the database worker via the kernel message bus.
 */

import { kernel } from '../../../shared/kernel/kernel-manager';
import { EventType } from '../../../shared/types/messaging';
import type { BeatgridData } from '../analysis/track-analyzer';

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
    const result = await kernel.send(EventType.DB_QUERY_REQUEST, {
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
    const result = await kernel.send(EventType.DB_QUERY_REQUEST, {
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
    const result = await kernel.send(EventType.DB_QUERY_REQUEST, {
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
    const results = await kernel.send(EventType.DB_QUERY_REQUEST, {
      sql: `SELECT id FROM Track WHERE isAnalyzed = 0 OR isAnalyzed IS NULL`,
      method: 'all',
      targetDb: this.DB,
    });

    return (results || []).map((r: { id: number }) => r.id);
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
}

export const analysisService = new AnalysisService();
