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

const log = (...args: any[]) => console.log('[DB Worker]', ...args);
const error = (...args: any[]) => console.error('[DB Worker]', ...args);

log('Database Worker Script Loading...');

const init = async () => {
  if (dbs) return; // Already initialized

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
    // Check if tables exist, if not apply schema to m.db
    const tableCheck = dbs.m.selectObject("SELECT name FROM sqlite_master WHERE type='table' AND name='Track'");
    if (!tableCheck) {
      log('Applying Engine DJ Schema to m.db...');
      dbs.m.exec(schemaSql);
    }

  } catch (err: any) {
    error('Initialization failed:', err.name, err.message);
    throw err;
  }
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
        source.postMessage({ type: EventType.DB_READY });
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
        if (!dbs) throw new Error('Database not initialized');
        const { sql, params, method, targetDb = 'm' } = payload;
        const target = (dbs as any)[targetDb] || dbs.m;

        // log(`Executing ${method || 'all'} on ${targetDb}.db: ${sql.substring(0, 50)}...`);
        
        let result;
        if (method === 'run') {
            target.exec({ sql, bind: params });
            result = { changes: target.changes() };
        } else if (method === 'get') {
            result = target.selectObject(sql, params);
        } else {
            result = target.exec({ 
                sql, 
                bind: params, 
                returnValue: 'resultRows', 
                rowMode: 'object' 
            });
            // log(`Query result: ${result?.length || 0} rows`);
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
        if (!dbs) throw new Error('Database not initialized');
        dbs.m.exec(payload.sql); // Default to m.db for scripts
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

// Auto-start initialization if this worker is dedicated
// In our architecture, the kernel will spawn this and send DB_INIT
