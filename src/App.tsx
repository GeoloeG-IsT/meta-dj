import { ImportControl } from './modules/library/components/ImportControl';
import { useDatabaseInitialization } from './shared/hooks/useDatabaseInitialization';

export function App() {
  const { isReady, error } = useDatabaseInitialization();

  if (error) {
    return <div className="text-red-500 p-4">Database Error: {error.message}</div>;
  }

  return (
    <div className="h-screen w-screen bg-gray-900 text-white flex flex-col p-4">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Meta-DJ Library</h1>
        <div className="flex items-center gap-4">
          {!isReady && <span className="text-yellow-500 text-sm animate-pulse">Initializing DB...</span>}
          <ImportControl />
        </div>
      </header>
      <main className="flex-1 overflow-auto bg-gray-800 rounded-lg p-4">
        <p className="text-gray-400">Library Empty</p>
      </main>
    </div>
  );
}

export default App;
