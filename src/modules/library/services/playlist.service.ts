import { kernel } from '../../../shared/kernel/kernel-manager';
import { EventType } from '../../../shared/types/messaging';

export interface DBPlaylist {
  id: number;
  parentListId: number;
  title: string;
  isFolder: number; // SQLite uses 0/1 for BOOLEAN
}

export class PlaylistService {
  private readonly DB = 'm';

  /**
   * Validates that a parent is eligible to contain children (is a folder).
   */
  private async validateParent(parentId: number): Promise<void> {
    if (parentId === 0) return;

    const parent = await kernel.send(EventType.DB_QUERY_REQUEST, {
      sql: `SELECT isFolder FROM Playlist WHERE id = ?`,
      params: [parentId],
      method: 'get',
      targetDb: this.DB
    });

    if (!parent) throw new Error('Parent not found');

    if (parent.isFolder === 0) {
      const error = new Error('Hierarchical Integrity Violation: Cannot create children inside a Playlist.');
      (error as any).code = 409;
      throw error;
    }
  }

  /**
   * Fetches the entire playlist/crate hierarchy.
   */
  async getHierarchy(): Promise<DBPlaylist[]> {
    try {
      const sql = `SELECT id, parentListId, title, isFolder FROM Playlist ORDER BY title ASC`;
      const results = await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql,
        method: 'all',
        targetDb: this.DB
      });
      // console.log('[PlaylistService] Hierarchy Results:', results);
      return results || [];
    } catch (e) {
      console.error('[PlaylistService] Failed to get hierarchy:', e);
      return [];
    }
  }

  /**
   * Creates a new crate or playlist.
   */
  async createPlaylist(title: string, parentId: number = 0, isFolder: boolean = false): Promise<number> {
    await this.validateParent(parentId);

    const sql = `INSERT INTO Playlist (title, parentListId, isFolder) VALUES (?, ?, ?)`;
    const result = await kernel.send(EventType.DB_QUERY_REQUEST, {
      sql,
      params: [title, parentId, isFolder ? 1 : 0],
      method: 'run',
      targetDb: this.DB
    });
    // Assuming database.worker returns info about the last inserted ID if needed, 
    // or we can query it. For now we just return a placeholder or success.
    return result.changes; 
  }

  /**
   * Renames an item.
   */
  async rename(id: number, newTitle: string): Promise<void> {
    const sql = `UPDATE Playlist SET title = ? WHERE id = ?`;
    await kernel.send(EventType.DB_QUERY_REQUEST, {
      sql,
      params: [newTitle, id],
      method: 'run',
      targetDb: this.DB
    });
  }

  /**
   * Deletes an item and its children (recursive delete handled by DB or manually).
   * Note: For MVP, we'll do a simple delete.
   */
  async delete(id: number): Promise<void> {
    const sql = `DELETE FROM Playlist WHERE id = ?`;
    await kernel.send(EventType.DB_QUERY_REQUEST, {
      sql,
      params: [id],
      method: 'run',
      targetDb: this.DB
    });
  }

  /**
   * Moves an item in the hierarchy.
   */
  async move(id: number, newParentId: number): Promise<void> {
    await this.validateParent(newParentId);

    const sql = `UPDATE Playlist SET parentListId = ? WHERE id = ?`;
    await kernel.send(EventType.DB_QUERY_REQUEST, {
      sql,
      params: [newParentId, id],
      method: 'run',
      targetDb: this.DB
    });
  }

  /**
   * Adds a track to a playlist with linked-list logic.
   */
  async addTrackToPlaylist(trackId: number, playlistId: number): Promise<void> {
    // 1. Find the current tail of the playlist
    const tailQuery = `SELECT id FROM PlaylistEntity WHERE listId = ? AND nextEntityId = 0 LIMIT 1`;
    const tail = await kernel.send(EventType.DB_QUERY_REQUEST, {
      sql: tailQuery,
      params: [playlistId],
      method: 'get',
      targetDb: this.DB
    });

    // 2. Insert new entity
    const insertQuery = `INSERT INTO PlaylistEntity (listId, trackId, nextEntityId) VALUES (?, ?, 0)`;
    await kernel.send(EventType.DB_QUERY_REQUEST, {
      sql: insertQuery,
      params: [playlistId, trackId],
      method: 'run',
      targetDb: this.DB
    });

    // We'd ideally need the ID of the inserted row to update the tail
    // Since our SQLite worker logic is simple, let's assume we can get it or use a subquery
    if (tail) {
        const updateTail = `UPDATE PlaylistEntity SET nextEntityId = (SELECT id FROM PlaylistEntity WHERE listId = ? AND trackId = ? ORDER BY id DESC LIMIT 1) WHERE id = ?`;
        await kernel.send(EventType.DB_QUERY_REQUEST, {
            sql: updateTail,
            params: [playlistId, trackId, tail.id],
            method: 'run',
            targetDb: this.DB
        });
    }
  }

  /**
   * Deletes a single track.
   */
  async deleteTrack(id: number): Promise<void> {
    const sql = `DELETE FROM Track WHERE id = ?`;
    await kernel.send(EventType.DB_QUERY_REQUEST, {
      sql,
      params: [id],
      method: 'run',
      targetDb: this.DB
    });
  }

  /**
   * Deletes all tracks from the library.
   */
  async deleteAllTracks(): Promise<void> {
    const sql = `DELETE FROM Track`;
    await kernel.send(EventType.DB_QUERY_REQUEST, {
      sql,
      method: 'run',
      targetDb: this.DB
    });
  }
}

export const playlistService = new PlaylistService();
