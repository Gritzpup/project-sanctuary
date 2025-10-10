import type { IChartApi } from 'lightweight-charts';
import { ChartDebug } from '../../utils/debug';

export interface PluginConfig {
  id: string;
  name: string;
  description?: string;
  version: string;
  author?: string;
  enabled?: boolean;
  settings?: Record<string, any>;
}

export interface PluginContext {
  chart: IChartApi;
  dataStore: any;
  chartStore: any;
  statusStore: any;
}

export abstract class Plugin {
  protected config: PluginConfig;
  protected context: PluginContext | null = null;
  protected _enabled: boolean = true;
  protected _initialized: boolean = false;

  constructor(config: PluginConfig) {
    this.config = {
      enabled: true,
      ...config
    };
    this._enabled = this.config.enabled || true;
  }

  // Getters
  get id(): string {
    return this.config.id;
  }

  get name(): string {
    return this.config.name;
  }

  get version(): string {
    return this.config.version;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  get settings(): Record<string, any> {
    return this.config.settings || {};
  }

  // Lifecycle methods
  async initialize(context: PluginContext): Promise<void> {
    console.log(`🔌 [Plugin:${this.id}] Starting initialization...`);

    if (this._initialized) {
      ChartDebug.warn(`Plugin ${this.id} already initialized`);
      return;
    }

    this.context = context;
    console.log(`🔌 [Plugin:${this.id}] Context set, chart exists: ${!!context.chart}, dataStore exists: ${!!context.dataStore}`);

    try {
      await this.onInitialize();
      this._initialized = true;
      ChartDebug.log(`Plugin ${this.id} initialized successfully`);
      console.log(`✅ [Plugin:${this.id}] Initialization complete`);
    } catch (error) {
      ChartDebug.error(`Failed to initialize plugin ${this.id}:`, error);
      console.error(`❌ [Plugin:${this.id}] Initialization failed:`, error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (!this._initialized) {
      return;
    }

    try {
      await this.onDestroy();
      this.context = null;
      this._initialized = false;
      ChartDebug.log(`Plugin ${this.id} destroyed`);
    } catch (error) {
      ChartDebug.error(`Error destroying plugin ${this.id}:`, error);
    }
  }

  enable(): void {
    if (this._enabled) return;
    
    this._enabled = true;
    this.onEnable();
  }

  disable(): void {
    if (!this._enabled) return;
    
    this._enabled = false;
    this.onDisable();
  }

  updateSettings(settings: Record<string, any>): void {
    const oldSettings = { ...this.config.settings };
    this.config.settings = { ...this.config.settings, ...settings };
    
    try {
      this.onSettingsUpdate(oldSettings, this.config.settings);
    } catch (error) {
      ChartDebug.error(`Error updating settings for plugin ${this.id}:`, error);
      // Rollback on error
      this.config.settings = oldSettings;
      throw error;
    }
  }

  // Abstract methods to be implemented by subclasses
  protected abstract onInitialize(): Promise<void>;
  protected abstract onDestroy(): Promise<void>;
  protected abstract onEnable(): void;
  protected abstract onDisable(): void;
  protected abstract onSettingsUpdate(oldSettings: Record<string, any>, newSettings: Record<string, any>): void;

  // Helper methods
  protected getChart(): IChartApi {
    if (!this.context?.chart) {
      throw new Error(`Plugin ${this.id} not initialized`);
    }
    return this.context.chart;
  }

  protected getDataStore(): any {
    if (!this.context?.dataStore) {
      throw new Error(`Plugin ${this.id} not initialized`);
    }
    return this.context.dataStore;
  }

  protected getChartStore(): any {
    if (!this.context?.chartStore) {
      throw new Error(`Plugin ${this.id} not initialized`);
    }
    return this.context.chartStore;
  }

  protected getStatusStore(): any {
    if (!this.context?.statusStore) {
      throw new Error(`Plugin ${this.id} not initialized`);
    }
    return this.context.statusStore;
  }
}