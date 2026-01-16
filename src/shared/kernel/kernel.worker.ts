import { EventType } from '../types/messaging';
import type { WorkerMessage } from '../types/messaging';

const workerStartTime = Date.now();
const connections: MessagePort[] = [];

/**
 * SharedWorker context
 */
const ctx: SharedWorkerGlobalScope = self as any;

ctx.onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  connections.push(port);

  port.onmessage = (msgEvent: MessageEvent<WorkerMessage>) => {
    const { id, type, payload } = msgEvent.data;

    console.log(`[Kernel Worker] Received: ${type}`, payload);

    switch (type) {
      case EventType.PING:
        const response: WorkerMessage = {
          id,
          type: EventType.PONG,
          payload: {
            message: 'PONG',
            workerStartTime
          },
          timestamp: Date.now()
        };
        port.postMessage(response);
        break;

      default:
        console.warn(`[Kernel Worker] Unhandled message type: ${type}`);
    }
  };

  port.start();
  
  // Send initial connected message
  const welcome: WorkerMessage = {
    id: crypto.randomUUID(),
    type: EventType.LOG,
    payload: 'Kernel Worker Connected',
    timestamp: Date.now()
  };
  port.postMessage(welcome);
};
