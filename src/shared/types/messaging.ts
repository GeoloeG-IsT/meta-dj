export const EventType = {
  PING: 'PING',
  PONG: 'PONG',
  ERROR: 'ERROR',
  LOG: 'LOG',
  
  // Database Events
  DB_INIT: 'DB_INIT',
  DB_READY: 'DB_READY',
  DB_PING: 'DB_PING',
  DB_QUERY_REQUEST: 'DB_QUERY_REQUEST',
  DB_QUERY_RESPONSE: 'DB_QUERY_RESPONSE',
  DB_EXEC_SCRIPT: 'DB_EXEC_SCRIPT',
  DB_SMARTLIST_UPDATE: 'DB_SMARTLIST_UPDATE',
  DB_ERROR: 'DB_ERROR',

  // Connection Events
  CONNECT_DB: 'CONNECT_DB',
  CONNECT_KERNEL: 'CONNECT_KERNEL',
  
  // Audio Events
  AUDIO_LOAD_REQUEST: 'AUDIO_LOAD_REQUEST',
  AUDIO_LOAD_RESPONSE: 'AUDIO_LOAD_RESPONSE',
  AUDIO_ANALYZE_WAVEFORM: 'AUDIO_ANALYZE_WAVEFORM',
  AUDIO_WAVEFORM_READY: 'AUDIO_WAVEFORM_READY',
  AUDIO_WAVEFORM_PROGRESS: 'AUDIO_WAVEFORM_PROGRESS',

  // Track Analysis Events (BPM/Key/Beatgrid)
  // NOTE (2026-01-16): These event types are defined for future worker-based
  // analysis. Currently analysis runs on main thread (see track-analyzer.ts).
  // TODO: Use these when moving analysis to dedicated AnalysisWorker.
  TRACK_ANALYSIS_REQUEST: 'TRACK_ANALYSIS_REQUEST',
  TRACK_ANALYSIS_PROGRESS: 'TRACK_ANALYSIS_PROGRESS',
  TRACK_ANALYSIS_COMPLETE: 'TRACK_ANALYSIS_COMPLETE',
  TRACK_ANALYSIS_ERROR: 'TRACK_ANALYSIS_ERROR',
  
  // Hardware Events
  HARDWARE_EVENT: 'HARDWARE_EVENT',

  // Stem Separation Events
  STEMS_ANALYZE_REQUEST: 'STEMS_ANALYZE_REQUEST',
  STEMS_ANALYZE_PROGRESS: 'STEMS_ANALYZE_PROGRESS',
  STEMS_ANALYZE_COMPLETE: 'STEMS_ANALYZE_COMPLETE',
  STEMS_ANALYZE_ERROR: 'STEMS_ANALYZE_ERROR',
  STEMS_ANALYZE_CANCEL: 'STEMS_ANALYZE_CANCEL',
  STEMS_MODEL_LOADING: 'STEMS_MODEL_LOADING',
  STEMS_MODEL_READY: 'STEMS_MODEL_READY',
} as const;

export type EventType = typeof EventType[keyof typeof EventType];

export interface WorkerMessage<T = unknown> {
  id: string;      // UUID (v4)
  type: EventType; // e.g., 'PING'
  payload: T;      // Data
  timestamp: number;
}

export interface PingPayload {
  message: string;
}

export interface PongPayload {
  message: string;
  workerStartTime: number;
}
