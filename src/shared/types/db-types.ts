export const DbAction = {
    INIT: 'DB_INIT',
    EXEC_SQL: 'EXEC_SQL',
    IMPORT_TRACK: 'IMPORT_TRACK',
    INGEST_TRACK: 'INGEST_TRACK', // Add missing action
} as const;

export type DbActionType = typeof DbAction[keyof typeof DbAction];

export interface Track {
    id: number;
    title: string;
    artist?: string;
    album?: string;
    genre?: string;
    bpm?: number;
    key?: string;
    duration?: number;
    path: string; // UNIQUE NOT NULL
    filename: string; // NOT NULL
    artwork?: string; // Blob URL or path
    rating?: number;
    comment?: string;
    dateAdded?: number;
    analysisData?: Uint8Array | null; // BLOB
}

export interface Playlist {
    id: number;
    title: string;
    parentId?: number;
}

export interface PlaylistEntity {
    id: number;
    playlistId: number;
    trackId: number;
    nextEntityId?: number; // Linked list
    sortOrder: number; // Fallback
}
