import { useEffect, useState } from 'react';
import { kernel } from './shared/kernel/kernel-manager';
import { EventType } from './shared/types/messaging';
import { LibraryView } from './modules/library/LibraryView';
import { ModalProvider } from './shared/components/modals/ModalProvider';
import { ToastContainer } from './shared/components/Toast';

function App() {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [dbStatus, setDbStatus] = useState<'initializing' | 'ready' | 'error'>('initializing');
  const [heartbeat, setHeartbeat] = useState<string | null>(null);
  const [dbInfo, setDbInfo] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = kernel.addHandler((msg) => {
      // Log everything for debug
      if (msg.type !== EventType.PONG && msg.type !== EventType.DB_QUERY_RESPONSE) {
        setLogs(prev => [...prev, `[Worker Event] ${msg.type}: ${JSON.stringify(msg.payload || '')}`]);
      }

      if (msg.type === EventType.LOG) {
        // already handled above
        setStatus('connected');
      }
      if (msg.type === EventType.DB_READY) {
        // already handled above
      }
    });

    const init = async () => {
      // 1. Heartbeat test
      try {
        const response = await kernel.send(EventType.PING, { message: 'Hello from UI' });
        setHeartbeat(`Heartbeat Success: ${response.message} (Worker started at ${new Date(response.workerStartTime).toLocaleTimeString()})`);
      } catch (error) {
        console.error('Heartbeat Failed:', error);
        setHeartbeat('Heartbeat Failed');
        setStatus('error');
      }

      // 2. Database Initialization
      try {
        setLogs(prev => [...prev, '[UI] Waiting for Database Worker...']);
        await kernel.waitFor(EventType.DB_READY);

        // Removed: Schema injection (now handled internally by worker)

        setLogs(prev => [...prev, '[UI] Performing DB Health Check...']);
        const versionResult = await kernel.send(EventType.DB_QUERY_REQUEST, {
          sql: 'SELECT sqlite_version() as version',
          method: 'get',
          targetDb: 'm'
        });

        setDbInfo(`SQLite Version: ${versionResult.version}`);
        setDbStatus('ready');
        setLogs(prev => [...prev, '[UI] Database Health Check PASSED']);
      } catch (error: any) {
        console.error('Database Init Failed:', error);
        setDbStatus('error');
        setLogs(prev => [...prev, `[UI] DB ERROR: ${error.message}`]);
      }
    };

    init();

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#000000] text-[#4DFA90] font-sans p-8 flex flex-col">
      <ModalProvider />
      <ToastContainer />

      <main className="flex-1 min-h-0">
        <LibraryView />
      </main>

      <footer className="mt-auto text-[10px] opacity-40 uppercase tracking-[0.2em]">        Split-Brain Actor Model | React 19 | Vite | SQLite WASM | OPFS
      </footer>
    </div>
  );
}

export default App;
