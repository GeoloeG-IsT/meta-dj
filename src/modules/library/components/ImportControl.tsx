import React, { useState } from 'react';
import { ingestService, type IngestProgress } from '../services/ingest-service';

export const ImportControl: React.FC = () => {
  const [isIngesting, setIsIngesting] = useState(false);
  const [progress, setProgress] = useState<IngestProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    try {
      // @ts-ignore - File System Access API
      const dirHandle = await window.showDirectoryPicker();
      
      setIsIngesting(true);
      setError(null);
      
      await ingestService.ingestDirectory(dirHandle, (p) => {
        setProgress(p);
      });

      // Show completion state briefly
      setTimeout(() => {
        setIsIngesting(false);
        setProgress(null);
      }, 1500);

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Import failed:', err);
      // Show more descriptive error
      setError(`Import failed: ${err.message || 'Unknown error'}`);
      setIsIngesting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-[#121212] border border-[#4DFA90]/20 rounded-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-[#4DFA90] font-bold uppercase tracking-wider">Library Ingestion</h3>
        <button
          onClick={handleImport}
          disabled={isIngesting}
          className={`px-4 py-2 rounded-sm font-mono text-sm uppercase transition-all
            ${isIngesting 
              ? 'bg-[#4DFA90]/10 text-[#4DFA90]/40 cursor-not-allowed' 
              : 'bg-[#4DFA90]/20 text-[#4DFA90] hover:bg-[#4DFA90]/30 border border-[#4DFA90]/40'}`}
        >
          {isIngesting ? 'Ingesting...' : 'Import Folder'}
        </button>
      </div>

      {isIngesting && progress && (
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-mono uppercase opacity-70">
            <span className="truncate max-w-[200px]">{progress.currentFile}</span>
            <span>{progress.processed} / {progress.total}</span>
          </div>
          <div className="w-full h-1 bg-[#4DFA90]/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#4DFA90] transition-all duration-300 shadow-[0_0_8px_#4DFA90]"
              style={{ width: `${(progress.processed / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="text-red-500 text-xs font-mono mt-2 border-l-2 border-red-500 pl-2">
          ERROR: {error}
        </div>
      )}

      {!isIngesting && !progress && !error && (
        <p className="text-[10px] opacity-40 uppercase italic">
          Select a local directory to scan for audio tracks.
        </p>
      )}
    </div>
  );
};