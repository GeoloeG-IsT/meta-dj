/* eslint-disable no-console */
const { openDb, dbAll } = require('./db');

async function searchTracksViaApi(query) {
    const base = process.env.API_BASE || process.env.SYNC_API_BASE || 'http://localhost:8080';
    const url = new URL(base.replace(/\/$/, '') + '/v1/tracks/');
    if (query && query !== '*') url.searchParams.set('q', query);
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const json = await res.json();
    return json.map((r) => ({ id: r.id, title: r.title, file_path: r.file_path }));
}

async function searchTracks(query) {
    const q = String(query || '').trim();
    if (process.env.API_BASE || process.env.SYNC_API_BASE) {
        try { return await searchTracksViaApi(q); } catch { /* fallback */ }
    }
    const db = openDb();
    try {
        if (q === '' || q === '*') {
            return await dbAll(db, `SELECT id, title, file_path FROM tracks ORDER BY title LIMIT 50`, []);
        }
        return await dbAll(db, `SELECT t.id, t.title, t.file_path
                             FROM tracks_fts f
                             JOIN tracks t ON t.id = f.track_id
                             WHERE tracks_fts MATCH ?
                             ORDER BY t.title LIMIT 50`, [q]);
    } finally {
        db.close();
    }
}

module.exports = { searchTracks };


