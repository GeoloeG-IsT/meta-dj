import React, { useState } from 'react';
import { Folder, FolderOpen, Music, ChevronRight, ChevronDown, Edit2, Trash2 } from 'lucide-react';
import { useLibraryStore } from '../store/library.store';
import { type PlaylistNode } from '../hooks/usePlaylists';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { ContextMenu } from './ContextMenu';
import { useModalStore } from '../../../shared/components/modals/modal.store';
import { CSS } from '@dnd-kit/utilities';

interface PlaylistItemProps {
  node: PlaylistNode;
  depth?: number;
}

export const PlaylistItem: React.FC<PlaylistItemProps> = ({ node, depth = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const { selectedPlaylistId, setSelectedPlaylist, renamePlaylist, deletePlaylist, createPlaylist } = useLibraryStore();
  const { showConfirm, showPrompt } = useModalStore();

  const isSelected = selectedPlaylistId === node.id;

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `playlist-${node.id}`,
    data: { playlistId: node.id, isFolder: node.isFolder }
  });

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: `drag-playlist-${node.id}`,
    data: { type: 'playlist', playlistId: node.id, title: node.title }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const handleAddCrate = () => {
    showPrompt({
        title: 'New Sub-Crate',
        message: 'Enter crate name:',
        onConfirm: (title) => createPlaylist(title, node.id, true)
    });
  };

  const handleAddPlaylist = () => {
    showPrompt({
        title: 'New Sub-Playlist',
        message: 'Enter playlist name:',
        onConfirm: (title) => createPlaylist(title, node.id, false)
    });
  };

  const menuOptions = [
    { 
        label: 'Sub-Crate', 
        icon: <Folder size={14} />, 
        onClick: handleAddCrate
    },
    { 
        label: 'Sub-Playlist', 
        icon: <Music size={14} />, 
        onClick: handleAddPlaylist
    },
    { 
        label: 'Rename', 
        icon: <Edit2 size={14} />, 
        onClick: () => {
            showPrompt({
                title: 'Rename Item',
                message: `Enter new name for "${node.title}":`,
                initialValue: node.title,
                onConfirm: (title) => renamePlaylist(node.id, title)
            });
        }
    },
    { 
        label: 'Delete', 
        icon: <Trash2 size={14} />, 
        danger: true,
        onClick: () => {
            showConfirm({
                title: 'Delete Item',
                message: `Are you sure you want to delete "${node.title}"?`,
                confirmLabel: 'Delete',
                isDanger: true,
                onConfirm: () => deletePlaylist(node.id)
            });
        }
    }
  ];

  const filteredOptions = node.isFolder 
    ? menuOptions 
    : menuOptions.filter(opt => opt.label !== 'Sub-Crate' && opt.label !== 'Sub-Playlist');

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

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
          ${isOver ? 'bg-[#4DFA90]/20' : ''}
          ${isDragging ? 'opacity-20' : ''}
        `}
        style={{ ...style, paddingLeft: `${(depth + 1) * 12}px` }}
      >
        {node.isFolder ? (
          <button 
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className="w-4 h-4 flex items-center justify-center text-[#4DFA90]/40 hover:text-[#4DFA90]"
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        
        <div className="flex items-center gap-2 flex-1 min-w-0">
            {node.isFolder ? (isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />) : <Music size={14} />}
            <span className="text-[10px] font-bold uppercase tracking-widest truncate">
                {node.title}
            </span>
        </div>

        {node.trackCount > 0 && (
            <span className="text-[9px] font-mono bg-[#4DFA90]/10 px-1.5 rounded-full text-[#4DFA90]/60 group-hover:text-[#4DFA90]">
                {node.trackCount}
            </span>
        )}
      </div>

      {menuPos && (
        <ContextMenu 
            x={menuPos.x} 
            y={menuPos.y} 
            onClose={() => setMenuPos(null)} 
            options={filteredOptions as any} 
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