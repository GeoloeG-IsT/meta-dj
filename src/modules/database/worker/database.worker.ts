import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

/**
 * Database Worker
 * 
 * Handles all SQLite operations using OPFS backend.
 * Runs in a dedicated worker thread to prevent blocking the UI.
 */

let db: any;
let sqlite3: any;

const log = (...args: any[]) => console.log('[DB Worker]', ...args);
const error = (...args: any[]) => console.error('[DB Worker]', ...args);

log('Database Worker Script Loading...');

const init = async () => {
  if (db) return; // Already initialized

  try {
    // log('init() called - Starting SQLite WASM initialization');
    
    // Check for OPFS support
    // log('Initializing SQLite WASM...');
    sqlite3 = await sqlite3InitModule({
      print: log,
      printErr: error,
    });

    // log('SQLite WASM initialized. Opening database in OPFS...');
    
    if (sqlite3.opfs) {
      db = new sqlite3.oo1.OpfsDb('/meta-dj.db', 'c');
      log('OPFS database opened:', db.filename);
    } else {
      db = new sqlite3.oo1.DB('/meta-dj.db', 'c');
      log('OPFS not available, using persistent fallback:', db.filename);
    }

    db.exec('PRAGMA journal_mode=WAL;');
    db.exec('PRAGMA synchronous=NORMAL;');
    log('Database configured (WAL mode)');

  } catch (err: any) {
    error('Initialization failed:', err.name, err.message);
    throw err; // Re-throw to be caught by caller
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
      case 'DB_INIT':
        await init();
        source.postMessage({ type: 'DB_READY' });
        break;
// ...

      case 'DB_QUERY_REQUEST':
        const { sql, params, method } = payload;
        log(`Executing ${method || 'all'}: ${sql.substring(0, 50)}...`);
        
        let result;
        if (method === 'run') {
            db.run(sql, params);
            result = { changes: db.changes() };
        } else if (method === 'get') {
            result = db.selectObject(sql, params);
        } else {
            result = db.selectObjects(sql, params);
        }

        source.postMessage({
          id,
          type: 'DB_QUERY_RESPONSE',
          payload: result,
          timestamp: Date.now()
        });
        break;

      case 'DB_EXEC_SCRIPT':
        db.exec(payload.sql);
        source.postMessage({
          id,
          type: 'DB_QUERY_RESPONSE',
          payload: { success: true },
          timestamp: Date.now()
        });
        break;
      
      case 'LOG':
          log('Log received:', payload);
          break;

      default:
        log('Unknown message type:', type);
    }
  } catch (err: any) {
    error('Query failed:', err.message);
    source.postMessage({
      id,
      type: 'DB_ERROR',
      payload: err.message,
      timestamp: Date.now()
    });
  }
};

self.onmessage = (event) => handleMessage(event, self as any);

// Auto-start initialization if this worker is dedicated
// In our architecture, the kernel will spawn this and send DB_INIT
