export type WorkerMessage<T = unknown> = {
    id: string;
    type: string;
    payload: T;
    timestamp: number;
};

export type WorkerResponse<T = unknown> = {
    id: string; // Correlates to request ID
    success: boolean;
    payload?: T;
    error?: string;
    timestamp: number;
};

export type AppError = {
    code: string;
    message: string;
    details?: unknown;
};
