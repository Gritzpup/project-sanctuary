// Core service infrastructure exports
export { ServiceRegistry } from './ServiceRegistry';
export { EventBus } from './EventBus';
export { ServiceBase } from './ServiceBase';
export { ServiceInitializer } from './ServiceInitializer';
export { LoggingService, LogLevel, logger } from './LoggingService';
export { ErrorHandlingService, ErrorSeverity, ErrorCategory, errorHandler } from './ErrorHandlingService';

// Types
export type { ServiceDefinition, ServiceInstance } from './ServiceRegistry';
export type { EventListener, EventSubscription } from './EventBus';

// Easy access to singletons
export const serviceRegistry = ServiceRegistry.getInstance();
export const eventBus = EventBus.getInstance();
export { logger } from './LoggingService';