import { EventType } from '../types/messaging';
import type { WorkerMessage } from '../types/messaging';

type MessageHandler = (message: WorkerMessage) => void;

class KernelManager {
  private worker: SharedWorker | null = null;
  private pendingRequests = new Map<string, { resolve: Function; reject: Function }>();
  private handlers = new Set<MessageHandler>();

  constructor() {
    this.init();
  }

  private init() {
    try {
      // Vite handles ?worker and ?sharedworker suffixes
      this.worker = new SharedWorker(
        new URL('./kernel.worker.ts', import.meta.url),
        { type: 'module', name: 'meta-dj-kernel' }
      );

      this.worker.port.onmessage = (event: MessageEvent<WorkerMessage>) => {
        this.handleMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('[Kernel Manager] Worker Error:', error);
      };

      this.worker.port.start();
    } catch (error) {
      console.error('[Kernel Manager] Initialization Failed:', error);
    }
  }

  private handleMessage(message: WorkerMessage) {
    const { id, payload } = message;

    // Check for pending request resolution
    if (this.pendingRequests.has(id)) {
      const { resolve } = this.pendingRequests.get(id)!;
      this.pendingRequests.delete(id);
      resolve(payload);
    }

    // Notify global handlers
    this.handlers.forEach(handler => handler(message));
  }

  public send<T = any, R = any>(type: EventType, payload: T): Promise<R> {
    if (!this.worker) return Promise.reject('Worker not initialized');

    const id = crypto.randomUUID();
    const message: WorkerMessage = {
      id,
      type,
      payload,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker!.port.postMessage(message);

      // Timeout safety
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${type} (${id})`));
        }
      }, 5000);
    });
  }

  public addHandler(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}

export const kernel = new KernelManager();
