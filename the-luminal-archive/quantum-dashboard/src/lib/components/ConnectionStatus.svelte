<script lang="ts">
  import { quantumMemory } from '$lib/stores/websocket';
  
  $: connected = $quantumMemory.connected;
  $: error = $quantumMemory.error;
</script>

<div class="fixed top-4 right-4 z-50">
  <div class="bg-gray-800 rounded-lg px-4 py-2 flex items-center space-x-3 shadow-lg {connected ? 'glow-quantum' : ''}">
    <div class="relative">
      <div class="w-3 h-3 rounded-full {connected ? 'bg-green-500' : 'bg-red-500'}"></div>
      {#if connected}
        <div class="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping"></div>
      {/if}
    </div>
    
    <span class="text-sm font-medium">
      {#if connected}
        Connected to Quantum Memory
      {:else if error}
        {error}
      {:else}
        Connecting...
      {/if}
    </span>
  </div>
</div>