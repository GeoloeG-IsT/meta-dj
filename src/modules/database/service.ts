import { MessageBus, getDbMessageBus } from '../../shared/kernel/message-bus';
import { DbAction } from '../../shared/types/db-types';

class DatabaseService {
    private static instance: DatabaseService;
    private messageBus: MessageBus;
    private isInitialized = false;

    private constructor() {
        this.messageBus = getDbMessageBus();
    }

    public static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    public async init(): Promise<void> {
        if (this.isInitialized) return;

        console.log('Initializing Database Service...');
        await this.messageBus.send(DbAction.INIT, null);
        this.isInitialized = true;
        console.log('Database Service Initialized');
    }

    public async exec(sql: string, bind?: unknown[]): Promise<unknown[]> {
        return this.messageBus.send(DbAction.EXEC_SQL, { sql, bind });
    }
}

export const dbService = DatabaseService.getInstance();
