import { create } from 'zustand';

type ModalType = 'confirm' | 'prompt' | null;

interface BaseModalConfig {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  isDanger?: boolean;
}

interface ConfirmModalConfig extends BaseModalConfig {
  onConfirm?: () => void;
}

interface PromptModalConfig extends BaseModalConfig {
  onConfirm?: (value: string) => void;
}

type ModalConfig = ConfirmModalConfig | PromptModalConfig;

interface ModalState {
  type: ModalType;
  isOpen: boolean;
  config: ModalConfig;

  // API
  showConfirm: (config: ConfirmModalConfig) => void;
  showPrompt: (config: PromptModalConfig) => void;
  hideModal: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  type: null,
  isOpen: false,
  config: { title: '' },

  showConfirm: (config) => set({
    type: 'confirm',
    isOpen: true,
    config
  }),

  showPrompt: (config) => set({
    type: 'prompt',
    isOpen: true,
    config
  }),

  hideModal: () => set({ isOpen: false, type: null })
}));
