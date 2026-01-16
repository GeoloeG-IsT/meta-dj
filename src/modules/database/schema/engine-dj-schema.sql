-- Engine DJ Compatible Schema (Simplified for meta-dj)
-- Based on libdjinterop and m.db/p.db structures

-- Track Table: Core metadata
CREATE TABLE IF NOT EXISTS Track (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    album TEXT,
    artist TEXT,
    bitrate INTEGER,
    bpm INTEGER,
    comment TEXT,
    composer TEXT,
    dateAdded INTEGER,
    dateCreated INTEGER,
    duration INTEGER,
    filename TEXT,
    fileSize INTEGER,
    fileType TEXT,
    genre TEXT,
    isAnalyzed BOOLEAN DEFAULT 0,
    isMetadataImported BOOLEAN DEFAULT 0,
    key TEXT,
    label TEXT,
    lastPlayed INTEGER,
    length INTEGER,
    path TEXT UNIQUE,
    rating INTEGER,
    remixer TEXT,
    title TEXT,
    year INTEGER
);

-- Playlist Table: Hierarchical folder/playlist structure
CREATE TABLE IF NOT EXISTS Playlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parentListId INTEGER DEFAULT 0,
    title TEXT,
    isFolder BOOLEAN DEFAULT 0,
    isSmartList BOOLEAN DEFAULT 0,
    FOREIGN KEY(parentListId) REFERENCES Playlist(id)
);

-- SmartListRule Table: Rules for dynamic playlists
CREATE TABLE IF NOT EXISTS SmartListRule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlistId INTEGER,
    field TEXT, -- e.g., 'bpm', 'genre', 'key', 'rating'
    operator TEXT, -- e.g., '=', '>', '<', 'CONTAINS'
    value TEXT,
    logic TEXT DEFAULT 'AND', -- 'AND' or 'OR'
    FOREIGN KEY(playlistId) REFERENCES Playlist(id)
);

-- PlaylistEntity Table: Linked list for track ordering in playlists
CREATE TABLE IF NOT EXISTS PlaylistEntity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listId INTEGER,
    trackId INTEGER,
    nextEntityId INTEGER DEFAULT 0,
    membershipData BLOB,
    FOREIGN KEY(listId) REFERENCES Playlist(id),
    FOREIGN KEY(trackId) REFERENCES Track(id)
);

-- PerformanceData Table: Cues, Loops, and Beatgrid (often in p.db)
-- In meta-dj, we might combine or keep separate.
-- For now, we'll implement the m.db structure and placeholders for performance data.
CREATE TABLE IF NOT EXISTS PerformanceData (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trackId INTEGER,
    type INTEGER, -- 1: HotCue, 2: Loop, 3: Beatgrid, 4: Waveform
    position INTEGER,
    endPosition INTEGER,
    color INTEGER,
    name TEXT,
    data BLOB,
    FOREIGN KEY(trackId) REFERENCES Track(id)
);

-- WaveformData Table: Pre-computed 3-band FFT waveform data for visualization
-- Stored separately for efficient retrieval during deck loading
CREATE TABLE IF NOT EXISTS WaveformData (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trackId INTEGER UNIQUE,
    waveform_data BLOB,       -- Serialized WaveformData (3-band peaks)
    sample_rate INTEGER,      -- Original audio sample rate
    duration REAL,            -- Track duration in seconds
    points_per_second REAL,   -- Resolution of the waveform data
    created_at INTEGER,       -- Timestamp of analysis
    FOREIGN KEY(trackId) REFERENCES Track(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_track_path ON Track(path);
CREATE INDEX IF NOT EXISTS idx_playlist_parent ON Playlist(parentListId);
CREATE INDEX IF NOT EXISTS idx_entity_list ON PlaylistEntity(listId);
CREATE INDEX IF NOT EXISTS idx_waveform_track ON WaveformData(trackId);
