/**
 * @file StoreManager.ts
 * @description Centralized store registry and lifecycle management
 * Part of Phase 18: State Management Refactoring
 * 🚀 Manages all application stores, initialization, and dependencies
 */

import type { Writable } from 'svelte/store';

interface RegisteredStore {
  name: string;
  store: Writable<any>;
  initialized: boolean;
  initializer?: () => void | Promise<void>;
  dependencies?: string[];
  debug?: boolean;
}

/**
 * Centralized store manager for application state
 */
export class StoreManager {
  private static instance: StoreManager | null = null;
  private stores = new Map<string, RegisteredStore>();
  private initOrder: string[] = [];
  private isInitializing = false;
  private isInitialized = false;
  private debug = false;

  private constructor(debug = false) {
    this.debug = debug;
  }

  /**
   * Get or create singleton instance
   */
  static getInstance(debug = false): StoreManager {
    if (!StoreManager.instance) {
      StoreManager.instance = new StoreManager(debug);
    }
    return StoreManager.instance;
  }

  /**
   * Register a store
   */
  registerStore<T>(
    name: string,
    store: Writable<T>,
    options?: {
      initializer?: () => void | Promise<void>;
      dependencies?: string[];
      debug?: boolean;
    }
  ): void {
    if (this.stores.has(name)) {
      return;
    }

    if (this.isInitialized) {
      return;
    }

    this.stores.set(name, {
      name,
      store,
      initialized: false,
      initializer: options?.initializer,
      dependencies: options?.dependencies,
      debug: options?.debug
    });

    if (this.debug) {
    }
  }

  /**
   * Initialize all registered stores in dependency order
   */
  async initialize(): Promise<void> {
    if (this.isInitializing || this.isInitialized) {
      return;
    }

    this.isInitializing = true;

    try {
      // Topologically sort stores by dependencies
      this.initOrder = this.topologicalSort();

      // Initialize in order
      for (const storeName of this.initOrder) {
        const registered = this.stores.get(storeName);
        if (!registered) continue;

        try {
          if (registered.debug || this.debug) {
          }

          if (registered.initializer) {
            const result = registered.initializer();
            if (result instanceof Promise) {
              await result;
            }
          }

          registered.initialized = true;
        } catch (error) {
          throw error;
        }
      }

      this.isInitialized = true;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Get a registered store
   */
  getStore<T>(name: string): Writable<T> | null {
    const registered = this.stores.get(name);
    return registered?.store ?? null;
  }

  /**
   * Check if a store is initialized
   */
  isStoreInitialized(name: string): boolean {
    const registered = this.stores.get(name);
    return registered?.initialized ?? false;
  }

  /**
   * Reset all stores
   */
  async reset(): Promise<void> {
    for (const registered of this.stores.values()) {
      if (registered.initialized) {
        // Call initializer again to reset
        if (registered.initializer) {
          const result = registered.initializer();
          if (result instanceof Promise) {
            await result;
          }
        }
      }
    }

    if (this.debug) {
    }
  }

  /**
   * Get store statistics for debugging
   */
  getStats(): {
    totalStores: number;
    initializedStores: number;
    stores: { name: string; initialized: boolean }[];
  } {
    const stores = Array.from(this.stores.values()).map((s) => ({
      name: s.name,
      initialized: s.initialized
    }));

    return {
      totalStores: this.stores.size,
      initializedStores: stores.filter((s) => s.initialized).length,
      stores
    };
  }

  /**
   * Topologically sort stores by dependencies
   */
  private topologicalSort(): string[] {
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string): void => {
      if (visited.has(name)) {
        return;
      }

      if (visiting.has(name)) {
        throw new Error(`[StoreManager] Circular dependency detected: ${name}`);
      }

      visiting.add(name);

      const registered = this.stores.get(name);
      if (registered?.dependencies) {
        for (const dep of registered.dependencies) {
          if (!this.stores.has(dep)) {
            throw new Error(
              `[StoreManager] Unknown dependency ${dep} for store ${name}`
            );
          }
          visit(dep);
        }
      }

      visiting.delete(name);
      visited.add(name);
      sorted.push(name);
    };

    for (const name of this.stores.keys()) {
      visit(name);
    }

    return sorted;
  }

  /**
   * Enable debug logging
   */
  enableDebug(enabled = true): void {
    this.debug = enabled;
  }

  /**
   * Get initialization order (for debugging)
   */
  getInitializationOrder(): string[] {
    return [...this.initOrder];
  }
}

/**
 * Global store manager singleton
 */
export const storeManager = StoreManager.getInstance();

/**
 * Hook to use store manager in components
 * @example
 * const store = useStore<User>('userStore');
 */
export function useStore<T>(name: string): Writable<T> | null {
  const store = storeManager.getStore<T>(name);
  if (!store) {
  }
  return store;
}

/**
 * Initialize all stores
 * @example
 * await initializeStores();
 */
export async function initializeStores(): Promise<void> {
  await storeManager.initialize();
}

/**
 * Reset all stores
 * @example
 * await resetStores();
 */
export async function resetStores(): Promise<void> {
  await storeManager.reset();
}

/**
 * Get store manager statistics
 * @example
 * const stats = getStoreStats();
 */
export function getStoreStats(): {
  totalStores: number;
  initializedStores: number;
  stores: { name: string; initialized: boolean }[];
} {
  return storeManager.getStats();
}
