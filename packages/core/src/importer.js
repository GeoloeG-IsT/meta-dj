/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { openDb, dbRun, generateId } = require('./db');
const { readAudioMetadata } = require('./metadata');
const { ensureArtist, ensureAlbum } = require('./repositories');

const AUDIO_EXTS = new Set(['.mp3', '.flac', '.wav', '.aiff', '.aif', '.m4a', '.ogg']);

async function upsertTrack(db, filePath) {
    const id = generateId(filePath);
    const contentHash = id; // placeholder
    const meta = await readAudioMetadata(filePath);

    let albumId = null;
    if (meta.albumName) albumId = await ensureAlbum(db, meta.albumName, meta.year);
    const artistIds = [];
    for (const a of meta.artistNames) {
        const aid = await ensureArtist(db, a);
        if (aid) artistIds.push(aid);
    }

    // Normalize BPM: prefer keeping within 60..200 by halving/doubling raw value
    function normalizeBpm(raw) {
        if (raw == null || Number.isNaN(raw)) return null;
        let bpm = Number(raw);
        while (bpm > 200) bpm /= 2;
        while (bpm < 60) bpm *= 2;
        return Math.round(bpm * 100) / 100;
    }

    // Normalize key: map common forms to "<Note> maj|min" with sharps
    function normalizeKey(raw) {
        if (!raw) return null;
        const s = String(raw).trim();
        // Camelot like "8A"/"5B" not handled here (future)
        // Map flats to sharps
        const flatToSharp = { Ab: 'G#', Bb: 'A#', Cb: 'B', Db: 'C#', Eb: 'D#', Fb: 'E', Gb: 'F#' };
        // Extract like "Bbmin", "Dmaj", "F# minor", "Eb Major"
        const m = s.match(/^\s*([A-Ga-g][#b]?)[\s-]*(maj(or)?|minor|min|M|m)?\s*$/);
        if (!m) return s; // fallback
        const noteRaw = m[1];
        let note = noteRaw.charAt(0).toUpperCase() + (noteRaw.charAt(1) || '');
        if (flatToSharp[note]) note = flatToSharp[note];
        let qual = (m[2] || '').toLowerCase();
        if (qual === 'm' || qual === 'min' || qual === 'minor') qual = 'min';
        else qual = 'maj';
        return `${note} ${qual}`;
    }

    const tagBpmNorm = normalizeBpm(meta.tagBpmRaw);
    const tagKeyNorm = normalizeKey(meta.tagKeyRaw);

    const params = [
        id,
        filePath,
        contentHash,
        meta.title,
        albumId ?? null,
        meta.durationMs ?? null,
        meta.codec ?? null,
        meta.bitRate ?? null,
        meta.sampleRate ?? null,
        meta.channels ?? null,
        meta.year ?? null,
        (meta.genres && meta.genres[0]) || null,
        meta.comments ?? null,
        meta.rating ?? null,
        meta.trackNo ?? null,
        meta.trackTotal ?? null,
        meta.discNo ?? null,
        meta.discTotal ?? null,
        tagBpmNorm,
        tagKeyNorm,
        // raw copies
        meta.tagBpmRaw ?? null,
        meta.tagKeyRaw ?? null,
    ];

    await dbRun(db,
        `INSERT INTO tracks (id, file_path, content_hash, title, album_id, duration_ms, codec, bit_rate_kbps, sample_rate_hz, channels, year, genre, comments, rating, track_no, track_total, disc_no, disc_total, tag_bpm, tag_key, tag_bpm_raw, tag_key_raw)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       file_path = excluded.file_path,
       title = excluded.title,
       album_id = COALESCE(excluded.album_id, album_id),
       duration_ms = COALESCE(excluded.duration_ms, duration_ms),
       codec = COALESCE(excluded.codec, codec),
       bit_rate_kbps = COALESCE(excluded.bit_rate_kbps, bit_rate_kbps),
       sample_rate_hz = COALESCE(excluded.sample_rate_hz, sample_rate_hz),
       channels = COALESCE(excluded.channels, channels),
       year = COALESCE(excluded.year, year),
       genre = COALESCE(excluded.genre, genre),
       comments = COALESCE(excluded.comments, comments),
       rating = COALESCE(excluded.rating, rating),
       track_no = COALESCE(excluded.track_no, track_no),
       track_total = COALESCE(excluded.track_total, track_total),
       disc_no = COALESCE(excluded.disc_no, disc_no),
       disc_total = COALESCE(excluded.disc_total, disc_total),
       tag_bpm = COALESCE(excluded.tag_bpm, tag_bpm),
        tag_key = COALESCE(excluded.tag_key, tag_key),
        tag_bpm_raw = COALESCE(excluded.tag_bpm_raw, tag_bpm_raw),
        tag_key_raw = COALESCE(excluded.tag_key_raw, tag_key_raw)`,
        params
    );

    await dbRun(db, `DELETE FROM track_artists WHERE track_id = ?`, [id]);
    let position = 0;
    for (const aid of artistIds) {
        await dbRun(db, `INSERT OR IGNORE INTO track_artists (track_id, artist_id, role, position) VALUES (?, ?, 'PRIMARY', ?)`, [id, aid, position++]);
    }

    const ftsArtists = [...meta.artistNames, ...meta.albumArtistNames].filter(Boolean).join(', ');
    await dbRun(db, `DELETE FROM tracks_fts WHERE track_id = ?`, [id]);
    await dbRun(db,
        `INSERT INTO tracks_fts (track_id, title, artists, album, tags, comments)
     VALUES (?, ?, ?, ?, ?, ?)`,
        [id, meta.title, ftsArtists, meta.albumName || '', (meta.genres && meta.genres.join(', ')) || '', meta.comments || '']
    );

    if (albumId && meta.albumArtistNames.length) {
        await dbRun(db, `DELETE FROM album_artists WHERE album_id = ?`, [albumId]);
        let apos = 0;
        for (const name of meta.albumArtistNames) {
            const aid = await ensureArtist(db, name);
            if (aid) await dbRun(db, `INSERT OR IGNORE INTO album_artists (album_id, artist_id, role, position) VALUES (?, ?, 'PRIMARY', ?)`, [albumId, aid, apos++]);
        }
    }

    return id;
}

function walk(dir) {
    return new Promise((resolve) => {
        const results = [];
        (function next(current) {
            const list = fs.readdirSync(current, { withFileTypes: true });
            for (const entry of list) {
                const full = path.join(current, entry.name);
                if (entry.isDirectory()) next(full); else results.push(full);
            }
            if (current === dir) resolve(results);
        })(dir);
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

function watchFolder(root) {
    const db = openDb();
    const watcher = chokidar.watch(root, { ignoreInitial: false, awaitWriteFinish: true });
    watcher.on('add', async (filePath) => {
        if (!AUDIO_EXTS.has(path.extname(filePath).toLowerCase())) return;
        try { await upsertTrack(db, filePath); console.log('Added', filePath); } catch (e) { console.error('Add error', filePath, e); }
    });
    watcher.on('unlink', async (filePath) => {
        if (!AUDIO_EXTS.has(path.extname(filePath).toLowerCase())) return;
        try { await dbRun(db, 'DELETE FROM tracks WHERE id = ?', [generateId(filePath)]); await dbRun(db, 'DELETE FROM tracks_fts WHERE track_id = ?', [generateId(filePath)]); console.log('Removed', filePath); } catch (e) { console.error('Remove error', filePath, e); }
    });
    process.on('SIGINT', () => { watcher.close(); db.close(); process.exit(0); });
}

module.exports = { importFolder, watchFolder, upsertTrack };


