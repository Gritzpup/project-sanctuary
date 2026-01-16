/**
 * @file createBaseStore.ts
 * @description Base store factory with persistence support
 * Part of Phase 18: State Management Refactoring
 * 🚀 Provides type-safe store creation with automatic localStorage sync
 */

import { writable, type Writable } from 'svelte/store';

interface PersistenceConfig {
  key: string;
  storage?: 'localStorage' | 'sessionStorage';
  serialize?: (value: any) => string;
  deserialize?: (value: string) => any;
}

interface BaseStoreOptions<T> {
  initial: T;
  persist?: PersistenceConfig;
  validate?: (value: any) => boolean;
  debug?: boolean;
}

/**
 * Create a base store with optional persistence
 * @example
 * const userStore = createBaseStore({
 *   initial: { name: 'User' },
 *   persist: { key: 'user-prefs', storage: 'localStorage' },
 *   validate: (v) => typeof v.name === 'string'
 * });
 */
export function createBaseStore<T>(options: BaseStoreOptions<T>): Writable<T> & {
  initialize: () => void;
  reset: () => void;
  getSnapshot: () => T;
} {
  // Try to restore from persistence
  let initialValue = options.initial;

  if (options.persist) {
    try {
      const stored = getPersistedValue(options.persist);
      if (stored !== null && (!options.validate || options.validate(stored))) {
        initialValue = stored;
      }
    } catch (error) {
      if (options.debug) {
      }
    }
  }

  // Create the base store
  const store = writable<T>(initialValue);
  let currentValue = initialValue;

  // Subscribe to updates
  store.subscribe((value) => {
    currentValue = value;

    // Persist if configured
    if (options.persist) {
      try {
        persistValue(options.persist, value);
      } catch (error) {
        if (options.debug) {
        }
      }
    }
  });

  return {
    ...store,
    initialize: () => {
      if (options.debug) {
      }
    },
    reset: () => {
      store.set(options.initial);
    },
    getSnapshot: () => currentValue
  };
}

/**
 * Get persisted value from storage
 */
function getPersistedValue(config: PersistenceConfig): any {
  const storage = config.storage === 'sessionStorage' ? sessionStorage : localStorage;
  const stored = storage.getItem(config.key);

  if (!stored) return null;

  try {
    return config.deserialize ? config.deserialize(stored) : JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Persist value to storage
 */
function persistValue(config: PersistenceConfig, value: any): void {
  const storage = config.storage === 'sessionStorage' ? sessionStorage : localStorage;
  const serialized = config.serialize ? config.serialize(value) : JSON.stringify(value);
  storage.setItem(config.key, serialized);
}

/**
 * Create a read-only derived store
 * @example
 * const filteredItems = derivedStore(itemsStore, (items) =>
 *   items.filter(i => i.active)
 * );
 */
export function derivedStore<T, U>(
  source: Writable<T>,
  derive: (value: T) => U
): Writable<U> {
  let sourceValue: T = undefined as unknown as T;
  source.subscribe((value) => {
    sourceValue = value;
  });

  return writable<U>(derive(sourceValue), (set) => {
    const unsubscribe = source.subscribe((value) => {
      set(derive(value));
    });
    return unsubscribe;
  });
}

/**
 * Combine multiple stores into one
 * @example
 * const combined = combineStores(
 *   { user: userStore, settings: settingsStore },
 *   ({ user, settings }) => ({ user, settings })
 * );
 */
export function combineStores<T extends Record<string, Writable<any>>, U>(
  stores: T,
  combine: (values: { [K in keyof T]: any }) => U
): Writable<U> {
  const values: any = {};

  // Initialize values
  for (const [key, store] of Object.entries(stores)) {
    store.subscribe((value) => {
      values[key] = value;
    });
  }

  const combined = writable<U>(combine(values));

  // Subscribe to all stores
  for (const store of Object.values(stores)) {
    store.subscribe(() => {
      combined.set(combine(values));
    });
  }

  return combined;
}

/**
 * Create a store that syncs with external state
 * @example
 * const syncedStore = createSyncedStore({
 *   initial: [],
 *   sync: async () => {
 *     const data = await fetch('/api/items').then(r => r.json());
 *     return data;
 *   },
 *   interval: 5000 // Sync every 5 seconds
 * });
 */
export function createSyncedStore<T>(options: {
  initial: T;
  sync: () => Promise<T>;
  interval?: number;
  debug?: boolean;
}): Writable<T> & {
  refresh: () => Promise<void>;
  stop: () => void;
} {
  const store = writable<T>(options.initial);
  let intervalId: number | null = null;
  let isRefreshing = false;

  const refresh = async () => {
    if (isRefreshing) return;

    try {
      isRefreshing = true;
      if (options.debug) {
      }

      const value = await options.sync();
      store.set(value);
    } catch (error) {
      if (options.debug) {
      }
    } finally {
      isRefreshing = false;
    }
  };

  const stop = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  // Start sync interval if configured
  if (options.interval && options.interval > 0) {
    intervalId = window.setInterval(() => {
      refresh();
    }, options.interval);
  }

  return {
    ...store,
    refresh,
    stop
  };
}
