/**
 * Toast Store Tests
 *
 * Story 5.1: Remove Library Ingestion Panel & Add Context Menu Import
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useToastStore, toast } from './toast.store';

describe('toast.store', () => {
  beforeEach(() => {
    // Clear all toasts before each test
    useToastStore.getState().dismissAll();
  });

  describe('show', () => {
    it('should add a toast to the queue', () => {
      const id = toast.info('Test message');
      const toasts = useToastStore.getState().toasts;

      expect(toasts).toHaveLength(1);
      expect(toasts[0].id).toBe(id);
      expect(toasts[0].message).toBe('Test message');
      expect(toasts[0].variant).toBe('info');
    });

    it('should generate unique IDs for each toast', () => {
      const id1 = toast.info('Message 1');
      const id2 = toast.info('Message 2');

      expect(id1).not.toBe(id2);
    });

    it('should limit queue to MAX_TOASTS', () => {
      toast.info('Toast 1');
      toast.info('Toast 2');
      toast.info('Toast 3');
      toast.info('Toast 4'); // Should push out Toast 1

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(3);
      expect(toasts[0].message).toBe('Toast 2');
    });
  });

  describe('update', () => {
    it('should update an existing toast message', () => {
      const id = toast.info('Initial message');
      toast.update(id, 'Updated message');

      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].message).toBe('Updated message');
      expect(toasts[0].variant).toBe('info'); // Variant unchanged
    });

    it('should update toast variant when provided', () => {
      const id = toast.info('Processing...');
      toast.update(id, 'Success!', 'success');

      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].message).toBe('Success!');
      expect(toasts[0].variant).toBe('success');
    });

    it('should not affect other toasts when updating', () => {
      const id1 = toast.info('Toast 1');
      toast.info('Toast 2');
      toast.update(id1, 'Updated Toast 1');

      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].message).toBe('Updated Toast 1');
      expect(toasts[1].message).toBe('Toast 2');
    });

    it('should handle updating non-existent toast gracefully', () => {
      toast.info('Existing toast');
      toast.update('non-existent-id', 'Should not crash');

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe('Existing toast');
    });
  });

  describe('dismiss', () => {
    it('should remove a toast by ID', () => {
      const id = toast.info('To be dismissed');
      expect(useToastStore.getState().toasts).toHaveLength(1);

      toast.dismiss(id);
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('should handle dismissing non-existent toast gracefully', () => {
      toast.info('Existing');
      toast.dismiss('non-existent-id');

      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
  });

  describe('dismissAll', () => {
    it('should remove all toasts', () => {
      toast.info('Toast 1');
      toast.info('Toast 2');
      toast.info('Toast 3');

      useToastStore.getState().dismissAll();
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });
  });

  describe('convenience methods', () => {
    it('toast.success should create success variant', () => {
      toast.success('Success message');
      expect(useToastStore.getState().toasts[0].variant).toBe('success');
    });

    it('toast.error should create error variant', () => {
      toast.error('Error message');
      expect(useToastStore.getState().toasts[0].variant).toBe('error');
    });

    it('toast.warning should create warning variant', () => {
      toast.warning('Warning message');
      expect(useToastStore.getState().toasts[0].variant).toBe('warning');
    });
  });
});
