import React, { useState } from 'react';
import { useLibraryStore } from '../store/library.store';
import { type PlaylistNode } from '../hooks/usePlaylists';
import { useDroppable } from '@dnd-kit/core';

interface PlaylistItemProps {
  node: PlaylistNode;
  depth?: number;
}

export const PlaylistItem: React.FC<PlaylistItemProps> = ({ node, depth = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { selectedPlaylistId, setSelectedPlaylist, deletePlaylist } = useLibraryStore();
  
  const { isOver, setNodeRef } = useDroppable({
    id: `playlist-${node.id}`,
    data: { playlistId: node.id, isFolder: node.isFolder }
  });

  const isSelected = selectedPlaylistId === node.id;

  return (
    <div className="flex flex-col select-none">
      <div
        ref={setNodeRef}
        onClick={() => setSelectedPlaylist(node.id)}
        className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors border-l-2
          ${isSelected ? 'bg-[#0055FF]/20 border-[#0055FF] text-white' : 'bg-transparent border-transparent text-[#4DFA90]/60 hover:bg-[#4DFA90]/5'}
          ${isOver ? 'bg-[#4DFA90]/20' : ''}
        `}
        style={{ paddingLeft: `${(depth + 1) * 12}px` }}
      >
        {node.isFolder ? (
          <button 
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className="w-4 h-4 flex items-center justify-center text-[8px] opacity-40 hover:opacity-100"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="w-4" />
        )}
        
        <span className="text-[10px] font-bold uppercase tracking-widest truncate flex-1">
          {node.isFolder ? '📁' : '📑'} {node.title}
        </span>

        {isSelected && (
            <button 
                onClick={(e) => { e.stopPropagation(); if(confirm('Delete?')) deletePlaylist(node.id); }}
                className="opacity-0 group-hover:opacity-100 text-[8px] text-red-500 hover:text-red-400 p-1"
            >
                ✕
            </button>
        )}
      </div>

      {node.isFolder && isExpanded && node.children.length > 0 && (
        <div className="flex flex-col">
          {node.children.map((child) => (
            <PlaylistItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};
