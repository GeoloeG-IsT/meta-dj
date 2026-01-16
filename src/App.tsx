import { useEffect } from 'react';
import { kernel } from './shared/kernel/kernel-manager';
import { EventType } from './shared/types/messaging';
import { LibraryView } from './modules/library/LibraryView';
import { ModalProvider } from './shared/components/modals/ModalProvider';
import { ToastContainer } from './shared/components/Toast';

function App() {
  useEffect(() => {
    const unsubscribe = kernel.addHandler((msg) => {
      // Log worker events for debugging (except high-frequency messages)
      if (msg.type !== EventType.PONG && msg.type !== EventType.DB_QUERY_RESPONSE) {
        console.debug(`[Worker Event] ${msg.type}:`, msg.payload || '');
      }
    });

    const init = async () => {
      // 1. Heartbeat test
      try {
        console.debug('[UI] Testing kernel heartbeat...');
        const response = await kernel.send<{ message: string }, { message: string; workerStartTime: number }>(EventType.PING, { message: 'Hello from UI' });
        console.debug('[UI] Heartbeat Success:', response.message, `(Worker started at ${new Date(response.workerStartTime).toLocaleTimeString()})`);
      } catch (error) {
        console.error('[UI] Heartbeat Failed:', error);
      }

      // 2. Database Initialization
      try {
        console.debug('[UI] Waiting for Database Worker...');
        await kernel.waitFor(EventType.DB_READY);

        console.debug('[UI] Performing DB Health Check...');
        const versionResult = await kernel.send<unknown, { version: string }>(EventType.DB_QUERY_REQUEST, {
          sql: 'SELECT sqlite_version() as version',
          method: 'get',
          targetDb: 'm'
        });

        console.debug('[UI] Database Health Check PASSED - SQLite Version:', versionResult.version);
      } catch (error) {
        console.error('[UI] Database Init Failed:', error instanceof Error ? error.message : error);
      }
    };

    init();

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="h-screen bg-[#000000] text-[#4DFA90] font-sans p-8 flex flex-col overflow-hidden">
      <ModalProvider />
      <ToastContainer />

      <main className="flex-1 min-h-0 overflow-hidden">
        <LibraryView />
      </main>
    </div>
  );
}

export default App;
