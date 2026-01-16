/// <reference lib="webworker" />

import { EventType } from '../types/messaging';
import type { WorkerMessage } from '../types/messaging';

const workerStartTime = Date.now();
let connections: MessagePort[] = [];

/**
 * SharedWorker context
 */
declare const self: SharedWorkerGlobalScope;
const ctx: SharedWorkerGlobalScope = self;

// Database Port (from MessageChannel)
let dbPort: MessagePort | null = null;

const broadcast = (message: WorkerMessage) => {
  // Filter out closed connections lazily on send
  connections = connections.filter(port => {
    try {
      port.postMessage(message);
      return true;
    } catch (e) {
      // console.warn('[Kernel Worker] Removing stale connection');
      return false;
    }
  });
};

const setupDbPort = (port: MessagePort) => {
  dbPort = port;
  dbPort.start();

  dbPort.onmessage = (event) => {
    const { id, type, payload } = event.data;
    // console.log(`[Kernel Worker] DB Worker Message: ${type}`, payload);
    
    broadcast({
      id: id || crypto.randomUUID(),
      type: type as any,
      payload,
      timestamp: Date.now()
    });
  };
  
  // Trigger DB initialization through the port
  dbPort.postMessage({ type: 'DB_INIT' });
};

ctx.onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  port.start();
  connections.push(port);

  console.log(`[Kernel Worker] New connection established. Total: ${connections.length}`);

  // Send initial connected message
  port.postMessage({
    id: crypto.randomUUID(),
    type: EventType.LOG,
    payload: `Kernel Worker Connected (Ports: ${connections.length}, DB: ${dbPort ? 'Linked' : 'Waiting'})`,
    timestamp: Date.now()
  });

  port.onmessage = (msgEvent: MessageEvent<WorkerMessage>) => {
    const { id, type, payload } = msgEvent.data;
    // console.log(`[Kernel Worker] Received from UI: ${type}`, payload);

    if (type === EventType.CONNECT_DB && msgEvent.ports[0]) {
       console.log('[Kernel Worker] Received DB Port');
       setupDbPort(msgEvent.ports[0]);
       return;
    }

    try {
      switch (type) {
        case EventType.PING:
          port.postMessage({
            id,
            type: EventType.PONG,
            payload: {
              message: 'PONG',
              workerStartTime,
              dbWorkerStatus: dbPort ? 'Linked' : 'Missing'
            },
            timestamp: Date.now()
          });
          break;

        case EventType.DB_QUERY_REQUEST:
        case EventType.DB_EXEC_SCRIPT:
          if (dbPort) {
            dbPort.postMessage({ id, type, payload });
          } else {
            console.error('[Kernel Worker] DB Port missing');
            port.postMessage({
              id,
              type: EventType.ERROR,
              payload: 'Database worker not linked',
              timestamp: Date.now()
            });
          }
          break;

        default:
          console.warn(`[Kernel Worker] Unhandled message type: ${type}`);
      }
    } catch (err: any) {
      console.error(`[Kernel Worker] Error handling message ${type}:`, err);
      port.postMessage({
        id,
        type: EventType.ERROR,
        payload: `Kernel Error: ${err.message}`,
        timestamp: Date.now()
      });
    }
  };
};