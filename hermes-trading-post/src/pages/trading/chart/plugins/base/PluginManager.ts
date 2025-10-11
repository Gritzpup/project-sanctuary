import { Plugin, type PluginContext } from './Plugin';
import { ChartDebug } from '../../utils/debug';

export interface PluginEvent {
  type: 'registered' | 'unregistered' | 'enabled' | 'disabled' | 'error';
  pluginId: string;
  timestamp: number;
  error?: Error;
}

type PluginEventCallback = (event: PluginEvent) => void;

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private context: PluginContext | null = null;
  private eventCallbacks: Set<PluginEventCallback> = new Set();
  private initializationOrder: string[] = [];

  // Plugin registration
  async register(plugin: Plugin): Promise<void> {

    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin ${plugin.id} is already registered`);
    }

    this.plugins.set(plugin.id, plugin);
    this.initializationOrder.push(plugin.id);

    // Initialize if context is available
    if (this.context) {
      try {
        await plugin.initialize(this.context);
      } catch (error) {
        console.error(`❌ [PluginManager] Failed to initialize ${plugin.id}:`, error);
        this.plugins.delete(plugin.id);
        this.initializationOrder = this.initializationOrder.filter(id => id !== plugin.id);
        throw error;
      }
    } else {
    }

    this.emitEvent({
      type: 'registered',
      pluginId: plugin.id,
      timestamp: Date.now()
    });

    ChartDebug.log(`Registered plugin ${plugin.id}`);
  }

  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // Destroy plugin
    await plugin.destroy();

    // Remove from registry
    this.plugins.delete(pluginId);
    this.initializationOrder = this.initializationOrder.filter(id => id !== pluginId);

    this.emitEvent({
      type: 'unregistered',
      pluginId,
      timestamp: Date.now()
    });

    ChartDebug.log(`Unregistered plugin ${pluginId}`);
  }

  // Batch operations
  async registerMultiple(plugins: Plugin[]): Promise<void> {
    const errors: Array<{ plugin: Plugin; error: Error }> = [];

    for (const plugin of plugins) {
      try {
        await this.register(plugin);
      } catch (error) {
        errors.push({ plugin, error: error as Error });
      }
    }

    if (errors.length > 0) {
      ChartDebug.error('Failed to register some plugins:', errors);
      throw new Error(`Failed to register ${errors.length} plugins`);
    }
  }

  // Context management
  async setContext(context: PluginContext): Promise<void> {
    this.context = context;

    // Initialize all registered plugins
    const errors: Array<{ pluginId: string; error: Error }> = [];

    for (const pluginId of this.initializationOrder) {
      const plugin = this.plugins.get(pluginId);

      if (plugin && !plugin.initialized) {
        try {
          await plugin.initialize(context);
        } catch (error) {
          console.error(`❌ [PluginManager] Failed to initialize ${pluginId}:`, error);
          errors.push({ pluginId, error: error as Error });
          this.emitEvent({
            type: 'error',
            pluginId,
            timestamp: Date.now(),
            error: error as Error
          });
        }
      }
    }

    if (errors.length > 0) {
      ChartDebug.error('Failed to initialize some plugins:', errors);
    }
  }

  // Plugin access
  get(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  getAll(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getEnabled(): Plugin[] {
    return this.getAll().filter(plugin => plugin.enabled);
  }

  getByType<T extends Plugin>(type: new (...args: any[]) => T): T[] {
    return this.getAll().filter(plugin => plugin instanceof type) as T[];
  }

  // Plugin control
  enable(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    plugin.enable();

    this.emitEvent({
      type: 'enabled',
      pluginId,
      timestamp: Date.now()
    });
  }

  disable(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    plugin.disable();

    this.emitEvent({
      type: 'disabled',
      pluginId,
      timestamp: Date.now()
    });
  }

  // Settings management
  updatePluginSettings(pluginId: string, settings: Record<string, any>): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    plugin.updateSettings(settings);
  }

  // Event handling
  subscribeToEvents(callback: PluginEventCallback): () => void {
    this.eventCallbacks.add(callback);
    return () => {
      this.eventCallbacks.delete(callback);
    };
  }

  private emitEvent(event: PluginEvent): void {
    this.eventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        ChartDebug.error('Error in event callback:', error);
      }
    });
  }

  // Lifecycle
  async destroy(): Promise<void> {
    // Destroy plugins in reverse initialization order
    const reverseOrder = [...this.initializationOrder].reverse();
    
    for (const pluginId of reverseOrder) {
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        try {
          await plugin.destroy();
        } catch (error) {
          ChartDebug.error(`Error destroying plugin ${pluginId}:`, error);
        }
      }
    }

    this.plugins.clear();
    this.initializationOrder = [];
    this.eventCallbacks.clear();
    this.context = null;
  }

  // Utility methods
  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  getPluginCount(): number {
    return this.plugins.size;
  }

  getPluginIds(): string[] {
    return Array.from(this.plugins.keys());
  }

  exportConfig(): Array<{ id: string; settings: Record<string, any> }> {
    return this.getAll().map(plugin => ({
      id: plugin.id,
      settings: plugin.settings
    }));
  }
}