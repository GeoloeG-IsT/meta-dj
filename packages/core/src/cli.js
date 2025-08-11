#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const chokidar = require('chokidar');
const sqlite3 = require('sqlite3').verbose();
const { spawnSync } = require('child_process');
const { analyzeFile } = (() => {
    try { return require('../../analyzer/src/index'); } catch { return { analyzeFile: null }; }
})();

function getAnalyzer() {
    const mode = (process.env.DJ_ANALYZER || 'auto').toLowerCase();
    function rustAvailable() {
        const probe = spawnSync('meta-dj-analyzer-rs', ['--help'], { encoding: 'utf8' });
        // If ENOENT, binary not found. Any other exit means it exists.
        return !(probe.error && probe.error.code === 'ENOENT');
    }
    function analyzeWithRust(filePath) {
        const res = spawnSync('meta-dj-analyzer-rs', [filePath], { encoding: 'utf8' });
        if (res.error) throw res.error;
        if (res.status !== 0) throw new Error(`rust analyzer exited ${res.status}: ${res.stderr || ''}`);
        try { return JSON.parse(res.stdout); } catch (e) { throw new Error(`failed to parse rust JSON: ${e}`); }
    }
    if (mode === 'rust') {
        return (filePath) => analyzeWithRust(filePath);
    }
    if (mode === 'js') {
        if (!analyzeFile) throw new Error('JS analyzer not available');
        return (filePath) => analyzeFile(filePath);
    }
    // auto
    if (rustAvailable()) {
        return (filePath) => analyzeWithRust(filePath);
    }
    if (!analyzeFile) throw new Error('No analyzer available');
    return (filePath) => analyzeFile(filePath);
}

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
    if (!cmd || !['import', 'watch', 'search', 'analyze', 'autocue', 'cue', 'loop', 'playlist', 'export'].includes(cmd)) {
        console.log('Usage: node src/cli.js <import|watch|search|analyze|autocue|cue|loop|playlist|export> <args>');
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
        let analyzer;
        try { analyzer = getAnalyzer(); } catch (e) { console.log(String(e)); process.exit(1); }
        const db = openDb();
        const files = await new Promise((resolve, reject) => {
            db.all('SELECT id, file_path FROM tracks', (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
        for (const row of files) {
            let res;
            try { res = analyzer(row.file_path); } catch (e) { console.error('Analyze failed for', row.file_path, e); continue; }
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO analysis (id, track_id, analyzer_version, bpm, bpm_confidence, musical_key, key_confidence, beatgrid_json, lufs, peak, waveform_ref)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET analyzer_version=excluded.analyzer_version, bpm=excluded.bpm, bpm_confidence=excluded.bpm_confidence, musical_key=excluded.musical_key, key_confidence=excluded.key_confidence, beatgrid_json=excluded.beatgrid_json, lufs=excluded.lufs, peak=excluded.peak, waveform_ref=excluded.waveform_ref`,
                    [
                        generateId(row.id + (res.analyzer_version || res.analyzerVersion)),
                        row.id,
                        res.analyzer_version || res.analyzerVersion,
                        res.bpm,
                        res.bpm_confidence || res.bpmConfidence,
                        res.musical_key || res.musicalKey,
                        res.key_confidence || res.keyConfidence,
                        res.beatgrid_json || res.beatgridJson,
                        res.lufs,
                        res.peak,
                        res.waveform_ref || res.waveformRef,
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
    } else if (cmd === 'playlist') {
        const action = arg;
        const [, , , , a2, a3, a4] = process.argv;
        const db = openDb();
        async function createPlaylist(name, parentId, smartRulesJson) {
            const id = generateId(name + (parentId || '') + (smartRulesJson || ''));
            await new Promise((resolve, reject) => db.run(
                `INSERT INTO playlists (id, parent_id, name, smart_rules_json) VALUES (?, ?, ?, ?)`,
                [id, parentId || null, name, smartRulesJson || null],
                function (err) { if (err) return reject(err); resolve(); }
            ));
            console.log(id);
        }
        async function addTrack(playlistId, trackId) {
            const position = await new Promise((resolve, reject) => db.get(
                `SELECT COALESCE(MAX(position), -1) as maxpos FROM playlist_tracks WHERE playlist_id = ?`,
                [playlistId], (e, row) => e ? reject(e) : resolve((row && row.maxpos + 1) || 0)
            ));
            await new Promise((resolve, reject) => db.run(
                `INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)`,
                [playlistId, trackId, position], function (err) { if (err) return reject(err); resolve(); }
            ));
        }
        async function rmTrack(playlistId, trackId) {
            await new Promise((resolve, reject) => db.run(`DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?`, [playlistId, trackId], function (err) { if (err) return reject(err); resolve(); }));
        }
        function evalSmartRulesObj(rules) {
            const where = [];
            const params = [];
            let joins = '';
            if (rules.fts) {
                joins += ' JOIN tracks_fts f ON f.track_id = t.id ';
                where.push('tracks_fts MATCH ?');
                params.push(rules.fts);
            }
            if (rules.bpmMin != null || rules.bpmMax != null) {
                joins += ' LEFT JOIN analysis a ON a.track_id = t.id ';
                if (rules.bpmMin != null) { where.push('a.bpm >= ?'); params.push(Number(rules.bpmMin)); }
                if (rules.bpmMax != null) { where.push('a.bpm <= ?'); params.push(Number(rules.bpmMax)); }
            }
            if (rules.keyIn && Array.isArray(rules.keyIn) && rules.keyIn.length > 0) {
                joins += ' LEFT JOIN analysis a2 ON a2.track_id = t.id ';
                const placeholders = rules.keyIn.map(() => '?').join(',');
                where.push(`a2.musical_key IN (${placeholders})`);
                params.push(...rules.keyIn);
            }
            if (rules.tagIn && Array.isArray(rules.tagIn) && rules.tagIn.length > 0) {
                const placeholders = rules.tagIn.map(() => '?').join(',');
                where.push(`EXISTS (SELECT 1 FROM track_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.track_id = t.id AND tg.name IN (${placeholders}))`);
                params.push(...rules.tagIn);
            }
            const sql = `SELECT t.id, t.title FROM tracks t ${joins} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.title LIMIT 200`;
            return { sql, params };
        }
        async function smartEval(playlistId) {
            const row = await new Promise((resolve, reject) => db.get('SELECT smart_rules_json FROM playlists WHERE id = ?', [playlistId], (e, r) => e ? reject(e) : resolve(r)));
            if (!row || !row.smart_rules_json) { console.log('[]'); return; }
            let rules;
            try { rules = JSON.parse(row.smart_rules_json); } catch { console.log('[]'); return; }
            const { sql, params } = evalSmartRulesObj(rules);
            const rows = await new Promise((resolve, reject) => db.all(sql, params, (e, r) => e ? reject(e) : resolve(r || [])));
            for (const r of rows) console.log(r.title);
        }

        if (action === 'create') {
            const name = a2; const parentId = a3 || null;
            if (!name) { console.log('Usage: playlist create <name> [parentId]'); process.exit(1); }
            await createPlaylist(name, parentId, null);
        } else if (action === 'create-smart') {
            const name = a2; const rulesJson = a3;
            if (!name || !rulesJson) { console.log('Usage: playlist create-smart <name> <rulesJson>'); process.exit(1); }
            await createPlaylist(name, null, rulesJson);
        } else if (action === 'add') {
            const playlistId = a2; const trackId = a3;
            if (!playlistId || !trackId) { console.log('Usage: playlist add <playlistId> <trackId>'); process.exit(1); }
            await addTrack(playlistId, trackId); console.log('OK');
        } else if (action === 'rmtrack') {
            const playlistId = a2; const trackId = a3;
            if (!playlistId || !trackId) { console.log('Usage: playlist rmtrack <playlistId> <trackId>'); process.exit(1); }
            await rmTrack(playlistId, trackId); console.log('OK');
        } else if (action === 'list') {
            const rows = await new Promise((resolve, reject) => db.all('SELECT id, name, smart_rules_json FROM playlists ORDER BY name', [], (e, r) => e ? reject(e) : resolve(r || [])));
            for (const r of rows) console.log(`${r.id}|${r.name}|${r.smart_rules_json ? 'SMART' : 'STATIC'}`);
        } else if (action === 'tracks') {
            const playlistId = a2; if (!playlistId) { console.log('Usage: playlist tracks <playlistId>'); process.exit(1); }
            const rows = await new Promise((resolve, reject) => db.all('SELECT t.title FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id WHERE pt.playlist_id = ? ORDER BY pt.position', [playlistId], (e, r) => e ? reject(e) : resolve(r || [])));
            for (const r of rows) console.log(r.title);
        } else if (action === 'smart-eval') {
            const playlistId = a2; if (!playlistId) { console.log('Usage: playlist smart-eval <playlistId>'); process.exit(1); }
            await smartEval(playlistId);
        } else {
            console.log('Usage: playlist <create|create-smart|add|rmtrack|list|tracks|smart-eval> ...'); process.exit(1);
        }
        db.close();
    } else if (cmd === 'export') {
        const action = arg;
        const [, , , , a2, a3] = process.argv;
        if (action === 'm3u') {
            const playlistId = a2; const outDir = a3 || process.cwd();
            if (!playlistId) { console.log('Usage: export m3u <playlistId> [outDir]'); process.exit(1); }
            const db = openDb();
            const rows = await new Promise((resolve, reject) => db.all(
                'SELECT t.file_path, t.title, t.duration_ms FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id WHERE pt.playlist_id = ? ORDER BY pt.position',
                [playlistId], (e, r) => e ? reject(e) : resolve(r || [])
            ));
            const plName = await new Promise((resolve, reject) => db.get('SELECT name FROM playlists WHERE id = ?', [playlistId], (e, r) => e ? reject(e) : resolve((r && r.name) || 'playlist')));
            const fs = require('fs'); const path = require('path');
            const outPath = path.join(outDir, `${plName}.m3u8`);
            const lines = ['#EXTM3U'];
            for (const r of rows) {
                const secs = r.duration_ms ? Math.round(r.duration_ms / 1000) : -1;
                const title = r.title || '';
                lines.push(`#EXTINF:${secs},${title}`);
                lines.push(r.file_path);
            }
            fs.mkdirSync(outDir, { recursive: true });
            fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
            db.close();
            console.log(outPath);
        } else if (action === 'rekordbox-xml') {
            const playlistId = a2; const outFile = a3 || 'export.xml';
            if (!playlistId) { console.log('Usage: export rekordbox-xml <playlistId> [outFile]'); process.exit(1); }
            const db = openDb();
            const rows = await new Promise((resolve, reject) => db.all(
                'SELECT t.id, t.file_path, t.title, t.duration_ms FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id WHERE pt.playlist_id = ? ORDER BY pt.position',
                [playlistId], (e, r) => e ? reject(e) : resolve(r || [])
            ));
            const plName = await new Promise((resolve, reject) => db.get('SELECT name FROM playlists WHERE id = ?', [playlistId], (e, r) => e ? reject(e) : resolve((r && r.name) || 'Playlist')));
            const fs = require('fs'); const path = require('path');
            function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
            const entries = rows.length;
            const trackIdMap = new Map();
            let trackCounter = 1;
            const trackXml = rows.map((r) => {
                const tid = trackCounter++;
                trackIdMap.set(r.id, tid);
                const secs = r.duration_ms ? Math.round(r.duration_ms / 1000) : -1;
                const url = 'file://' + esc(path.resolve(r.file_path));
                return `    <TRACK TrackID="${tid}" Name="${esc(r.title || '')}" Location="${url}" Length="${secs}"/>`;
            }).join('\n');
            const playlistTracksXml = rows.map((r) => `        <TRACK Key="${trackIdMap.get(r.id)}"/>`).join('\n');
            const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
                `<DJ_PLAYLISTS Version="1.0.0">\n` +
                `  <PRODUCT Name="meta-dj" Version="0.1.0" Company="meta-dj"/>\n` +
                `  <COLLECTION Entries="${entries}">\n${trackXml}\n  </COLLECTION>\n` +
                `  <PLAYLISTS>\n` +
                `    <NODE Name="ROOT" Type="0">\n` +
                `      <NODE Name="${esc(plName)}" Type="1">\n` +
                `${playlistTracksXml}\n` +
                `      </NODE>\n` +
                `    </NODE>\n` +
                `  </PLAYLISTS>\n` +
                `</DJ_PLAYLISTS>\n`;
            fs.writeFileSync(outFile, xml, 'utf8');
            db.close();
            console.log(outFile);
        } else {
            console.log('Usage: export <m3u|rekordbox-xml> ...'); process.exit(1);
        }
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});



