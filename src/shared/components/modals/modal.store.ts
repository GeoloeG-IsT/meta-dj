import { create } from 'zustand';

type ModalType = 'confirm' | 'prompt' | null;

interface ModalState {
  type: ModalType;
  isOpen: boolean;
  config: {
    title: string;
    message?: string;
    placeholder?: string;
    defaultValue?: string;
    confirmLabel?: string;
    isDanger?: boolean;
    onConfirm?: (value: any) => void;
  };
  
  // API
  showConfirm: (config: Omit<ModalState['config'], 'onConfirm'> & { onConfirm: () => void }) => void;
  showPrompt: (config: Omit<ModalState['config'], 'onConfirm'> & { onConfirm: (val: string) => void }) => void;
  hideModal: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  type: null,
  isOpen: false,
  config: { title: '' },

  showConfirm: (config) => set({ 
    type: 'confirm', 
    isOpen: true, 
    config: { ...config } as any
  }),

  showPrompt: (config) => set({ 
    type: 'prompt', 
    isOpen: true, 
    config: { ...config } as any
  }),

  hideModal: () => set({ isOpen: false, type: null })
}));
