import * as mm from 'music-metadata-browser';
import { kernel } from '../../../shared/kernel/kernel-manager';
import { EventType } from '../../../shared/types/messaging';
import { scanDirectory } from '../utils/file-system';
import { storeFileHandlesBatch } from './file-handle-store';

export interface IngestProgress {
  total: number;
  processed: number;
  currentFile: string;
}

export type ProgressCallback = (progress: IngestProgress) => void;

export class IngestService {
  /**
   * Scans and ingests a directory handle.
   */
  async ingestDirectory(dirHandle: FileSystemDirectoryHandle, onProgress?: ProgressCallback) {
    const files: { handle: FileSystemFileHandle; relativePath: string }[] = [];

    // 1. Discovery phase
    for await (const file of scanDirectory(dirHandle)) {
      files.push(file);
    }

    const total = files.length;
    let processed = 0;

    // 2. Processing phase (chunked to prevent blocking)
    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const trackBatch: Array<{ data: any; handle: FileSystemFileHandle; path: string }> = [];

      for (const file of batch) {
        try {
          // Yield to main thread to keep UI responsive (60fps)
          await new Promise(resolve => setTimeout(resolve, 0));

          if (onProgress) {
            onProgress({ total, processed, currentFile: file.relativePath });
          }

          const trackData = await this.processFile(file.handle, file.relativePath);
          if (trackData) {
            trackBatch.push({
              data: trackData,
              handle: file.handle,
              path: file.relativePath,
            });
          }
        } catch (err) {
          console.error(`Failed to process ${file.relativePath}:`, err);
        }
        processed++;
      }

      // 3. Database batch insert
      if (trackBatch.length > 0) {
        await this.saveTracks(trackBatch.map(t => t.data));

        // 4. Query for inserted track IDs and store file handles
        const paths = trackBatch.map(t => t.path);
        const trackIds = await this.getTrackIdsByPaths(paths);

        const handleRecords = trackBatch
          .map(t => {
            const trackId = trackIds.get(t.path);
            if (trackId) {
              return { trackId, handle: t.handle, path: t.path };
            }
            return null;
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        if (handleRecords.length > 0) {
          console.log(`[IngestService] Storing ${handleRecords.length} file handles`);
          await storeFileHandlesBatch(handleRecords);
        } else {
          console.warn(`[IngestService] No track IDs found for paths:`, paths);
        }
      }
    }

    if (onProgress) {
      onProgress({ total, processed, currentFile: 'Complete' });
    }
  }

  private async processFile(handle: FileSystemFileHandle, relativePath: string) {
    const file = await handle.getFile();
    
    // Calculate partial hash for deduplication (first 1MB + size)
    const hash = await this.calculateHash(file);
    
    // Parse metadata
    const metadata = await mm.parseBlob(file);
    const { common, format } = metadata;

    return {
      title: common.title || handle.name,
      artist: common.artist || 'Unknown Artist',
      album: common.album || 'Unknown Album',
      genre: common.genre?.[0] || 'Unknown Genre',
      bpm: common.bpm || 0,
      key: common.key || '',
      duration: Math.round(format.duration || 0),
      path: relativePath,
      filename: handle.name,
      fileSize: file.size,
      bitrate: format.bitrate,
      fileType: file.type,
      dateAdded: Date.now(),
      comment: `hash:${hash}` // Store hash to satisfy AC4 within strict schema
    };
  }

  private async calculateHash(file: File): Promise<string> {
    // For performance on large libraries, we hash the first 1MB + file size
    const slice = file.slice(0, 1024 * 1024);
    const buffer = await slice.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hashHex}-${file.size}`;
  }

  private async getTrackIdsByPaths(paths: string[]): Promise<Map<string, number>> {
    const placeholders = paths.map(() => '?').join(',');
    const sql = `SELECT id, path FROM Track WHERE path IN (${placeholders})`;

    const rows = await kernel.send(EventType.DB_QUERY_REQUEST, {
      sql,
      params: paths,
      method: 'all',
      targetDb: 'm',
    });

    const map = new Map<string, number>();
    if (Array.isArray(rows)) {
      for (const row of rows) {
        map.set(row.path, row.id);
      }
    }
    return map;
  }

  private async saveTracks(tracks: any[]) {
    // Construct batch insert
    // Note: SQLite WASM selectObjects/exec handles params
    // We'll use individual inserts in a transaction or a multi-values insert
    // Since our database.worker handles one query at a time, we'll build a batch SQL
    
    const columns = [
      'title', 'artist', 'album', 'genre', 'bpm', 'key', 
      'duration', 'path', 'filename', 'dateAdded', 'comment'
    ];
    
    const placeholders = tracks.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
    const sql = `INSERT OR REPLACE INTO Track (${columns.join(',')}) VALUES ${placeholders}`;
    const params = tracks.flatMap(t => columns.map(col => (t as any)[col]));

    await kernel.send(EventType.DB_QUERY_REQUEST, {
      sql,
      params,
      method: 'run',
      targetDb: 'm'
    });
  }
}

export const ingestService = new IngestService();
