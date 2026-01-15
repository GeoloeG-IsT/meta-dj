import { useEffect, useState } from 'react';
import { dbService } from '../../modules/database/service';

export function useDatabaseInitialization() {
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                await dbService.init();
                setIsReady(true);
            } catch (err) {
                console.error('Database Initialization Failed', err);
                setError(err instanceof Error ? err : new Error(String(err)));
            }
        };

        init();
    }, []);

    return { isReady, error };
}
