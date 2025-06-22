// Environment configuration for Sanctuary
// Loads sensitive tokens and configuration from .env file

interface Environment {
  COPILOT_ACCESS_TOKEN?: string;
  DEBUG?: boolean;
}

class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  private env: Environment = {};

  private constructor() {
    this.loadEnvironment();
  }

  public static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  private loadEnvironment(): void {
    // In Tauri, we'll need to load this through the backend
    // For now, we'll set up the structure
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      // Tauri environment - load through Rust backend
      this.loadFromTauri();
    } else {
      // Development environment - load from import.meta.env
      this.loadFromVite();
    }
  }

  private loadFromVite(): void {
    this.env = {
      COPILOT_ACCESS_TOKEN: import.meta.env.VITE_COPILOT_ACCESS_TOKEN,
      DEBUG: import.meta.env.VITE_DEBUG === 'true'
    };
  }

  private async loadFromTauri(): Promise<void> {
    try {
      // We'll implement this with Tauri commands
      const { invoke } = await import('@tauri-apps/api/core');
      this.env.COPILOT_ACCESS_TOKEN = await invoke('get_env_var', { key: 'AURORA_CHAT_COPILOT_ACCESS_TOKEN' });
    } catch (error) {
      console.warn('Failed to load environment from Tauri:', error);
    }
  }

  public get copilotToken(): string | undefined {
    return this.env.COPILOT_ACCESS_TOKEN;
  }

  public get isDebug(): boolean {
    return this.env.DEBUG ?? false;
  }

  public isTokenAvailable(): boolean {
    return !!this.env.COPILOT_ACCESS_TOKEN;
  }
}

export const Environment = EnvironmentConfig.getInstance();
export default Environment;
