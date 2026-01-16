import { create } from 'zustand';

type ModalType = 'confirm' | 'prompt' | null;

interface ModalConfig {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  isDanger?: boolean;
  onConfirm?: ((value: void) => void) | ((value: string) => void);
}

interface ModalState {
  type: ModalType;
  isOpen: boolean;
  config: ModalConfig;

  // API
  showConfirm: (config: Omit<ModalConfig, 'onConfirm'> & { onConfirm: () => void }) => void;
  showPrompt: (config: Omit<ModalConfig, 'onConfirm'> & { onConfirm: (val: string) => void }) => void;
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
