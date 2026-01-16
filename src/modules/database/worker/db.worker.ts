/// <reference lib="webworker" />
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { WorkerMessage, WorkerResponse } from '../../../shared/types';
import { DbAction, type Track } from '../../../shared/types/db-types';
import schemaSql from '../schema/engine-schema.sql?raw';

declare const self: DedicatedWorkerGlobalScope;


interface SQLiteDatabase {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exec(arg: any, opts?: any): any;
}

let db: SQLiteDatabase | null = null;
const DB_NAME = 'm.db';

const initDB = async () => {
    try {
        const sqlite3 = await sqlite3InitModule({
            print: console.log,
            printErr: console.error,
            locateFile: (file: string) => {
                if (file === 'sqlite3.wasm') {
                    // Use absolute path from public root
                    return '/sqlite3.wasm';
                }
                return file;
            },
        });

        if ('opfs' in sqlite3) {
            db = new sqlite3.oo1.OpfsDb(DB_NAME);
            console.log('SQLite (OPFS) initialized successfully');
        } else {
            console.warn('OPFS not authorized/available. Falling back to transient DB.');
            db = new sqlite3.oo1.DB(DB_NAME, 'ct');
        }

        if (!db) throw new Error('Database creation failed');

        // Enable WAL mode
        db.exec('PRAGMA journal_mode=WAL;');

        // Apply Schema
        if (schemaSql) {
            db.exec(schemaSql);
            console.log('Schema applied successfully');
        }

        return true;
    } catch (err) {
        console.error('Failed to initialize SQLite:', err);
        throw err;
    }
};

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const { id, type, payload } = e.data;
    let result: unknown = null;
    let success = true;
    let error: string | undefined;

    try {
        switch (type) {
            case DbAction.INIT:
                if (!db) {
                    await initDB();
                }
                result = { status: 'initialized' };
                break;

            case DbAction.EXEC_SQL:
                if (!db) throw new Error('DB not initialized');
                // payload assumed to be { sql: string, bind?: any[] }
                // eslint-disable-next-line no-case-declarations
                const { sql, bind } = payload as { sql: string; bind?: unknown[] };
                result = db.exec({ sql, bind, returnValue: 'resultRows' });
                break;

            case DbAction.INGEST_TRACK: {
                if (!db) throw new Error('DB not initialized');
                // payload is typed as Track in message-bus, but comes as unknown in WorkerMessage
                // Using Partial<Track> because metadata parsing might return partials, but DB requires key fields.
                // Assuming validation happened before or defaults are applied.
                const track = payload as Track;

                // Using INSERT OR REPLACE to update metadata if file is re-scanned
                // Using named parameters for clarity
                const insertSql = `
                    INSERT INTO Track (
                        title, artist, album, genre, bpm, key, duration, 
                        path, filename, artwork, dateAdded, analysisData
                    ) VALUES (
                        $title, $artist, $album, $genre, $bpm, $key, $duration,
                        $path, $filename, $artwork, $dateAdded, $analysisData
                    )
                    ON CONFLICT(path) DO UPDATE SET
                        title = excluded.title,
                        artist = excluded.artist,
                        album = excluded.album,
                        bpm = excluded.bpm,
                        key = excluded.key,
                        duration = excluded.duration,
                        artwork = excluded.artwork,
                        analysisData = excluded.analysisData;
                `;

                db.exec({
                    sql: insertSql,
                    bind: {
                        $title: track.title,
                        $artist: track.artist,
                        $album: track.album,
                        $genre: track.genre,
                        $bpm: track.bpm,
                        $key: track.key,
                        $duration: track.duration,
                        $path: track.path,
                        $filename: track.filename,
                        $artwork: track.artwork,
                        $dateAdded: track.dateAdded || Date.now(),
                        $analysisData: track.analysisData
                    }
                });
                result = { success: true, path: track.path };
                break;
            }

            default:
                throw new Error(`Unknown action: ${type}`);
        }
    } catch (err: unknown) {
        success = false;
        error = err instanceof Error ? err.message : String(err);
        console.error(`Worker Error [${type}]:`, error);
    }

    const response: WorkerResponse = {
        id,
        success,
        payload: result,
        error,
        timestamp: Date.now(),
    };

    self.postMessage(response);
};
