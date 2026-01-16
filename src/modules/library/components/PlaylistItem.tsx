import React, { useState } from 'react';
import { useLibraryStore } from '../store/library.store';
import { type PlaylistNode } from '../hooks/usePlaylists';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { ContextMenu } from './ContextMenu';

interface PlaylistItemProps {
  node: PlaylistNode;
  depth?: number;
}

export const PlaylistItem: React.FC<PlaylistItemProps> = ({ node, depth = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const { selectedPlaylistId, setSelectedPlaylist, deletePlaylist, createPlaylist, renamePlaylist } = useLibraryStore();
  
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `playlist-${node.id}`,
    data: { playlistId: node.id, isFolder: node.isFolder }
  });

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: `move-playlist-${node.id}`,
    data: { type: 'playlist', playlistId: node.id }
  });

  const isSelected = selectedPlaylistId === node.id;

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  const menuOptions = [
    { 
        label: 'Sub-Crate', 
        icon: '📁', 
        onClick: async () => {
            const name = prompt('New Crate Name:');
            if (name) {
                try {
                    await createPlaylist(name, node.id, true);
                } catch (e: any) {
                    if (e.code === 409) alert(e.message);
                    else console.error(e);
                }
            }
        }
    },
    { 
        label: 'Sub-Playlist', 
        icon: '📑', 
        onClick: async () => {
            const name = prompt('New Playlist Name:');
            if (name) {
                try {
                    await createPlaylist(name, node.id, false);
                } catch (e: any) {
                    if (e.code === 409) alert(e.message);
                    else console.error(e);
                }
            }
        }
    },
    { 
        label: 'Rename', 
        icon: '✏️', 
        onClick: () => {
            const name = prompt('Rename to:', node.title);
            if (name) renamePlaylist(node.id, name);
        }
    },
    { 
        label: 'Delete', 
        icon: '✕', 
        danger: true,
        onClick: () => {
            if (confirm(`Delete ${node.title}?`)) deletePlaylist(node.id);
        }
    },
  ];

  const filteredOptions = node.isFolder 
    ? menuOptions 
    : menuOptions.filter(opt => opt.label !== 'Sub-Crate' && opt.label !== 'Sub-Playlist');

  return (
    <div className="flex flex-col select-none">
      <div
        ref={(node) => { setDropRef(node); setDragRef(node); }}
        {...listeners}
        {...attributes}
        onClick={() => setSelectedPlaylist(node.id)}
        onContextMenu={handleContextMenu}
        className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors border-l-2 group
          ${isSelected ? 'bg-[#4DFA90]/10 border-[#4DFA90] text-white' : 'bg-transparent border-transparent text-[#4DFA90]/60 hover:bg-[#4DFA90]/5'}
          ${isOver ? 'bg-[#0055FF]/30' : ''}
          ${isDragging ? 'opacity-20' : ''}
        `}
        style={{ ...style, paddingLeft: `${(depth + 1) * 12}px` }}
      >
        {node.isFolder ? (
          <button 
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className="w-4 h-4 flex items-center justify-center text-[8px] opacity-40 hover:opacity-100"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="w-4" />
        )}
        
        <span className="text-[10px] font-bold uppercase tracking-widest truncate flex-1 pointer-events-none">
          {node.isFolder ? '📁' : '📑'} {node.title}
        </span>
      </div>

      {menuPos && (
        <ContextMenu 
            x={menuPos.x} 
            y={menuPos.y} 
            onClose={() => setMenuPos(null)} 
            options={filteredOptions} 
        />
      )}

      {isExpanded && node.children.length > 0 && (
        <div className="flex flex-col">
          {node.children.map((child) => (
            <PlaylistItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};
