import React from 'react';
import { useModalStore } from './modal.store';
import { ConfirmModal, PromptModal } from './StandardModals';

export const ModalProvider: React.FC = () => {
  const { type, isOpen, config, hideModal } = useModalStore();

  if (!isOpen) return null;

  if (type === 'confirm') {
    const confirmConfig = config as { onConfirm?: () => void; title: string; message?: string; confirmLabel?: string; isDanger?: boolean };
    return (
      <ConfirmModal
        isOpen={isOpen}
        onClose={hideModal}
        onConfirm={() => confirmConfig.onConfirm?.()}
        title={confirmConfig.title}
        message={confirmConfig.message || ''}
        confirmLabel={confirmConfig.confirmLabel}
        isDanger={confirmConfig.isDanger}
      />
    );
  }

  if (type === 'prompt') {
    const promptConfig = config as { onConfirm?: (value: string) => void; title: string; placeholder?: string; defaultValue?: string; confirmLabel?: string };
    return (
      <PromptModal
        isOpen={isOpen}
        onClose={hideModal}
        onSubmit={(val) => promptConfig.onConfirm?.(val)}
        title={promptConfig.title}
        placeholder={promptConfig.placeholder}
        defaultValue={promptConfig.defaultValue}
        confirmLabel={promptConfig.confirmLabel}
      />
    );
  }

  return null;
};
