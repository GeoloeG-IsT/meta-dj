import { kernel } from '../../../shared/kernel/kernel-manager';
import { EventType } from '../../../shared/types/messaging';

export interface DBPlaylist {
  id: number;
  parentListId: number;
  title: string;
  isFolder: number; // SQLite uses 0/1 for BOOLEAN
  isSmartList: number; // SQLite uses 0/1 for BOOLEAN
  trackCount: number;
}

export interface SmartListRule {
  id?: number;
  playlistId?: number;
  field: string;
  operator: string;
  value: string;
  logic: string;
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
      const sql = `
        SELECT p.id, p.parentListId, p.title, p.isFolder, p.isSmartList, COUNT(pe.id) as trackCount
        FROM Playlist p
        LEFT JOIN PlaylistEntity pe ON p.id = pe.listId
        GROUP BY p.id
        ORDER BY p.title ASC
      `;
      const results = await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql,
        method: 'all',
        targetDb: this.DB
      });
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
   * Removes a track from a specific playlist and repairs the linked-list pointers.
   */
  async removeFromPlaylist(trackId: number, playlistId: number): Promise<void> {
    // 1. Find the entity to remove and its predecessor
    const predecessor = await kernel.send(EventType.DB_QUERY_REQUEST, {
      sql: `SELECT id FROM PlaylistEntity WHERE listId = ? AND nextEntityId = (SELECT id FROM PlaylistEntity WHERE listId = ? AND trackId = ? LIMIT 1)`,
      params: [playlistId, playlistId, trackId],
      method: 'get',
      targetDb: this.DB
    });

    const target = await kernel.send(EventType.DB_QUERY_REQUEST, {
      sql: `SELECT id, nextEntityId FROM PlaylistEntity WHERE listId = ? AND trackId = ? LIMIT 1`,
      params: [playlistId, trackId],
      method: 'get',
      targetDb: this.DB
    });

    if (target) {
      // 2. If there's a predecessor, link it to target's successor
      if (predecessor) {
        await kernel.send(EventType.DB_QUERY_REQUEST, {
          sql: `UPDATE PlaylistEntity SET nextEntityId = ? WHERE id = ?`,
          params: [target.nextEntityId, predecessor.id],
          method: 'run',
          targetDb: this.DB
        });
      }
      
      // 3. Delete the entity
      await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql: `DELETE FROM PlaylistEntity WHERE id = ?`,
        params: [target.id],
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

  /**
   * Creates a new smartlist.
   */
  async createSmartList(title: string, parentId: number = 0): Promise<number> {
    await this.validateParent(parentId);

    const sql = `INSERT INTO Playlist (title, parentListId, isFolder, isSmartList) VALUES (?, ?, 0, 1)`;
    const result = await kernel.send(EventType.DB_QUERY_REQUEST, {
      sql,
      params: [title, parentId],
      method: 'run',
      targetDb: this.DB
    });
    return result.changes;
  }

  /**
   * Fetches smartlist rules for a playlist.
   */
  async getSmartListRules(playlistId: number): Promise<SmartListRule[]> {
    const sql = `SELECT id, playlistId, field, operator, value, logic FROM SmartListRule WHERE playlistId = ? ORDER BY id ASC`;
    const results = await kernel.send(EventType.DB_QUERY_REQUEST, {
      sql,
      params: [playlistId],
      method: 'all',
      targetDb: this.DB
    });
    return results || [];
  }

  /**
   * Saves smartlist rules for a playlist and triggers refresh.
   */
  async saveSmartListRules(playlistId: number, rules: SmartListRule[]): Promise<{ success: boolean; trackCount: number }> {
    // 1. Delete existing rules
    await kernel.send(EventType.DB_QUERY_REQUEST, {
      sql: `DELETE FROM SmartListRule WHERE playlistId = ?`,
      params: [playlistId],
      method: 'run',
      targetDb: this.DB
    });

    // 2. Insert new rules
    for (const rule of rules) {
      await kernel.send(EventType.DB_QUERY_REQUEST, {
        sql: `INSERT INTO SmartListRule (playlistId, field, operator, value, logic) VALUES (?, ?, ?, ?, ?)`,
        params: [playlistId, rule.field, rule.operator, rule.value, rule.logic],
        method: 'run',
        targetDb: this.DB
      });
    }

    // 3. Trigger smartlist update (refreshes PlaylistEntity with matching tracks)
    const result = await kernel.send(EventType.DB_SMARTLIST_UPDATE, {
      playlistId,
      rules
    });

    return {
      success: result.success,
      trackCount: result.trackCount
    };
  }
}

export const playlistService = new PlaylistService();
