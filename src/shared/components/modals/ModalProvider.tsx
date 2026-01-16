import React from 'react';
import { useModalStore } from './modal.store';
import { ConfirmModal, PromptModal } from './StandardModals';

export const ModalProvider: React.FC = () => {
  const { type, isOpen, config, hideModal } = useModalStore();

  if (!isOpen) return null;

  if (type === 'confirm') {
    return (
      <ConfirmModal
        isOpen={isOpen}
        onClose={hideModal}
        onConfirm={() => config.onConfirm?.(undefined)}
        title={config.title}
        message={config.message || ''}
        confirmLabel={config.confirmLabel}
        isDanger={config.isDanger}
      />
    );
  }

  if (type === 'prompt') {
    return (
      <PromptModal
        isOpen={isOpen}
        onClose={hideModal}
        onSubmit={(val) => config.onConfirm?.(val)}
        title={config.title}
        placeholder={config.placeholder}
        defaultValue={config.defaultValue}
        confirmLabel={config.confirmLabel}
      />
    );
  }

  return null;
};
