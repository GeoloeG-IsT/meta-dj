/// <reference lib="webworker" />

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { EventType } from '../../../shared/types/messaging';
import schemaSql from '../schema/engine-dj-schema.sql?raw';

/**
 * Database Worker
 * 
 * Handles all SQLite operations using OPFS backend.
 * Manages m.db (Metadata) and p.db (Performance data) for Engine DJ compatibility.
 */

declare const self: DedicatedWorkerGlobalScope;

interface Dictionaries {
  m: any; // Metadata DB
  p: any; // Performance DB (future use)
}

let dbs: Dictionaries | null = null;
let sqlite3: any;
let initPromise: Promise<void> | null = null;

const log = (...args: any[]) => console.log('[DB Worker]', ...args);
const error = (...args: any[]) => console.error('[DB Worker]', ...args);

log('Database Worker Script Loading...');

const init = async () => {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      sqlite3 = await sqlite3InitModule({
        print: log,
        printErr: error,
      });

      if (!sqlite3.opfs) {
        throw new Error('OPFS is not available in this browser. Persistent database access required.');
      }

      log('SQLite WASM initialized. Opening databases in OPFS...');

      // AC3: Engine DJ Schema Mounting (m.db and p.db)
      dbs = {
        m: new sqlite3.oo1.OpfsDb('/m.db', 'c'),
        p: new sqlite3.oo1.OpfsDb('/p.db', 'c')
      };

      // Configure WAL mode for both
      dbs.m.exec('PRAGMA journal_mode=WAL;');
      dbs.m.exec('PRAGMA synchronous=NORMAL;');
      
      dbs.p.exec('PRAGMA journal_mode=WAL;');
      dbs.p.exec('PRAGMA synchronous=NORMAL;');

      log('Databases opened: m.db, p.db (WAL mode)');

      // Internal Schema Initialization
      const tableCheck = dbs.m.selectObject("SELECT name FROM sqlite_master WHERE type='table' AND name='Track'");
      if (!tableCheck) {
        log('Applying Engine DJ Schema to m.db...');
        dbs.m.exec(schemaSql);
      } else {
        log('Checking for schema migrations...');
        // Migration: Playlist table
        try {
          dbs.m.exec("ALTER TABLE Playlist ADD COLUMN parentListId INTEGER DEFAULT 0");
          dbs.m.exec("ALTER TABLE Playlist ADD COLUMN isFolder BOOLEAN DEFAULT 0");
          log('Migrated Playlist table');
        } catch (e) {}

        // Migration: PlaylistEntity table (fix for persistent "playlistId" NOT NULL constraints)
        try {
          const columns: any[] = dbs.m.exec({ sql: "PRAGMA table_info(PlaylistEntity)", returnValue: 'resultRows', rowMode: 'object' });
          const hasPlaylistId = columns.some(c => c.name === 'playlistId');
          
          if (hasPlaylistId) {
            log('Legacy playlistId detected. Performing hard migration of PlaylistEntity...');
            dbs.m.exec("ALTER TABLE PlaylistEntity RENAME TO temp_PlaylistEntity");
            dbs.m.exec(`
              CREATE TABLE PlaylistEntity (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                listId INTEGER,
                trackId INTEGER,
                nextEntityId INTEGER DEFAULT 0,
                membershipData BLOB,
                FOREIGN KEY(listId) REFERENCES Playlist(id),
                FOREIGN KEY(trackId) REFERENCES Track(id)
              )
            `);
            dbs.m.exec("INSERT INTO PlaylistEntity (id, listId, trackId, nextEntityId) SELECT id, playlistId, trackId, COALESCE(nextEntityId, 0) FROM temp_PlaylistEntity");
            dbs.m.exec("DROP TABLE temp_PlaylistEntity");
            log('Hard migration of PlaylistEntity complete.');
          } else {
            if (!columns.some(c => c.name === 'nextEntityId')) {
                dbs.m.exec("ALTER TABLE PlaylistEntity ADD COLUMN nextEntityId INTEGER DEFAULT 0");
            }
          }
        } catch (e) {
          log('PlaylistEntity check failed, ensuring table exists...');
          dbs.m.exec(`
            CREATE TABLE IF NOT EXISTS PlaylistEntity (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              listId INTEGER,
              trackId INTEGER,
              nextEntityId INTEGER DEFAULT 0,
              membershipData BLOB,
              FOREIGN KEY(listId) REFERENCES Playlist(id),
              FOREIGN KEY(trackId) REFERENCES Track(id)
            )
          `);
        }
      }

      // Migration: FTS5 Search Index
      try {
        dbs.m.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS Track_fts USING fts5(
            title, artist, album, 
            content='Track', 
            content_rowid='id'
          );
        `);

        // Triggers for automatic sync
        dbs.m.exec(`
          CREATE TRIGGER IF NOT EXISTS track_ai AFTER INSERT ON Track BEGIN
            INSERT INTO Track_fts(rowid, title, artist, album) VALUES (new.id, new.title, new.artist, new.album);
          END;
          CREATE TRIGGER IF NOT EXISTS track_ad AFTER DELETE ON Track BEGIN
            INSERT INTO Track_fts(Track_fts, rowid, title, artist, album) VALUES('delete', old.id, old.title, old.artist, old.album);
          END;
          CREATE TRIGGER IF NOT EXISTS track_au AFTER UPDATE ON Track BEGIN
            INSERT INTO Track_fts(Track_fts, rowid, title, artist, album) VALUES('delete', old.id, old.title, old.artist, old.album);
            INSERT INTO Track_fts(rowid, title, artist, album) VALUES (new.id, new.title, new.artist, new.album);
          END;
        `);

        // Initial population if FTS table is empty
        const ftsCount = dbs.m.selectObject("SELECT count(*) as count FROM Track_fts");
        if (ftsCount.count === 0) {
          log('Populating FTS index from existing tracks...');
          dbs.m.exec("INSERT INTO Track_fts(rowid, title, artist, album) SELECT id, title, artist, album FROM Track");
        }
        log('FTS5 Search Index initialized');
      } catch (e) {
        error('FTS5 Initialization failed:', e);
      }
    } catch (err: any) {
      error('Initialization failed:', err.name, err.message);
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
};

// Message handler for the main thread or transferred port
const handleMessage = async (event: MessageEvent, source: MessagePort | DedicatedWorkerGlobalScope) => {
  const { id, type, payload } = event.data;

  if (type === 'CONNECT_KERNEL') {
    const port = event.ports[0];
    port.start();
    port.onmessage = (e) => handleMessage(e, port);
    log('Connected to Kernel via MessageChannel');
    return;
  }

  try {
    switch (type) {
      case EventType.DB_INIT:
        await init();
        source.postMessage({ type: 'DB_READY' });
        break;

      case EventType.DB_PING:
        source.postMessage({
          id,
          type: EventType.DB_QUERY_RESPONSE,
          payload: { ready: !!dbs },
          timestamp: Date.now()
        });
        break;

      case EventType.DB_QUERY_REQUEST: {
        if (!dbs) {
            log('Query received before init, waiting...');
            await init();
        }
        if (!dbs) throw new Error('Database initialization failed');
        
        const { sql, params, method, targetDb = 'm' } = payload;
        const target = (dbs as any)[targetDb] || dbs.m;

        const bindOptions = (params && params.length > 0) ? { bind: params } : {};

        let result;
        if (method === 'run') {
            target.exec({ sql, ...bindOptions });
            result = { changes: target.changes(), success: true };
        } else if (method === 'get') {
            result = target.selectObject(sql, (params && params.length > 0) ? params : undefined);
        } else {
            result = target.exec({ 
                sql, 
                ...bindOptions,
                returnValue: 'resultRows', 
                rowMode: 'object' 
            });
        }

        source.postMessage({
          id,
          type: EventType.DB_QUERY_RESPONSE,
          payload: result,
          timestamp: Date.now()
        });
        break;
      }

      case EventType.DB_EXEC_SCRIPT:
        if (!dbs) await init();
        if (!dbs) throw new Error('Database initialization failed');
        
        dbs.m.exec(payload.sql);
        source.postMessage({
          id,
          type: EventType.DB_QUERY_RESPONSE,
          payload: { success: true },
          timestamp: Date.now()
        });
        break;
      
      case EventType.LOG:
          log('Log received:', payload);
          break;

      default:
        break;
    }
  } catch (err: any) {
    error('Query failed:', err.message);
    source.postMessage({
      id,
      type: EventType.DB_ERROR,
      payload: err.message,
      timestamp: Date.now()
    });
  }
};

self.onmessage = (event) => handleMessage(event, self as any);