import type { WorkerMessage, WorkerResponse } from '../types';

export class MessageBus {
    private worker: Worker;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private pendingRequests: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>;

    constructor(worker: Worker) {
        this.worker = worker;
        this.pendingRequests = new Map();
        this.worker.onmessage = this.handleMessage.bind(this);
    }

    public async send<TResponse = unknown, TPayload = unknown>(type: string, payload: TPayload): Promise<TResponse> {
        const id = crypto.randomUUID();
        const timestamp = Date.now();
        const message: WorkerMessage<TPayload> = { id, type, payload, timestamp };

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            this.worker.postMessage(message);
        });
    }

    private handleMessage(event: MessageEvent<WorkerResponse>) {
        const { id, success, payload, error } = event.data;

        if (this.pendingRequests.has(id)) {
            const { resolve, reject } = this.pendingRequests.get(id)!;
            if (success) {
                resolve(payload);
            } else {
                reject(new Error(error || 'Unknown Worker Error'));
            }
            this.pendingRequests.delete(id);
        }
    }
}

// Singleton instance
let dbMessageBus: MessageBus | null = null;

export const getDbMessageBus = () => {
    if (!dbMessageBus) {
        const worker = new Worker(new URL('../../modules/database/worker/db.worker.ts', import.meta.url), {
            type: 'module',
        });
        dbMessageBus = new MessageBus(worker);
    }
    return dbMessageBus;
};

// React Hook
import { useMemo } from 'react';

export const useDbWorker = () => {
    const bus = useMemo(() => getDbMessageBus(), []);
    return {
        sendMessage: bus.send.bind(bus),
    };
};
