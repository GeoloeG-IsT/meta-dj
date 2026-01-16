/**
 * Toast Component - Non-blocking notifications
 *
 * Displays toast notifications in the bottom-right corner.
 * Supports success, error, info, and warning variants.
 *
 * Story 2.3: "Slip-Under" Beatgrid Editing
 */

import { useCallback } from 'react';
import { useToastStore, type ToastVariant } from '../store/toast.store';

/** Variant color mapping matching UX spec */
const VARIANT_STYLES: Record<
  ToastVariant,
  { bg: string; border: string; text: string }
> = {
  success: {
    bg: 'rgba(18, 18, 18, 0.95)', // Dark background
    border: '#4DFA90', // Engine Green
    text: '#4DFA90',
  },
  error: {
    bg: 'rgba(18, 18, 18, 0.95)',
    border: '#FF4444', // Error Red
    text: '#FF6666',
  },
  info: {
    bg: 'rgba(18, 18, 18, 0.95)',
    border: '#4DA6FA', // Info Blue
    text: '#4DA6FA',
  },
  warning: {
    bg: 'rgba(18, 18, 18, 0.95)',
    border: '#FFCC00', // Warning Yellow
    text: '#FFCC00',
  },
};

/** Individual toast item */
function ToastItem({
  id,
  message,
  variant,
}: {
  id: string;
  message: string;
  variant: ToastVariant;
}) {
  const dismiss = useToastStore((s) => s.dismiss);
  const styles = VARIANT_STYLES[variant];

  const handleClick = useCallback(() => {
    dismiss(id);
  }, [id, dismiss]);

  return (
    <div
      className="toast-item animate-slide-in"
      style={{
        backgroundColor: styles.bg,
        borderLeft: `3px solid ${styles.border}`,
        color: styles.text,
        padding: '12px 16px',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        maxWidth: '320px',
        cursor: 'pointer',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '13px',
      }}
      onClick={handleClick}
      title="Click to dismiss"
    >
      {/* Icon based on variant */}
      <span style={{ fontSize: '16px' }}>
        {variant === 'success' && '\u2713'}
        {variant === 'error' && '\u2717'}
        {variant === 'info' && '\u2139'}
        {variant === 'warning' && '\u26A0'}
      </span>
      <span style={{ flex: 1 }}>{message}</span>
    </div>
  );
}

/**
 * Toast container component.
 * Renders all active toasts in the bottom-right corner.
 *
 * Add this component to your app's root layout:
 *
 * @example
 * ```tsx
 * import { ToastContainer } from '@/shared/components/Toast';
 *
 * function App() {
 *   return (
 *     <div>
 *       <MainContent />
 *       <ToastContainer />
 *     </div>
 *   );
 * }
 * ```
 */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="toast-container"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'auto',
      }}
    >
      {/* CSS for animations */}
      <style>{`
        @keyframes toast-slide-in {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .toast-item {
          animation: toast-slide-in 0.2s ease-out;
        }
        .toast-item:hover {
          opacity: 0.9;
        }
      `}</style>

      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          message={toast.message}
          variant={toast.variant}
        />
      ))}
    </div>
  );
}
