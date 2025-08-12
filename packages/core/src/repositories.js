/* eslint-disable no-console */
const { dbRun, dbGet, generateId } = require('./db');

async function ensureArtist(db, name) {
    if (!name) return null;
    const id = generateId(`artist:${name.toLowerCase().trim()}`);
    await dbRun(db, `INSERT OR IGNORE INTO artists (id, name) VALUES (?, ?)`, [id, name]);
    return id;
}

async function ensureAlbum(db, name, year) {
    if (!name) return null;
    const id = generateId(`album:${name.toLowerCase().trim()}`);
    const existing = await dbGet(db, `SELECT id FROM albums WHERE id = ?`, [id]);
    if (!existing) {
        await dbRun(db, `INSERT INTO albums (id, name, year) VALUES (?, ?, ?)`, [id, name, year || null]);
    } else if (year != null) {
        await dbRun(db, `UPDATE albums SET year = COALESCE(year, ?) WHERE id = ?`, [year, id]);
    }
    return id;
}

module.exports = { ensureArtist, ensureAlbum };


