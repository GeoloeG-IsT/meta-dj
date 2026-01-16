import { useEffect, useState } from 'react';
import { kernel } from './shared/kernel/kernel-manager';
import { EventType } from './shared/types/messaging';
import { LibraryView } from './modules/library/LibraryView';
import { ModalProvider } from './shared/components/modals/ModalProvider';
import { ToastContainer } from './shared/components/Toast';
import { DeckUI } from './modules/audio';

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
    <div className="min-h-screen bg-[#000000] text-[#4DFA90] font-sans p-8 flex flex-col gap-8">
      <ModalProvider />
      <ToastContainer />

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
        <div className="lg:col-span-8 flex flex-col gap-8 min-h-0">
          <LibraryView />
        </div>

        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Deck A */}
          <DeckUI deckId="A" />

          {/* System Status (collapsed) */}
          <details className="bg-[#121212] border border-[#4DFA90]/30 rounded-sm">
            <summary className="px-4 py-2 cursor-pointer text-sm font-mono uppercase text-[#4DFA90]/60 hover:text-[#4DFA90]">
              System Status
              <span className="ml-2">
                <span className={`inline-block w-2 h-2 rounded-full ${status === 'connected' ? 'bg-[#4DFA90]' : 'bg-red-500'}`} />
                <span className={`inline-block w-2 h-2 rounded-full ml-1 ${dbStatus === 'ready' ? 'bg-[#4DFA90]' : dbStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`} />
              </span>
            </summary>
            <div className="px-4 pb-4 space-y-2 text-xs font-mono">
              <div className="text-[#4DFA90]/80">{heartbeat || 'Connecting...'}</div>
              <div className="text-[#4DFA90]/80">{dbInfo || 'Initializing...'}</div>
            </div>
          </details>

          {/* Worker Logs (collapsed) */}
          <details className="bg-[#121212] border border-[#4DFA90]/30 rounded-sm flex-1 min-h-0">
            <summary className="px-4 py-2 cursor-pointer text-sm font-mono uppercase text-[#4DFA90]/60 hover:text-[#4DFA90]">
              Worker Logs ({logs.length})
            </summary>
            <div className="px-4 pb-4">
              <div className="bg-[#000000] p-2 border border-[#4DFA90]/10 rounded-sm font-mono text-xs max-h-[200px] overflow-y-auto flex flex-col gap-1">
                {logs.slice(-20).map((log, i) => (
                  <div key={i} className="opacity-80 border-l-2 border-[#4DFA90]/40 pl-2 truncate">
                    {log}
                  </div>
                ))}
                {logs.length === 0 && <span className="opacity-30 italic">No logs yet...</span>}
              </div>
            </div>
          </details>
        </div>
      </main>

      <footer className="mt-auto text-[10px] opacity-40 uppercase tracking-[0.2em]">        Split-Brain Actor Model | React 19 | Vite | SQLite WASM | OPFS
      </footer>
    </div>
  );
}

export default App;
