import { useEffect, useState } from 'react';
import { kernel } from './shared/kernel/kernel-manager';
import { EventType } from './shared/types/messaging';
import { LibraryView } from './modules/library/LibraryView';

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
      <header className="border-b border-[#4DFA90]/20 pb-4">
        <h1 className="text-4xl font-bold tracking-tighter uppercase">Meta-DJ Kernel</h1>
        <p className="text-[#4DFA90]/60 text-sm">Split-Brain Architecture Foundation</p>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
        <div className="lg:col-span-8 flex flex-col gap-8 min-h-0">
          <LibraryView />
        </div>

        <div className="lg:col-span-4 flex flex-col gap-8">
          <section className="bg-[#121212] border border-[#4DFA90]/30 p-6 rounded-sm shadow-[0_0_15px_rgba(77,250,144,0.1)]">
            <h2 className="text-xl font-bold mb-4 uppercase tracking-widest">System Status</h2>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-3 h-3 rounded-full ${status === 'connected' ? 'bg-[#4DFA90] animate-pulse' : 'bg-red-500'}`} />
                <span className="uppercase text-sm font-mono">Kernel: {status}</span>
              </div>
              <div className="bg-[#000000] p-4 border border-[#4DFA90]/10 rounded-sm font-mono text-sm min-h-[60px]">
                {heartbeat || 'Performing heartbeat...'}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-3 h-3 rounded-full ${dbStatus === 'ready' ? 'bg-[#4DFA90] animate-pulse' : dbStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                <span className="uppercase text-sm font-mono">Database: {dbStatus}</span>
              </div>
              <div className="bg-[#000000] p-4 border border-[#4DFA90]/10 rounded-sm font-mono text-sm min-h-[60px]">
                {dbInfo || 'Initializing OPFS Database...'}
              </div>
            </div>
                      </div>
                    </section>
          
                    <section className="bg-[#121212] border border-[#4DFA90]/30 p-6 rounded-sm flex-1 min-h-0">
                      <h2 className="text-xl font-bold mb-4 uppercase tracking-widest">Worker Logs</h2>
                      <div className="bg-[#000000] p-4 border border-[#4DFA90]/10 rounded-sm font-mono text-xs h-[300px] overflow-y-auto flex flex-col gap-1">
                        {logs.map((log, i) => (
                          <div key={i} className="opacity-80 border-l-2 border-[#4DFA90]/40 pl-2">
                            {log}
                          </div>
                        ))}
                        {logs.length === 0 && <span className="opacity-30 italic">No logs yet...</span>}
                      </div>
                    </section>
                  </div>
                </main>
          
                <footer className="mt-auto text-[10px] opacity-40 uppercase tracking-[0.2em]">        Split-Brain Actor Model | React 19 | Vite | SQLite WASM | OPFS
      </footer>
    </div>
  );
}

export default App;
