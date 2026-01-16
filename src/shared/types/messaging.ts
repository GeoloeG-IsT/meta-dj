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
  
  // Hardware Events
  HARDWARE_EVENT: 'HARDWARE_EVENT'
} as const;

export type EventType = typeof EventType[keyof typeof EventType];

export interface WorkerMessage<T = any> {
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
