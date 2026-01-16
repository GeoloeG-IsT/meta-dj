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
            // 1. Rename old table
            dbs.m.exec("ALTER TABLE PlaylistEntity RENAME TO temp_PlaylistEntity");
            
            // 2. Create new table with correct schema
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

            // 3. Copy data (map playlistId to listId)
            dbs.m.exec("INSERT INTO PlaylistEntity (id, listId, trackId, nextEntityId) SELECT id, playlistId, trackId, COALESCE(nextEntityId, 0) FROM temp_PlaylistEntity");
            
            // 4. Drop temp table
            dbs.m.exec("DROP TABLE temp_PlaylistEntity");
            log('Hard migration of PlaylistEntity complete.');
          } else {
            // Ensure nextEntityId exists for newer schemas
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
    } catch (err: any) {
      error('Initialization failed:', err.name, err.message);
      initPromise = null; // Allow retry
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

        // CRITICAL FIX: Only pass 'bind' if there are actually parameters to bind.
        // SQLite WASM throws "This statement has no bindable parameters" if bind is an empty array for a 0-param query.
        const bindOptions = (params && params.length > 0) ? { bind: params } : {};

        let result;
        if (method === 'run') {
            target.exec({ sql, ...bindOptions });
            result = { changes: target.changes(), success: true };
        } else if (method === 'get') {
            // selectObject doesn't take an options object, it takes (sql, params)
            // If params is empty/undefined, pass undefined
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
        // specific event types might be handled elsewhere or ignored
        // log('Unknown message type:', type);
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
