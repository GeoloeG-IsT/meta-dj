import React, { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  options: {
    label: string;
    icon: string;
    onClick: () => void;
    danger?: boolean;
  }[];
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, options }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 160);
  const adjustedY = Math.min(y, window.innerHeight - 200);

  return (
    <div
      ref={menuRef}
      className="fixed z-[1000] w-40 bg-[#121212] border border-[#4DFA90]/30 shadow-[0_10px_25px_rgba(0,0,0,0.5)] rounded-sm overflow-hidden py-1"
      style={{ top: adjustedY, left: adjustedX }}
    >
      {options.map((opt, i) => (
        <button
          key={i}
          onClick={(e) => {
            e.stopPropagation();
            opt.onClick();
            onClose();
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 text-[10px] uppercase font-bold tracking-widest transition-colors text-left
            ${opt.danger 
              ? 'text-red-500 hover:bg-red-500/10' 
              : 'text-[#4DFA90]/80 hover:bg-[#4DFA90]/10 hover:text-[#4DFA90]'}
          `}
        >
          <span className="text-xs">{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
};
