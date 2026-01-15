-- Engine DJ Schema Compatibility Layer
-- Based on m.db analysis

CREATE TABLE IF NOT EXISTS Track (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT,
    album TEXT,
    genre TEXT,
    bpm REAL,
    key TEXT,
    duration INTEGER, -- Seconds
    path TEXT UNIQUE NOT NULL,
    filename TEXT NOT NULL,
    artwork TEXT,
    rating INTEGER DEFAULT 0,
    comment TEXT,
    dateAdded INTEGER,
    analysisData BLOB -- JSON or binary blob for stems/grid
);

CREATE TABLE IF NOT EXISTS Playlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    parentId INTEGER -- Adjacency list for folder structure
);

CREATE TABLE IF NOT EXISTS PlaylistEntity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlistId INTEGER NOT NULL,
    trackId INTEGER NOT NULL,
    nextEntityId INTEGER, -- Linked List Pointer
    sortOrder INTEGER DEFAULT 0,
    FOREIGN KEY(playlistId) REFERENCES Playlist(id),
    FOREIGN KEY(trackId) REFERENCES Track(id)
);

CREATE INDEX IF NOT EXISTS idx_playlist_parent ON Playlist(parentId);
CREATE INDEX IF NOT EXISTS idx_entity_playlist ON PlaylistEntity(playlistId);
