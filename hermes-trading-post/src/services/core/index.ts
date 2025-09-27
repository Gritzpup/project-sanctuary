// Core service infrastructure exports
export { ServiceRegistry } from './ServiceRegistry';
export { EventBus } from './EventBus';
export { ServiceBase } from './ServiceBase';
export { ServiceInitializer } from './ServiceInitializer';

// Types
export type { ServiceDefinition, ServiceInstance } from './ServiceRegistry';
export type { EventListener, EventSubscription } from './EventBus';

// Easy access to singletons
export const serviceRegistry = ServiceRegistry.getInstance();
export const eventBus = EventBus.getInstance();