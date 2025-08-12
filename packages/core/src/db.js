/* eslint-disable no-console */
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = process.env.DJ_DB_PATH || path.resolve(process.cwd(), 'meta_dj.local.sqlite');

function openDb() {
    const db = new sqlite3.Database(DB_PATH);
    db.serialize(() => db.run('PRAGMA foreign_keys = ON;'));
    return db;
}

function dbRun(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

function dbGet(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
}

function dbAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
    });
}

function generateId(input) {
    return crypto.createHash('sha1').update(String(input)).digest('hex');
}

module.exports = { openDb, dbRun, dbGet, dbAll, generateId, DB_PATH };


