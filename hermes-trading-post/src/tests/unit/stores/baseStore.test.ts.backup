/**
 * @file baseStore.test.ts
 * @description Unit tests for base store factory
 * Part of Phase 22: Testing & Documentation
 * 🧪 Comprehensive test coverage for store creation and persistence
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createBaseStore, derivedStore, combineStores } from '../../../stores/factory/createBaseStore';

describe('BaseStore Factory', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('createBaseStore', () => {
    it('should create a writable store with initial value', () => {
      const store = createBaseStore({ initial: { count: 0 } });
      let value: any;
      store.subscribe((v) => {
        value = v;
      });

      expect(value).toEqual({ count: 0 });
    });

    it('should update store value', () => {
      const store = createBaseStore({ initial: { count: 0 } });
      store.set({ count: 1 });

      let value: any;
      store.subscribe((v) => {
        value = v;
      });

      expect(value).toEqual({ count: 1 });
    });

    it('should persist to localStorage', () => {
      const store = createBaseStore({
        initial: { name: 'Test' },
        persist: { key: 'test-store', storage: 'localStorage' }
      });

      store.set({ name: 'Updated' });

      const stored = localStorage.getItem('test-store');
      expect(stored).toBeDefined();
      expect(JSON.parse(stored!)).toEqual({ name: 'Updated' });
    });

    it('should restore from localStorage on creation', () => {
      localStorage.setItem('test-restore', JSON.stringify({ count: 42 }));

      const store = createBaseStore({
        initial: { count: 0 },
        persist: { key: 'test-restore', storage: 'localStorage' }
      });

      let value: any;
      store.subscribe((v) => {
        value = v;
      });

      expect(value.count).toBe(42);
    });

    it('should validate persisted data', () => {
      localStorage.setItem('test-validate', JSON.stringify({ invalid: true }));

      const store = createBaseStore({
        initial: { count: 0 },
        persist: { key: 'test-validate', storage: 'localStorage' },
        validate: (v) => typeof v === 'object' && 'count' in v
      });

      let value: any;
      store.subscribe((v) => {
        value = v;
      });

      // Should use initial value since validation failed
      expect(value).toEqual({ count: 0 });
    });

    it('should reset to initial value', () => {
      const store = createBaseStore({ initial: { count: 0 } });
      store.set({ count: 10 });
      store.reset();

      let value: any;
      store.subscribe((v) => {
        value = v;
      });

      expect(value).toEqual({ count: 0 });
    });

    it('should provide snapshot via getSnapshot', () => {
      const store = createBaseStore({ initial: { count: 0 } });
      store.set({ count: 5 });

      const snapshot = store.getSnapshot();
      expect(snapshot).toEqual({ count: 5 });
    });

    it('should call initialize', () => {
      const store = createBaseStore({ initial: {} });
      expect(() => store.initialize()).not.toThrow();
    });
  });

  describe('derivedStore', () => {
    it('should derive values from source store', () => {
      const source = createBaseStore({ initial: [1, 2, 3] });
      const derived = derivedStore(source, (items) => items.map((x) => x * 2));

      let value: any;
      derived.subscribe((v) => {
        value = v;
      });

      expect(value).toEqual([2, 4, 6]);
    });

    it('should update when source changes', () => {
      const source = createBaseStore({ initial: [1, 2] });
      const derived = derivedStore(source, (items) => items.length);

      let value: number | undefined;
      derived.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(2);

      source.set([1, 2, 3, 4]);
      expect(value).toBe(4);
    });
  });

  describe('combineStores', () => {
    it('should combine multiple stores', () => {
      const store1 = createBaseStore({ initial: { name: 'Alice' } });
      const store2 = createBaseStore({ initial: { age: 30 } });

      const combined = combineStores(
        { user: store1, profile: store2 },
        (values) => ({ ...values.user, ...values.profile })
      );

      let value: any;
      combined.subscribe((v) => {
        value = v;
      });

      expect(value).toEqual({ name: 'Alice', age: 30 });
    });

    it('should update when any source changes', () => {
      const store1 = createBaseStore({ initial: { x: 1 } });
      const store2 = createBaseStore({ initial: { y: 2 } });

      const combined = combineStores(
        { a: store1, b: store2 },
        (values) => values.a.x + values.b.y
      );

      let value: number | undefined;
      combined.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(3);

      store1.set({ x: 10 });
      expect(value).toBe(12);

      store2.set({ y: 5 });
      expect(value).toBe(15);
    });
  });
});

describe('BaseStore Edge Cases', () => {
  it('should handle localStorage quota exceeded', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => {
      const store = createBaseStore({
        initial: { data: 'test' },
        persist: { key: 'test', storage: 'localStorage' },
        debug: false
      });
      store.set({ data: 'new' });
    }).not.toThrow();

    spy.mockRestore();
  });

  it('should handle corrupted JSON in storage', () => {
    localStorage.setItem('corrupted', 'not valid json {{{');

    const store = createBaseStore({
      initial: { count: 0 },
      persist: { key: 'corrupted', storage: 'localStorage' },
      debug: false
    });

    let value: any;
    store.subscribe((v) => {
      value = v;
    });

    expect(value).toEqual({ count: 0 });
  });

  it('should handle custom serialization', () => {
    const store = createBaseStore({
      initial: new Date('2025-01-01'),
      persist: {
        key: 'custom-date',
        storage: 'localStorage',
        serialize: (v) => v.toISOString(),
        deserialize: (s) => new Date(s)
      }
    });

    store.set(new Date('2025-12-31'));

    const stored = localStorage.getItem('custom-date');
    expect(stored).toBe('2025-12-31T00:00:00.000Z');
  });
});
