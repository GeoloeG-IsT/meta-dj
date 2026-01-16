/**
 * Toast Store - Zustand state management for toast notifications
 *
 * Manages a queue of toast messages with auto-dismiss functionality.
 * Supports persistent toasts for progress tracking that won't be evicted.
 */

import { create } from 'zustand';

/** Toast message variant types */
export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

/** Toast message interface */
export interface ToastMessage {
  /** Unique identifier for this toast */
  id: string;
  /** Message to display */
  message: string;
  /** Visual variant */
  variant: ToastVariant;
  /** Duration in milliseconds before auto-dismiss (default: 2000, 0 = no auto-dismiss) */
  duration: number;
  /** Timestamp when toast was created */
  createdAt: number;
  /** If true, toast won't be evicted when MAX_TOASTS exceeded */
  persistent?: boolean;
}

/** Toast store state */
interface ToastState {
  /** Queue of active toast messages */
  toasts: ToastMessage[];

  /** Add a new toast message */
  show: (options: {
    message: string;
    variant?: ToastVariant;
    duration?: number;
    persistent?: boolean;
  }) => string;

  /** Update an existing toast message */
  update: (id: string, message: string, variant?: ToastVariant) => void;

  /** Remove a toast by ID */
  dismiss: (id: string) => void;

  /** Remove all toasts */
  dismissAll: () => void;
}

/** Generate unique toast ID */
function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/** Default toast duration in milliseconds */
const DEFAULT_DURATION = 2000;

/** Maximum number of toasts to show at once */
const MAX_TOASTS = 3;

/**
 * Toast store for managing notifications.
 *
 * @example
 * ```tsx
 * import { useToastStore } from '@/shared/store/toast.store';
 *
 * // Show a success toast
 * const { show } = useToastStore();
 * show({ message: 'Saved!', variant: 'success' });
 *
 * // Show an error toast with custom duration
 * show({ message: 'Failed to save', variant: 'error', duration: 5000 });
 * ```
 */
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  show: ({ message, variant = 'success', duration = DEFAULT_DURATION, persistent = false }) => {
    const id = generateId();

    set((state) => {
      // Limit queue size - remove oldest non-persistent toast if at max
      let toasts = state.toasts;
      if (toasts.length >= MAX_TOASTS) {
        // Find first non-persistent toast to evict
        const evictIndex = toasts.findIndex((t) => !t.persistent);
        if (evictIndex !== -1) {
          toasts = [...toasts.slice(0, evictIndex), ...toasts.slice(evictIndex + 1)];
        }
        // If all are persistent, allow exceeding MAX_TOASTS
      }

      return {
        toasts: [
          ...toasts,
          {
            id,
            message,
            variant,
            duration,
            createdAt: Date.now(),
            persistent,
          },
        ],
      };
    });

    // Auto-dismiss after duration (skip if duration is 0)
    if (duration > 0) {
      setTimeout(() => {
        get().dismiss(id);
      }, duration);
    }

    return id;
  },

  update: (id, message, variant) => {
    set((state) => ({
      toasts: state.toasts.map((t) =>
        t.id === id
          ? { ...t, message, variant: variant ?? t.variant }
          : t
      ),
    }));
  },

  dismiss: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  dismissAll: () => {
    set({ toasts: [] });
  },
}));

/**
 * Convenience functions for showing toasts.
 *
 * @example
 * ```tsx
 * import { toast } from '@/shared/store/toast.store';
 *
 * toast.success('Beatgrid saved');
 * toast.error('Failed to save');
 * toast.info('Processing...');
 * ```
 */
export const toast = {
  success: (message: string, duration?: number) =>
    useToastStore.getState().show({ message, variant: 'success', duration }),

  error: (message: string, duration?: number) =>
    useToastStore.getState().show({ message, variant: 'error', duration }),

  info: (message: string, duration?: number) =>
    useToastStore.getState().show({ message, variant: 'info', duration }),

  warning: (message: string, duration?: number) =>
    useToastStore.getState().show({ message, variant: 'warning', duration }),

  /** Create a persistent progress toast (no auto-dismiss, won't be evicted) */
  progress: (message: string) =>
    useToastStore.getState().show({ message, variant: 'info', duration: 0, persistent: true }),

  /** Update an existing toast's message */
  update: (id: string, message: string, variant?: ToastVariant) =>
    useToastStore.getState().update(id, message, variant),

  /** Dismiss a toast by ID */
  dismiss: (id: string) =>
    useToastStore.getState().dismiss(id),
};
