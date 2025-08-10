#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const chokidar = require('chokidar');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = process.env.DJ_DB_PATH || path.resolve(process.cwd(), 'meta_dj.local.sqlite');
const AUDIO_EXTS = new Set(['.mp3', '.flac', '.wav', '.aiff', '.aif', '.m4a', '.ogg']);

function openDb() {
    const db = new sqlite3.Database(DB_PATH);
    db.serialize(() => db.run('PRAGMA foreign_keys = ON;'));
    return db;
}

function generateId(input) {
    return crypto.createHash('sha1').update(input).digest('hex');
}

function upsertTrack(db, filePath) {
    return new Promise((resolve, reject) => {
        const id = generateId(filePath);
        const contentHash = id; // placeholder; later use audio content hash
        const title = path.basename(filePath, path.extname(filePath));
        db.run(
            `INSERT INTO tracks (id, file_path, content_hash, title)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET file_path = excluded.file_path, title = excluded.title`,
            [id, filePath, contentHash, title],
            function (err) {
                if (err) return reject(err);
                db.serialize(() => {
                    db.run(`DELETE FROM tracks_fts WHERE track_id = ?`, [id]);
                    db.run(
                        `INSERT INTO tracks_fts (track_id, title, artists, album, tags, comments)
             VALUES (?, ?, '', '', '', '')`,
                        [id, title],
                        function (err2) {
                            if (err2) return reject(err2);
                            resolve();
                        }
                    );
                });
            }
        );
    });
}

function removeTrack(db, filePath) {
    return new Promise((resolve, reject) => {
        const id = generateId(filePath);
        db.run(`DELETE FROM tracks WHERE id = ?`, [id], function (err) {
            if (err) return reject(err);
            db.run(`DELETE FROM tracks_fts WHERE track_id = ?`, [id], function (err2) {
                if (err2) return reject(err2);
                resolve();
            });
        });
    });
}

async function importFolder(root) {
    const db = openDb();
    const files = await walk(root);
    const audioFiles = files.filter((f) => AUDIO_EXTS.has(path.extname(f).toLowerCase()));
    for (const f of audioFiles) {
        // eslint-disable-next-line no-await-in-loop
        await upsertTrack(db, f);
    }
    db.close();
    console.log(`Imported ${audioFiles.length} audio files.`);
}

function searchTracks(query) {
    return new Promise((resolve, reject) => {
        const db = openDb();
        const sql = `SELECT t.id, t.title, t.file_path
                 FROM tracks_fts f
                 JOIN tracks t ON t.id = f.track_id
                 WHERE tracks_fts MATCH ?
                 ORDER BY t.title LIMIT 50`;
        db.all(sql, [query], (err, rows) => {
            if (err) return reject(err);
            db.close();
            resolve(rows || []);
        });
    });
}

function walk(dir) {
    return new Promise((resolve) => {
        const results = [];
        (function next(current) {
            const list = fs.readdirSync(current, { withFileTypes: true });
            for (const entry of list) {
                const full = path.join(current, entry.name);
                if (entry.isDirectory()) next(full);
                else results.push(full);
            }
            if (current === dir) resolve(results);
        })(dir);
    });
}

function watchFolder(root) {
    const db = openDb();
    const watcher = chokidar.watch(root, { ignoreInitial: false, awaitWriteFinish: true });

    watcher.on('add', async (filePath) => {
        if (!AUDIO_EXTS.has(path.extname(filePath).toLowerCase())) return;
        try {
            await upsertTrack(db, filePath);
            console.log('Added', filePath);
        } catch (e) {
            console.error('Add error', filePath, e);
        }
    });

    watcher.on('unlink', async (filePath) => {
        if (!AUDIO_EXTS.has(path.extname(filePath).toLowerCase())) return;
        try {
            await removeTrack(db, filePath);
            console.log('Removed', filePath);
        } catch (e) {
            console.error('Remove error', filePath, e);
        }
    });

    process.on('SIGINT', () => {
        watcher.close();
        db.close();
        process.exit(0);
    });
}

async function main() {
    const [, , cmd, arg] = process.argv;
    if (!cmd || !['import', 'watch', 'search'].includes(cmd)) {
        console.log('Usage: node src/cli.js <import|watch|search> <folder|query>');
        process.exit(1);
    }
    if (cmd === 'import') {
        const target = arg || process.cwd();
        await importFolder(target);
    } else if (cmd === 'watch') {
        const target = arg || process.cwd();
        watchFolder(target);
    } else if (cmd === 'search') {
        const q = arg || '';
        if (!q) {
            console.log('Provide a query, e.g., "node src/cli.js search track*"');
            process.exit(1);
        }
        const rows = await searchTracks(q);
        for (const r of rows) console.log(r.title);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});



