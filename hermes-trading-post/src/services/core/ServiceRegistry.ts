export interface ServiceDefinition {
  name: string;
  factory: (...dependencies: any[]) => any;
  dependencies: string[];
  singleton: boolean;
}

export interface ServiceInstance {
  instance: any;
  created: number;
  dependencies: string[];
}

export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services: Map<string, ServiceDefinition> = new Map();
  private instances: Map<string, ServiceInstance> = new Map();
  private creating: Set<string> = new Set(); // Prevent circular dependencies
  
  private constructor() {}
  
  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  public register<T>(
    name: string,
    factory: (...dependencies: any[]) => T,
    dependencies: string[] = [],
    singleton: boolean = true
  ): void {
    if (this.services.has(name)) {
    }

    this.services.set(name, {
      name,
      factory,
      dependencies,
      singleton
    });

  }

  public get<T>(name: string): T {
    // Check for circular dependency
    if (this.creating.has(name)) {
      throw new Error(`Circular dependency detected when creating service '${name}'`);
    }

    // Return existing singleton instance
    const existingInstance = this.instances.get(name);
    if (existingInstance) {
      return existingInstance.instance;
    }

    // Get service definition
    const serviceDef = this.services.get(name);
    if (!serviceDef) {
      throw new Error(`Service '${name}' is not registered`);
    }

    // Mark as creating to detect circular deps
    this.creating.add(name);

    try {
      // Resolve dependencies
      const resolvedDeps = serviceDef.dependencies.map(depName => this.get(depName));

      // Create instance
      const instance = serviceDef.factory(...resolvedDeps);

      // Store if singleton
      if (serviceDef.singleton) {
        this.instances.set(name, {
          instance,
          created: Date.now(),
          dependencies: serviceDef.dependencies
        });
      }

      return instance;

    } finally {
      // Always remove from creating set
      this.creating.delete(name);
    }
  }

  public has(name: string): boolean {
    return this.services.has(name);
  }

  public isInstantiated(name: string): boolean {
    return this.instances.has(name);
  }

  public getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  public getInstanceNames(): string[] {
    return Array.from(this.instances.keys());
  }

  public getDependencyGraph(): Record<string, string[]> {
    const graph: Record<string, string[]> = {};
    this.services.forEach((def, name) => {
      graph[name] = def.dependencies;
    });
    return graph;
  }

  public dispose(name: string): void {
    const instance = this.instances.get(name);
    if (instance) {
      // Call cleanup method if it exists
      if (instance.instance && typeof instance.instance.dispose === 'function') {
        try {
          instance.instance.dispose();
        } catch (error) {
        }
      }

      this.instances.delete(name);
    }
  }

  public disposeAll(): void {
    
    // Dispose in reverse dependency order to avoid issues
    const sortedNames = this.topologicalSort();
    
    for (let i = sortedNames.length - 1; i >= 0; i--) {
      this.dispose(sortedNames[i]);
    }

    this.instances.clear();
  }

  public reset(): void {
    this.disposeAll();
    this.services.clear();
    this.creating.clear();
  }

  private topologicalSort(): string[] {
    const visited = new Set<string>();
    const temp = new Set<string>();
    const result: string[] = [];

    const visit = (name: string) => {
      if (temp.has(name)) {
        throw new Error(`Circular dependency detected involving service '${name}'`);
      }
      
      if (visited.has(name)) {
        return;
      }

      temp.add(name);

      const serviceDef = this.services.get(name);
      if (serviceDef) {
        serviceDef.dependencies.forEach(dep => visit(dep));
      }

      temp.delete(name);
      visited.add(name);
      result.push(name);
    };

    this.services.forEach((_, name) => {
      if (!visited.has(name)) {
        visit(name);
      }
    });

    return result;
  }

  public validateDependencies(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for missing dependencies
    this.services.forEach((def, name) => {
      def.dependencies.forEach(dep => {
        if (!this.services.has(dep)) {
          errors.push(`Service '${name}' depends on unregistered service '${dep}'`);
        }
      });
    });

    // Check for circular dependencies
    try {
      this.topologicalSort();
    } catch (error) {
      errors.push(error.message);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public getStats(): {
    registeredServices: number;
    instantiatedServices: number;
    memoryUsage: string;
  } {
    return {
      registeredServices: this.services.size,
      instantiatedServices: this.instances.size,
      memoryUsage: `${this.instances.size}/${this.services.size} instances`
    };
  }

  // Helper method to register common service patterns
  public registerSingleton<T>(
    name: string,
    factory: (...dependencies: any[]) => T,
    dependencies: string[] = []
  ): void {
    this.register(name, factory, dependencies, true);
  }

  public registerTransient<T>(
    name: string,
    factory: (...dependencies: any[]) => T,
    dependencies: string[] = []
  ): void {
    this.register(name, factory, dependencies, false);
  }

  // Factory method registration
  public registerFactory<T>(
    name: string,
    factoryName: string,
    createMethod: string = 'create',
    dependencies: string[] = []
  ): void {
    this.register(
      name,
      (...deps: any[]) => {
        const factory = this.get(factoryName);
        return factory[createMethod](...deps);
      },
      [factoryName, ...dependencies],
      false
    );
  }
}