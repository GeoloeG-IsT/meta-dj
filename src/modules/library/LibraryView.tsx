import React from 'react';
import { ImportControl } from './components/ImportControl';
import { TrackList } from './components/TrackList';

export const LibraryView: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 h-full">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-bold uppercase tracking-[0.2em] text-[#4DFA90]">
          Librarian <span className="opacity-40 text-sm font-normal tracking-normal">/ Collection</span>
        </h2>
      </header>

      <main className="flex flex-col gap-6 flex-1 min-h-0">
        <ImportControl />
        
        <section className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest opacity-60">Tracks</span>
          </div>
          <TrackList />
        </section>
      </main>
    </div>
  );
};
