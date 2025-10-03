/**
 * Centralized Event Bus Service
 * Provides type-safe event communication across components
 * Replaces the need for individual createEventDispatcher instances
 */

export interface EventBusEvent<T = any> {
  type: string;
  data: T;
  timestamp: number;
  source?: string;
}

export type EventHandler<T = any> = (event: EventBusEvent<T>) => void;

export class EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private eventHistory: EventBusEvent[] = [];
  private maxHistorySize = 100;
  private debugMode = false;

  constructor(options?: { debugMode?: boolean; maxHistorySize?: number }) {
    this.debugMode = options?.debugMode ?? false;
    this.maxHistorySize = options?.maxHistorySize ?? 100;
  }

  /**
   * Subscribe to an event type
   */
  on<T = any>(eventType: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(handler as EventHandler);
    
    if (this.debugMode) {
      console.log(`🎯 EventBus: Subscribed to "${eventType}"`);
    }
    
    // Return unsubscribe function
    return () => this.off(eventType, handler);
  }

  /**
   * Subscribe to an event type only once
   */
  once<T = any>(eventType: string, handler: EventHandler<T>): () => void {
    const onceHandler = (event: EventBusEvent<T>) => {
      handler(event);
      this.off(eventType, onceHandler);
    };
    
    return this.on(eventType, onceHandler);
  }

  /**
   * Unsubscribe from an event type
   */
  off<T = any>(eventType: string, handler: EventHandler<T>): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(handler as EventHandler);
      
      // Clean up empty listener sets
      if (listeners.size === 0) {
        this.listeners.delete(eventType);
      }
      
      if (this.debugMode) {
        console.log(`🎯 EventBus: Unsubscribed from "${eventType}"`);
      }
    }
  }

  /**
   * Emit an event
   */
  emit<T = any>(eventType: string, data: T, source?: string): void {
    const event: EventBusEvent<T> = {
      type: eventType,
      data,
      timestamp: Date.now(),
      source
    };

    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    if (this.debugMode) {
      console.log(`📡 EventBus: Emitting "${eventType}"`, data);
    }

    // Notify listeners
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`❌ EventBus: Error in handler for "${eventType}":`, error);
        }
      });
    }
  }

  /**
   * Get all active listeners (for debugging)
   */
  getListeners(): Record<string, number> {
    const result: Record<string, number> = {};
    this.listeners.forEach((listeners, eventType) => {
      result[eventType] = listeners.size;
    });
    return result;
  }

  /**
   * Get event history (for debugging)
   */
  getEventHistory(): EventBusEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
    if (this.debugMode) {
      console.log('🎯 EventBus: All listeners cleared');
    }
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Get statistics about the event bus
   */
  getStats(): {
    totalListeners: number;
    eventTypes: string[];
    totalEvents: number;
    recentEvents: EventBusEvent[];
  } {
    const totalListeners = Array.from(this.listeners.values())
      .reduce((sum, listeners) => sum + listeners.size, 0);
    
    const eventTypes = Array.from(this.listeners.keys());
    
    const recentEvents = this.eventHistory.slice(-10);

    return {
      totalListeners,
      eventTypes,
      totalEvents: this.eventHistory.length,
      recentEvents
    };
  }
}

// Create global event bus instance
export const globalEventBus = new EventBus({ 
  debugMode: process.env.NODE_ENV === 'development',
  maxHistorySize: 200 
});

// Export convenience functions that use the global instance
export const on = globalEventBus.on.bind(globalEventBus);
export const once = globalEventBus.once.bind(globalEventBus);
export const off = globalEventBus.off.bind(globalEventBus);
export const emit = globalEventBus.emit.bind(globalEventBus);

// Add window global for debugging (development only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).eventBus = globalEventBus;
}