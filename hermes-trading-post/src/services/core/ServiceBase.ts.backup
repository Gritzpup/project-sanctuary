import { EventBus } from './EventBus';

export abstract class ServiceBase {
  protected eventBus: EventBus;
  protected isInitialized = false;
  protected isDisposed = false;

  constructor() {
    this.eventBus = EventBus.getInstance();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.isDisposed) {
      throw new Error(`Cannot initialize disposed service: ${this.constructor.name}`);
    }

    try {
      await this.onInitialize();
      this.isInitialized = true;
      this.eventBus.emitSync('service:initialized', { serviceName: this.constructor.name });
    } catch (error) {
      this.eventBus.emitSync('service:initializationFailed', { 
        serviceName: this.constructor.name, 
        error 
      });
      throw error;
    }
  }

  public async dispose(): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    try {
      await this.onDispose();
      this.isDisposed = true;
      this.isInitialized = false;
      this.eventBus.emitSync('service:disposed', { serviceName: this.constructor.name });
    } catch (error) {
      this.eventBus.emitSync('service:disposalFailed', { 
        serviceName: this.constructor.name, 
        error 
      });
      throw error;
    }
  }

  public getStatus(): {
    serviceName: string;
    isInitialized: boolean;
    isDisposed: boolean;
    uptime: number;
  } {
    return {
      serviceName: this.constructor.name,
      isInitialized: this.isInitialized,
      isDisposed: this.isDisposed,
      uptime: this.isInitialized ? Date.now() - this.initializationTime : 0
    };
  }

  protected abstract onInitialize(): Promise<void>;
  protected abstract onDispose(): Promise<void>;

  private initializationTime = Date.now();

  // Helper methods for common service patterns
  protected emit<T = any>(eventName: string, data: T): void {
    this.eventBus.emitSync(eventName, data);
  }

  protected async emitAsync<T = any>(eventName: string, data: T): Promise<void> {
    await this.eventBus.emit(eventName, data);
  }

  protected on<T = any>(eventName: string, listener: (event: T) => void): void {
    this.eventBus.on(eventName, listener);
  }

  protected once<T = any>(eventName: string, listener: (event: T) => void): void {
    this.eventBus.once(eventName, listener);
  }

  protected assertInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(`Service ${this.constructor.name} is not initialized`);
    }
  }

  protected assertNotDisposed(): void {
    if (this.isDisposed) {
      throw new Error(`Service ${this.constructor.name} is disposed`);
    }
  }
}