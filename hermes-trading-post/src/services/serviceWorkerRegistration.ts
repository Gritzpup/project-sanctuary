/**
 * Service Worker Registration
 *
 * Registers and manages the service worker lifecycle.
 * Provides utilities for cache management and updates.
 */

export interface ServiceWorkerStatus {
  isRegistered: boolean;
  isActive: boolean;
  hasUpdate: boolean;
  registration: ServiceWorkerRegistration | null;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private updateCallbacks: Set<(hasUpdate: boolean) => void> = new Set();

  /**
   * Register the service worker
   */
  async register(): Promise<ServiceWorkerRegistration | null> {
    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      console.log('[SW Manager] Service workers not supported');
      return null;
    }

    // Don't register in development mode with HMR
    if (import.meta.env.DEV && import.meta.hot) {
      console.log('[SW Manager] Skipping service worker in dev mode with HMR');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      this.registration = registration;
      console.log('[SW Manager] Service worker registered:', registration.scope);

      // Set up update detection
      this.setupUpdateListener(registration);

      // Check for updates on page load
      registration.update();

      return registration;
    } catch (error) {
      console.error('[SW Manager] Registration failed:', error);
      return null;
    }
  }

  /**
   * Unregister the service worker
   */
  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const success = await this.registration.unregister();
      console.log('[SW Manager] Service worker unregistered:', success);
      this.registration = null;
      return success;
    } catch (error) {
      console.error('[SW Manager] Unregistration failed:', error);
      return false;
    }
  }

  /**
   * Check for service worker updates
   */
  async checkForUpdates(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      await this.registration.update();
      return !!this.registration.waiting;
    } catch (error) {
      console.error('[SW Manager] Update check failed:', error);
      return false;
    }
  }

  /**
   * Skip waiting and activate new service worker immediately
   */
  skipWaiting(): void {
    if (this.registration?.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  /**
   * Set up listener for service worker updates
   */
  private setupUpdateListener(registration: ServiceWorkerRegistration): void {
    // Listen for new service worker installing
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;

      if (!newWorker) {
        return;
      }

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker is ready
          console.log('[SW Manager] New service worker available');
          this.notifyUpdateAvailable(true);
        }
      });
    });

    // Listen for controller change (new service worker activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW Manager] Service worker controller changed - reloading page');
      window.location.reload();
    });
  }

  /**
   * Subscribe to update notifications
   */
  onUpdateAvailable(callback: (hasUpdate: boolean) => void): () => void {
    this.updateCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.updateCallbacks.delete(callback);
    };
  }

  /**
   * Notify subscribers of available update
   */
  private notifyUpdateAvailable(hasUpdate: boolean): void {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(hasUpdate);
      } catch (error) {
        console.error('[SW Manager] Update callback error:', error);
      }
    });
  }

  /**
   * Clear all caches
   */
  async clearAllCaches(): Promise<void> {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('[SW Manager] All caches cleared');
  }

  /**
   * Clear specific cache
   */
  async clearCache(cacheName: string): Promise<void> {
    await caches.delete(cacheName);
    console.log(`[SW Manager] Cache cleared: ${cacheName}`);
  }

  /**
   * Get total cache size
   */
  async getCacheSize(): Promise<number> {
    if (!this.registration) {
      return 0;
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.size || 0);
      };

      this.registration.active?.postMessage(
        { type: 'GET_CACHE_SIZE' },
        [messageChannel.port2]
      );

      // Timeout after 5 seconds
      setTimeout(() => resolve(0), 5000);
    });
  }

  /**
   * Get current service worker status
   */
  getStatus(): ServiceWorkerStatus {
    return {
      isRegistered: !!this.registration,
      isActive: !!this.registration?.active,
      hasUpdate: !!this.registration?.waiting,
      registration: this.registration
    };
  }
}

// Export singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();

// Auto-register on import (can be disabled if needed)
export async function initializeServiceWorker(): Promise<void> {
  try {
    await serviceWorkerManager.register();
  } catch (error) {
    console.error('[SW Manager] Initialization failed:', error);
  }
}
