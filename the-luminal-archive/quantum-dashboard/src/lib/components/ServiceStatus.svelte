<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { quantumMemory } from '$lib/stores/websocket';
  
  interface ServiceInfo {
    name: string;
    displayName: string;
    status: 'running' | 'stopped' | 'starting' | 'error';
    port: number;
    pid?: number;
  }
  
  let services: ServiceInfo[] = [
    {
      name: 'quantum-websocket',
      displayName: 'WebSocket Server',
      status: 'stopped',
      port: 8768
    },
    {
      name: 'quantum-dashboard',
      displayName: 'Dashboard',
      status: 'stopped',
      port: 5174
    }
  ];
  
  let checkInterval: ReturnType<typeof setInterval>;
  
  async function checkServiceStatus() {
    try {
      // Check WebSocket status from the store
      const connected = $quantumMemory.connected;
      services[0].status = connected ? 'running' : 'stopped';
      
      // Dashboard is always running if user can see this
      services[1].status = 'running';
    } catch (error) {
      console.error('Error checking service status:', error);
    }
  }
  
  async function restartService(serviceName: string) {
    const service = services.find(s => s.name === serviceName);
    if (!service) return;
    
    // Set to starting state
    service.status = 'starting';
    services = services;
    
    try {
      // Send restart command via control API on port 8769
      const response = await fetch(`http://localhost:8769/restart/${serviceName}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to restart service');
      }
      
      // Wait a bit then check status
      setTimeout(() => {
        checkServiceStatus();
      }, 3000);
    } catch (error) {
      console.error('Error restarting service:', error);
      service.status = 'error';
      services = services;
    }
  }
  
  function getStatusColor(status: string): string {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'stopped': return 'bg-red-500';
      case 'starting': return 'bg-yellow-500';
      case 'error': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  }
  
  function getStatusIcon(status: string): string {
    switch (status) {
      case 'running': return '🟢';
      case 'stopped': return '🔴';
      case 'starting': return '🟡';
      case 'error': return '🟠';
      default: return '⚪';
    }
  }
  
  onMount(() => {
    checkServiceStatus();
    // Check every 5 seconds
    checkInterval = setInterval(checkServiceStatus, 5000);
  });
  
  onDestroy(() => {
    if (checkInterval) clearInterval(checkInterval);
  });
</script>

<div class="bg-gray-800 rounded-lg p-6 glow-quantum">
  <h3 class="text-xl font-bold text-quantum-300 mb-4">Service Status</h3>
  
  <div class="space-y-4">
    {#each services as service}
      <div class="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
        <div class="flex items-center space-x-4">
          <!-- Traffic Light -->
          <div class="flex items-center space-x-2">
            <div class="w-12 h-12 rounded-full {getStatusColor(service.status)} 
                        flex items-center justify-center text-2xl font-bold
                        {service.status === 'running' ? 'animate-pulse' : ''}
                        {service.status === 'starting' ? 'animate-spin' : ''}">
              {getStatusIcon(service.status)}
            </div>
          </div>
          
          <!-- Service Info -->
          <div>
            <h4 class="font-medium text-lg">{service.displayName}</h4>
            <p class="text-sm text-gray-400">
              Port: {service.port} 
              {#if service.status === 'running'}
                <span class="text-green-400">• Active</span>
              {:else if service.status === 'stopped'}
                <span class="text-red-400">• Inactive</span>
              {:else if service.status === 'starting'}
                <span class="text-yellow-400">• Starting...</span>
              {:else}
                <span class="text-orange-400">• Error</span>
              {/if}
            </p>
          </div>
        </div>
        
        <!-- Restart Button -->
        <button
          class="px-4 py-2 bg-quantum-600 hover:bg-quantum-500 rounded-lg 
                 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                 {service.status === 'starting' ? 'animate-pulse' : ''}"
          on:click={() => restartService(service.name)}
          disabled={service.status === 'starting'}
        >
          {#if service.status === 'starting'}
            Restarting...
          {:else}
            Restart
          {/if}
        </button>
      </div>
    {/each}
  </div>
  
  <div class="mt-6 p-4 bg-gray-700 rounded-lg">
    <h4 class="text-sm font-medium text-gray-300 mb-2">Traffic Light Status Guide:</h4>
    <div class="grid grid-cols-2 gap-2 text-sm">
      <div class="flex items-center space-x-2">
        <span class="text-2xl">🟢</span>
        <span class="text-gray-400">Service is running</span>
      </div>
      <div class="flex items-center space-x-2">
        <span class="text-2xl">🔴</span>
        <span class="text-gray-400">Service is stopped</span>
      </div>
      <div class="flex items-center space-x-2">
        <span class="text-2xl">🟡</span>
        <span class="text-gray-400">Service is starting</span>
      </div>
      <div class="flex items-center space-x-2">
        <span class="text-2xl">🟠</span>
        <span class="text-gray-400">Service error</span>
      </div>
    </div>
  </div>
</div>

<style>
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .animate-spin {
    animation: spin 2s linear infinite;
  }
</style>