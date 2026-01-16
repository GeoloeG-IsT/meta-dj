import React, { useState } from 'react';
import { Modal } from './BaseModal';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  isDanger?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', isDanger 
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-xs text-[#4DFA90]/60 uppercase tracking-wider mb-8 leading-relaxed">
        {message}
      </p>
      <div className="flex justify-end gap-4">
        <button
          onClick={onClose}
          className="px-4 py-2 text-[10px] uppercase font-bold tracking-widest text-[#4DFA90]/40 hover:text-[#4DFA90] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className={`px-6 py-2 text-[10px] uppercase font-bold tracking-widest rounded-sm border transition-all
            ${isDanger 
              ? 'bg-red-500/20 border-red-500/50 text-red-500 hover:bg-red-500/30' 
              : 'bg-[#4DFA90]/20 border-[#4DFA90]/50 text-[#4DFA90] hover:bg-[#4DFA90]/30'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
}

export const PromptModal: React.FC<PromptModalProps> = ({ 
  isOpen, onClose, onSubmit, title, placeholder, defaultValue = '', confirmLabel = 'Apply' 
}) => {
  const [value, setValue] = useState(defaultValue);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => { if(e.key === 'Enter') { onSubmit(value); onClose(); } }}
        className="w-full bg-black border border-[#4DFA90]/20 p-3 text-sm text-[#4DFA90] focus:border-[#4DFA90] focus:outline-none mb-8 font-mono"
      />
      <div className="flex justify-end gap-4">
        <button
          onClick={onClose}
          className="px-4 py-2 text-[10px] uppercase font-bold tracking-widest text-[#4DFA90]/40 hover:text-[#4DFA90] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => { onSubmit(value); onClose(); }}
          className="px-6 py-2 text-[10px] uppercase font-bold tracking-widest rounded-sm bg-[#4DFA90]/20 border border-[#4DFA90]/50 text-[#4DFA90] hover:bg-[#4DFA90]/30 transition-all"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};
