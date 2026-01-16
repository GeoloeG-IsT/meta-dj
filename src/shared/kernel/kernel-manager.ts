import { EventType } from '../types/messaging';
import type { WorkerMessage } from '../types/messaging';

type MessageHandler = (message: WorkerMessage) => void;

// Pending request callbacks
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

class KernelManager {
  private worker: SharedWorker | null = null;
  private dbWorker: Worker | null = null; // Main thread spawns DB worker
  private pendingRequests = new Map<string, PendingRequest>();
  private handlers = new Set<MessageHandler>();

  constructor() {
    this.init();
  }

  private init() {
    try {
      console.log('[Kernel Manager] Initializing SharedWorker...');
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

      // Initialize DB Worker from Main Thread (Workaround for nested worker limits)
      this.initDbWorker();

    } catch (error) {
      console.error('[Kernel Manager] Initialization Failed:', error);
    }
  }

  private initDbWorker() {
    try {
      console.log('[Kernel Manager] Spawning Database Worker (Main Thread)...');
      this.dbWorker = new Worker(
        new URL('../../modules/database/worker/database.worker.ts', import.meta.url),
        { type: 'module', name: 'meta-dj-database' }
      );
      
      // Create channel to link Kernel and DB
      const channel = new MessageChannel();
      
      // Send port1 to Kernel
      this.worker!.port.postMessage({
        id: crypto.randomUUID(),
        type: 'CONNECT_DB',
        payload: null,
        timestamp: Date.now()
      }, [channel.port1]);

      // Send port2 to DB Worker
      this.dbWorker.postMessage({
        id: crypto.randomUUID(),
        type: 'CONNECT_KERNEL',
        payload: null,
        timestamp: Date.now()
      }, [channel.port2]);

      console.log('[Kernel Manager] Linked Kernel and Database Workers via MessageChannel');

    } catch (e) {
      console.error('[Kernel Manager] Failed to spawn DB Worker:', e);
    }
  }

  private handleMessage(message: WorkerMessage) {
    const { id, type, payload } = message;

    // Check for pending request resolution
    if (this.pendingRequests.has(id)) {
      const { resolve, reject } = this.pendingRequests.get(id)!;
      this.pendingRequests.delete(id);

      if (type === EventType.ERROR || type === EventType.DB_ERROR) {
        reject(new Error(payload));
      } else {
        resolve(payload);
      }
    }

    // Notify global handlers
    this.handlers.forEach(handler => handler(message));
  }

  public waitFor<T = unknown>(type: EventType): Promise<T> {
    return new Promise((resolve) => {
      const unsubscribe = this.addHandler((msg) => {
        if (msg.type === type) {
          unsubscribe();
          resolve(msg.payload as T);
        }
      });
    });
  }

  public send<T = unknown, R = unknown>(type: EventType, payload: T): Promise<R> {
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
      }, 10000);
    });
  }

  public addHandler(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}

export const kernel = new KernelManager();
