import { ServiceRegistry } from './ServiceRegistry';
import { EventBus } from './EventBus';

// Import service implementations
import { UnifiedAPIClient } from '../api/UnifiedAPIClient';
import { CoinbaseAPIService } from '../api/CoinbaseAPIService';
import { BackendAPIService } from '../api/BackendAPIService';
import { ChartDataOrchestrator } from '../chart/ChartDataOrchestrator';

export class ServiceInitializer {
  private static initialized = false;

  public static async initialize(): Promise<void> {
    if (ServiceInitializer.initialized) {
      console.log('Services already initialized');
      return;
    }

    const registry = ServiceRegistry.getInstance();
    const eventBus = EventBus.getInstance();

    console.log('🚀 Initializing service registry...');

    try {
      // Register core services
      ServiceInitializer.registerCoreServices(registry);
      
      // Register API services
      ServiceInitializer.registerAPIServices(registry);
      
      // Register chart services
      ServiceInitializer.registerChartServices(registry);
      
      // Validate dependencies
      const validation = registry.validateDependencies();
      if (!validation.valid) {
        throw new Error(`Dependency validation failed: ${validation.errors.join(', ')}`);
      }

      // Initialize critical services
      await ServiceInitializer.initializeCriticalServices(registry);

      ServiceInitializer.initialized = true;
      console.log('✅ Service registry initialization complete');

      // Emit initialization complete event
      eventBus.emitSync('services:initialized', {
        registeredServices: registry.getServiceNames(),
        stats: registry.getStats()
      });

    } catch (error) {
      console.error('❌ Service initialization failed:', error);
      eventBus.emitSync('services:initializationFailed', { error });
      throw error;
    }
  }

  private static registerCoreServices(registry: ServiceRegistry): void {
    // Event Bus (singleton)
    registry.registerSingleton('eventBus', () => EventBus.getInstance());

    // Service Registry (singleton)
    registry.registerSingleton('serviceRegistry', () => ServiceRegistry.getInstance());
  }

  private static registerAPIServices(registry: ServiceRegistry): void {
    // Unified API Client (singleton)
    registry.registerSingleton('unifiedAPIClient', () => UnifiedAPIClient.getInstance());

    // Coinbase API Service (singleton)
    registry.registerSingleton('coinbaseAPI', () => CoinbaseAPIService.getInstance());

    // Backend API Service (singleton)
    registry.registerSingleton('backendAPI', () => BackendAPIService.getInstance());
  }

  private static registerChartServices(registry: ServiceRegistry): void {
    // Chart Data Orchestrator (singleton)
    registry.registerSingleton('chartDataOrchestrator', () => ChartDataOrchestrator.getInstance());
  }

  private static async initializeCriticalServices(registry: ServiceRegistry): Promise<void> {
    // Services that need immediate initialization
    const criticalServices = [
      'eventBus',
      'unifiedAPIClient',
      'coinbaseAPI',
      'backendAPI'
    ];

    for (const serviceName of criticalServices) {
      try {
        const service = registry.get(serviceName);
        
        // Initialize if the service has an initialize method
        if (service && typeof service.initialize === 'function') {
          await service.initialize();
        }
        
        console.log(`✅ Initialized critical service: ${serviceName}`);
      } catch (error) {
        console.error(`❌ Failed to initialize critical service '${serviceName}':`, error);
        throw error;
      }
    }
  }

  public static async shutdown(): Promise<void> {
    if (!ServiceInitializer.initialized) {
      return;
    }

    console.log('🛑 Shutting down services...');

    const registry = ServiceRegistry.getInstance();
    const eventBus = EventBus.getInstance();

    try {
      // Emit shutdown event
      eventBus.emitSync('services:shuttingDown', {});

      // Dispose all services
      registry.disposeAll();

      // Clear event bus
      eventBus.removeAllListeners();
      eventBus.clearHistory();

      ServiceInitializer.initialized = false;
      console.log('✅ Service shutdown complete');

    } catch (error) {
      console.error('❌ Service shutdown failed:', error);
      throw error;
    }
  }

  public static isInitialized(): boolean {
    return ServiceInitializer.initialized;
  }

  public static getRegistry(): ServiceRegistry {
    return ServiceRegistry.getInstance();
  }

  public static getEventBus(): EventBus {
    return EventBus.getInstance();
  }

  // Helper methods for getting services
  public static getService<T>(serviceName: string): T {
    if (!ServiceInitializer.initialized) {
      throw new Error('Services not initialized. Call ServiceInitializer.initialize() first.');
    }

    return ServiceInitializer.getRegistry().get<T>(serviceName);
  }

  public static getCoinbaseAPI(): CoinbaseAPIService {
    return ServiceInitializer.getService<CoinbaseAPIService>('coinbaseAPI');
  }

  public static getBackendAPI(): BackendAPIService {
    return ServiceInitializer.getService<BackendAPIService>('backendAPI');
  }

  public static getChartDataOrchestrator(): ChartDataOrchestrator {
    return ServiceInitializer.getService<ChartDataOrchestrator>('chartDataOrchestrator');
  }

  public static getUnifiedAPIClient(): UnifiedAPIClient {
    return ServiceInitializer.getService<UnifiedAPIClient>('unifiedAPIClient');
  }

  // Register custom services
  public static registerService<T>(
    name: string,
    factory: (...dependencies: any[]) => T,
    dependencies: string[] = [],
    singleton: boolean = true
  ): void {
    const registry = ServiceInitializer.getRegistry();
    registry.register(name, factory, dependencies, singleton);
  }

  // Health check for all services
  public static async healthCheck(): Promise<{
    healthy: boolean;
    services: Record<string, { healthy: boolean; error?: string }>;
    stats: any;
  }> {
    const registry = ServiceInitializer.getRegistry();
    const serviceNames = registry.getInstanceNames();
    const results: Record<string, { healthy: boolean; error?: string }> = {};
    let allHealthy = true;

    for (const serviceName of serviceNames) {
      try {
        const service = registry.get(serviceName);
        
        if (service && typeof service.isHealthy === 'function') {
          const healthy = await service.isHealthy();
          results[serviceName] = { healthy };
          if (!healthy) allHealthy = false;
        } else {
          results[serviceName] = { healthy: true }; // Assume healthy if no health check
        }
      } catch (error) {
        results[serviceName] = { healthy: false, error: error.message };
        allHealthy = false;
      }
    }

    return {
      healthy: allHealthy,
      services: results,
      stats: registry.getStats()
    };
  }
}