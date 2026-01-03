export interface EventListener<T = any> {
  (event: T): void | Promise<void>;
}

export interface EventSubscription {
  unsubscribe(): void;
}

export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, Set<EventListener>> = new Map();
  private onceListeners: Map<string, Set<EventListener>> = new Map();
  private eventHistory: Map<string, any[]> = new Map();
  private maxHistorySize = 100;

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public on<T = any>(eventName: string, listener: EventListener<T>): EventSubscription {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }

    this.listeners.get(eventName)!.add(listener);

    return {
      unsubscribe: () => this.off(eventName, listener)
    };
  }

  public once<T = any>(eventName: string, listener: EventListener<T>): EventSubscription {
    if (!this.onceListeners.has(eventName)) {
      this.onceListeners.set(eventName, new Set());
    }

    this.onceListeners.get(eventName)!.add(listener);

    return {
      unsubscribe: () => this.offOnce(eventName, listener)
    };
  }

  public off<T = any>(eventName: string, listener: EventListener<T>): void {
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(eventName);
      }
    }
  }

  public offOnce<T = any>(eventName: string, listener: EventListener<T>): void {
    const listeners = this.onceListeners.get(eventName);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.onceListeners.delete(eventName);
      }
    }
  }

  public async emit<T = any>(eventName: string, data: T): Promise<void> {
    // Store in history
    this.addToHistory(eventName, data);

    // Handle regular listeners
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      const promises: Promise<void>[] = [];
      
      listeners.forEach(listener => {
        try {
          const result = listener(data);
          if (result instanceof Promise) {
            promises.push(result);
          }
        } catch (error) {
        }
      });

      // Wait for all async listeners
      if (promises.length > 0) {
        try {
          await Promise.allSettled(promises);
        } catch (error) {
        }
      }
    }

    // Handle once listeners
    const onceListeners = this.onceListeners.get(eventName);
    if (onceListeners) {
      const promises: Promise<void>[] = [];
      const listenersToRemove = Array.from(onceListeners);

      listenersToRemove.forEach(listener => {
        try {
          const result = listener(data);
          if (result instanceof Promise) {
            promises.push(result);
          }
        } catch (error) {
        }
      });

      // Remove once listeners
      this.onceListeners.delete(eventName);

      // Wait for all async once listeners
      if (promises.length > 0) {
        try {
          await Promise.allSettled(promises);
        } catch (error) {
        }
      }
    }
  }

  public emitSync<T = any>(eventName: string, data: T): void {
    // Store in history
    this.addToHistory(eventName, data);

    // Handle regular listeners (sync only)
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
        }
      });
    }

    // Handle once listeners (sync only)
    const onceListeners = this.onceListeners.get(eventName);
    if (onceListeners) {
      const listenersToRemove = Array.from(onceListeners);

      listenersToRemove.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
        }
      });

      // Remove once listeners
      this.onceListeners.delete(eventName);
    }
  }

  public hasListeners(eventName: string): boolean {
    const hasRegular = this.listeners.has(eventName) && this.listeners.get(eventName)!.size > 0;
    const hasOnce = this.onceListeners.has(eventName) && this.onceListeners.get(eventName)!.size > 0;
    return hasRegular || hasOnce;
  }

  public getListenerCount(eventName: string): number {
    const regularCount = this.listeners.get(eventName)?.size || 0;
    const onceCount = this.onceListeners.get(eventName)?.size || 0;
    return regularCount + onceCount;
  }

  public getEventNames(): string[] {
    const regularEvents = Array.from(this.listeners.keys());
    const onceEvents = Array.from(this.onceListeners.keys());
    return Array.from(new Set([...regularEvents, ...onceEvents]));
  }

  public removeAllListeners(eventName?: string): void {
    if (eventName) {
      this.listeners.delete(eventName);
      this.onceListeners.delete(eventName);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  public getHistory(eventName: string): any[] {
    return this.eventHistory.get(eventName) || [];
  }

  public clearHistory(eventName?: string): void {
    if (eventName) {
      this.eventHistory.delete(eventName);
    } else {
      this.eventHistory.clear();
    }
  }

  private addToHistory(eventName: string, data: any): void {
    if (!this.eventHistory.has(eventName)) {
      this.eventHistory.set(eventName, []);
    }

    const history = this.eventHistory.get(eventName)!;
    history.push({
      data,
      timestamp: Date.now()
    });

    // Limit history size
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
  }

  public setMaxHistorySize(size: number): void {
    this.maxHistorySize = size;
  }

  public getStats(): {
    totalEvents: number;
    regularListeners: number;
    onceListeners: number;
    historySize: number;
  } {
    const eventNames = this.getEventNames();
    const totalRegular = Array.from(this.listeners.values()).reduce((sum, set) => sum + set.size, 0);
    const totalOnce = Array.from(this.onceListeners.values()).reduce((sum, set) => sum + set.size, 0);
    const totalHistory = Array.from(this.eventHistory.values()).reduce((sum, arr) => sum + arr.length, 0);

    return {
      totalEvents: eventNames.length,
      regularListeners: totalRegular,
      onceListeners: totalOnce,
      historySize: totalHistory
    };
  }

  // Utility methods for common patterns
  public request<T = any, R = any>(eventName: string, data: T, timeout = 5000): Promise<R> {
    return new Promise((resolve, reject) => {
      const responseEventName = `${eventName}:response:${Date.now()}`;
      let timeoutId: any;

      // Set up response listener
      const subscription = this.once(responseEventName, (response: R) => {
        clearTimeout(timeoutId);
        resolve(response);
      });

      // Set up timeout
      timeoutId = setTimeout(() => {
        subscription.unsubscribe();
        reject(new Error(`Request timeout for event '${eventName}'`));
      }, timeout);

      // Emit request with response event name
      this.emitSync(eventName, { ...data, responseEvent: responseEventName });
    });
  }

  public respond<T = any, R = any>(eventName: string, handler: (data: T) => R | Promise<R>): EventSubscription {
    return this.on(eventName, async (requestData: any) => {
      try {
        const response = await handler(requestData);
        if (requestData.responseEvent) {
          this.emitSync(requestData.responseEvent, response);
        }
      } catch (error) {
        if (requestData.responseEvent) {
          this.emitSync(requestData.responseEvent, { error: error instanceof Error ? error.message : String(error) });
        }
      }
    });
  }
}