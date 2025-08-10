#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const chokidar = require('chokidar');
const sqlite3 = require('sqlite3').verbose();
const { analyzeFile } = (() => {
    try { return require('../../analyzer/src/index'); } catch { return { analyzeFile: null }; }
})();

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

// --- Cues & Loops helpers ---
function insertCue(db, cue) {
    const id = cue.id || generateId(`${cue.track_id}|${cue.position_ms}|${cue.type}|${cue.label || ''}`);
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO cues (id, track_id, position_ms, color, label, type, autogen)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET position_ms=excluded.position_ms, color=excluded.color, label=excluded.label, type=excluded.type, autogen=excluded.autogen`,
            [id, cue.track_id, cue.position_ms, cue.color || null, cue.label || null, cue.type || 'HOT', cue.autogen ? 1 : 0],
            function (err) { if (err) return reject(err); resolve(id); }
        );
    });
}

function insertLoop(db, loop) {
    const id = loop.id || generateId(`${loop.track_id}|${loop.start_ms}|${loop.length_beats}|${loop.label || ''}`);
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO loops (id, track_id, start_ms, length_beats, color, label, autogen)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET start_ms=excluded.start_ms, length_beats=excluded.length_beats, color=excluded.color, label=excluded.label, autogen=excluded.autogen`,
            [id, loop.track_id, loop.start_ms, loop.length_beats, loop.color || null, loop.label || null, loop.autogen ? 1 : 0],
            function (err) { if (err) return reject(err); resolve(id); }
        );
    });
}

async function autoCuesAndLoops() {
    const db = openDb();
    const tracks = await new Promise((resolve, reject) => {
        db.all('SELECT id FROM tracks', (err, rows) => { if (err) return reject(err); resolve(rows || []); });
    });
    const analysisByTrack = await new Promise((resolve, reject) => {
        db.all('SELECT track_id, bpm FROM analysis', (err, rows) => { if (err) return reject(err); const map = new Map(); for (const r of rows) map.set(r.track_id, r); resolve(map); });
    });
    for (const t of tracks) {
        const a = analysisByTrack.get(t.id);
        const bpm = a && a.bpm ? a.bpm : 128;
        const beatMs = 60000 / bpm;
        const hotCuePositions = [0, Math.round(64 * beatMs)];
        for (const pos of hotCuePositions) {
            // eslint-disable-next-line no-await-in-loop
            await insertCue(db, { track_id: t.id, position_ms: pos, type: 'HOT', label: pos === 0 ? 'Intro' : 'Marker', autogen: 1 });
        }
        // 32-beat intro loop at start
        // eslint-disable-next-line no-await-in-loop
        await insertLoop(db, { track_id: t.id, start_ms: 0, length_beats: 32, label: 'Intro 32', autogen: 1 });
    }
    db.close();
    console.log(`Auto-generated cues/loops for ${tracks.length} tracks.`);
}

async function main() {
    const [, , cmd, arg] = process.argv;
    if (!cmd || !['import', 'watch', 'search', 'analyze', 'autocue', 'cue', 'loop'].includes(cmd)) {
        console.log('Usage: node src/cli.js <import|watch|search|analyze|autocue|cue|loop> <args>');
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
    } else if (cmd === 'analyze') {
        if (!analyzeFile) {
            console.log('Analyzer not available');
            process.exit(1);
        }
        const db = openDb();
        const files = await new Promise((resolve, reject) => {
            db.all('SELECT id, file_path FROM tracks', (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
        for (const row of files) {
            const res = analyzeFile(row.file_path);
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO analysis (id, track_id, analyzer_version, bpm, bpm_confidence, musical_key, key_confidence, beatgrid_json, lufs, peak, waveform_ref)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET analyzer_version=excluded.analyzer_version, bpm=excluded.bpm, bpm_confidence=excluded.bpm_confidence, musical_key=excluded.musical_key, key_confidence=excluded.key_confidence, beatgrid_json=excluded.beatgrid_json, lufs=excluded.lufs, peak=excluded.peak, waveform_ref=excluded.waveform_ref`,
                    [
                        generateId(row.id + res.analyzerVersion),
                        row.id,
                        res.analyzerVersion,
                        res.bpm,
                        res.bpmConfidence,
                        res.musicalKey,
                        res.keyConfidence,
                        res.beatgridJson,
                        res.lufs,
                        res.peak,
                        res.waveformRef,
                    ],
                    function (err) { if (err) return reject(err); resolve(); }
                );
            });
        }
        db.close();
        console.log(`Analyzed ${files.length} tracks.`);
    } else if (cmd === 'autocue') {
        await autoCuesAndLoops();
    } else if (cmd === 'cue') {
        const action = arg;
        const [, , , , a2, a3, a4, a5, a6] = process.argv;
        const db = openDb();
        if (action === 'add') {
            const trackId = a2; const pos = parseInt(a3, 10);
            const label = a4 || null; const color = a5 || null; const type = a6 || 'HOT';
            if (!trackId || Number.isNaN(pos)) { console.log('Usage: cue add <trackId> <positionMs> [label] [color] [type]'); process.exit(1); }
            await insertCue(db, { track_id: trackId, position_ms: pos, label, color, type, autogen: 0 });
            console.log('Cue added');
        } else if (action === 'rm') {
            const cueId = a2; if (!cueId) { console.log('Usage: cue rm <cueId>'); process.exit(1); }
            await new Promise((resolve, reject) => db.run('DELETE FROM cues WHERE id = ?', [cueId], function (err) { if (err) return reject(err); resolve(); }));
            console.log('Cue removed');
        } else if (action === 'list') {
            const trackId = a2; if (!trackId) { console.log('Usage: cue list <trackId>'); process.exit(1); }
            const rows = await new Promise((resolve, reject) => db.all('SELECT * FROM cues WHERE track_id = ? ORDER BY position_ms', [trackId], (e, r) => e ? reject(e) : resolve(r || [])));
            for (const r of rows) console.log(`${r.id}|${r.position_ms}|${r.label || ''}|${r.type}|${r.autogen}`);
        } else { console.log('Usage: cue <add|rm|list> ...'); process.exit(1); }
        db.close();
    } else if (cmd === 'loop') {
        const action = arg;
        const [, , , , a2, a3, a4, a5, a6] = process.argv;
        const db = openDb();
        if (action === 'add') {
            const trackId = a2; const start = parseInt(a3, 10); const lenBeats = parseInt(a4, 10);
            const label = a5 || null; const color = a6 || null;
            if (!trackId || Number.isNaN(start) || Number.isNaN(lenBeats)) { console.log('Usage: loop add <trackId> <startMs> <lengthBeats> [label] [color]'); process.exit(1); }
            await insertLoop(db, { track_id: trackId, start_ms: start, length_beats: lenBeats, label, color, autogen: 0 });
            console.log('Loop added');
        } else if (action === 'rm') {
            const loopId = a2; if (!loopId) { console.log('Usage: loop rm <loopId>'); process.exit(1); }
            await new Promise((resolve, reject) => db.run('DELETE FROM loops WHERE id = ?', [loopId], function (err) { if (err) return reject(err); resolve(); }));
            console.log('Loop removed');
        } else if (action === 'list') {
            const trackId = a2; if (!trackId) { console.log('Usage: loop list <trackId>'); process.exit(1); }
            const rows = await new Promise((resolve, reject) => db.all('SELECT * FROM loops WHERE track_id = ? ORDER BY start_ms', [trackId], (e, r) => e ? reject(e) : resolve(r || [])));
            for (const r of rows) console.log(`${r.id}|${r.start_ms}|${r.length_beats}|${r.label || ''}|${r.autogen}`);
        } else { console.log('Usage: loop <add|rm|list> ...'); process.exit(1); }
        db.close();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});



