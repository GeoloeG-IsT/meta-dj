/* eslint-disable no-console */
const { openDb, dbAll } = require('./db');

async function searchTracks(query) {
    const q = String(query || '').trim();
    const db = openDb();
    let rows;
    if (q === '' || q === '*') {
        rows = await dbAll(db, `SELECT id, title, file_path FROM tracks ORDER BY title LIMIT 50`, []);
    } else {
        rows = await dbAll(db, `SELECT t.id, t.title, t.file_path
                            FROM tracks_fts f
                            JOIN tracks t ON t.id = f.track_id
                            WHERE tracks_fts MATCH ?
                            ORDER BY t.title LIMIT 50`, [q]);
    }
    db.close();
    return rows;
}

module.exports = { searchTracks };


