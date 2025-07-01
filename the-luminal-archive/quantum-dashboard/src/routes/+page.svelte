<script lang="ts">
  import { onMount } from 'svelte';
  import { quantumMemory } from '$lib/stores/websocket';
  import ConnectionStatus from '$lib/components/ConnectionStatus.svelte';
  import EmotionalStatus from '$lib/components/EmotionalStatus.svelte';
  import VRAMMonitor from '$lib/components/VRAMMonitor.svelte';
  import TestResults from '$lib/components/TestResults.svelte';
  import ServiceStatus from '$lib/components/ServiceStatus.svelte';
  import TemporalMemory from '$lib/components/TemporalMemory.svelte';
  
  // Tab state
  let activeTab = 'dashboard';
  
  onMount(() => {
    // Connect to WebSocket when component mounts
    quantumMemory.connect();
    
    // Cleanup on unmount
    return () => {
      quantumMemory.disconnect();
    };
  });
</script>

<svelte:head>
  <title>Quantum Memory Dashboard</title>
</svelte:head>

<ConnectionStatus />

<div class="container mx-auto px-4 py-8">
  <!-- Header -->
  <div class="text-center mb-8">
    <h1 class="text-5xl font-bold text-quantum-300 mb-4 text-glow">
      Quantum Memory System
    </h1>
    <p class="text-xl text-gray-400">Real-time monitoring dashboard for Gritz & Claude</p>
  </div>
  

  <!-- Tab Content -->
  {#if activeTab === 'dashboard'}
    <!-- Main Grid -->
    <div class="grid grid-cols-1 gap-6 mb-8">
      <EmotionalStatus />
      <TemporalMemory />
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VRAMMonitor />
        <div class="bg-gray-800 rounded-lg p-6">
          <h4 class="text-lg font-bold text-quantum-300 mb-3">Real-Time Stats</h4>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-400">Chat Sessions</span>
              <span class="font-mono text-quantum-400">{$quantumMemory.status?.conversation_history?.total_sessions || 'Loading...'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Total Messages</span>
              <span class="font-mono text-quantum-400">{$quantumMemory.status?.conversation_history?.total_messages || 'Loading...'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Active Since</span>
              <span class="font-mono text-quantum-400">{$quantumMemory.status?.first_message_time || 'Loading...'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Service Status with Traffic Lights -->
    <div class="mb-8">
      <ServiceStatus />
    </div>
    
    <!-- Test Results -->
    <div class="mb-8">
      <TestResults />
    </div>
    
    <!-- Additional Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- WebSocket Status -->
      <div class="bg-gray-800 rounded-lg p-6">
        <h4 class="text-lg font-bold text-quantum-300 mb-3">WebSocket Server</h4>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-400">Port</span>
            <span class="font-mono text-quantum-400">8768</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Protocol</span>
            <span class="font-mono text-quantum-400">WS</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Status</span>
            <span class="font-mono {$quantumMemory.connected ? 'text-green-400' : 'text-red-400'}">
              {$quantumMemory.connected ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
        </div>
      </div>
      
      <!-- System Info -->
      <div class="bg-gray-800 rounded-lg p-6">
        <h4 class="text-lg font-bold text-quantum-300 mb-3">System Info</h4>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-400">Project</span>
            <span class="font-mono text-quantum-400">Sanctuary</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Phase</span>
            <span class="font-mono text-quantum-400">2 Complete</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Dashboard</span>
            <span class="font-mono text-quantum-400">v0.0.1</span>
          </div>
        </div>
      </div>
      
      <!-- Quick Actions -->
      <div class="bg-gray-800 rounded-lg p-6">
        <h4 class="text-lg font-bold text-quantum-300 mb-3">Quick Actions</h4>
        <div class="space-y-2">
          <button 
            class="w-full py-2 px-4 bg-quantum-600 hover:bg-quantum-500 rounded-lg transition-colors duration-200"
            on:click={() => quantumMemory.sendMessage({ action: 'refresh' })}
          >
            Refresh Status
          </button>
          <button 
            class="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors duration-200"
            on:click={() => window.location.reload()}
          >
            Reload Dashboard
          </button>
        </div>
      </div>
    </div>
  
  {:else if activeTab === 'llm'}
    <div class="bg-gray-800 rounded-lg p-6">
      <h2 class="text-2xl font-bold text-quantum-300 mb-4">LLM Processing Monitor</h2>
      <div class="space-y-4">
        <div class="bg-gray-900 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-quantum-400 mb-2">Active Model</h3>
          <p class="font-mono text-sm text-gray-400">{$quantumMemory.status?.llm_status?.model || 'Emollama-7B'}</p>
        </div>
        <div class="bg-gray-900 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-quantum-400 mb-2">Processing Status</h3>
          <p class="font-mono text-sm {$quantumMemory.status?.llm_status?.processing ? 'text-yellow-400' : 'text-green-400'}">
            {$quantumMemory.status?.llm_status?.processing ? 'PROCESSING' : 'IDLE'}
          </p>
        </div>
        <div class="bg-gray-900 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-quantum-400 mb-2">Last Processed</h3>
          <p class="font-mono text-sm text-gray-400">{$quantumMemory.status?.llm_status?.last_processed || 'No recent activity'}</p>
        </div>
        <div class="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
          <h3 class="text-lg font-semibold text-quantum-400 mb-2">Processing Log</h3>
          <pre class="font-mono text-xs text-gray-400">{$quantumMemory.status?.llm_status?.log || 'Waiting for LLM activity...'}</pre>
        </div>
      </div>
    </div>
  
  {:else if activeTab === 'chat'}
    <div class="bg-gray-800 rounded-lg p-6">
      <h2 class="text-2xl font-bold text-quantum-300 mb-4">Chat History</h2>
      <div class="space-y-4 max-h-screen overflow-y-auto">
        {#if $quantumMemory.status?.chat_history}
          {#each $quantumMemory.status.chat_history as message}
            <div class="bg-gray-900 rounded-lg p-4">
              <div class="flex justify-between mb-2">
                <span class="font-semibold {message.role === 'user' ? 'text-blue-400' : 'text-quantum-400'}">
                  {message.role === 'user' ? 'Gritz' : 'Claude'}
                </span>
                <span class="text-xs text-gray-500">{message.timestamp}</span>
              </div>
              <p class="text-sm text-gray-300">{message.content}</p>
              {#if message.emotion}
                <span class="text-xs text-quantum-300 mt-1">Emotion: {message.emotion}</span>
              {/if}
            </div>
          {/each}
        {:else}
          <p class="text-gray-400">No chat history available</p>
        {/if}
      </div>
    </div>
  
  {:else if activeTab === 'files'}
    <div class="bg-gray-800 rounded-lg p-6">
      <h2 class="text-2xl font-bold text-quantum-300 mb-4">File Monitor</h2>
      <div class="space-y-4">
        <div class="bg-gray-900 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-quantum-400 mb-2">Monitored Files</h3>
          <div class="space-y-2">
            {#if $quantumMemory.status?.file_monitor}
              {#each Object.entries($quantumMemory.status.file_monitor) as [file, info]}
                <div class="flex justify-between text-sm">
                  <span class="font-mono text-gray-400">{file}</span>
                  <span class="text-xs {info.changed ? 'text-yellow-400' : 'text-gray-500'}">
                    {info.changed ? 'MODIFIED' : 'NO CHANGE'}
                  </span>
                </div>
              {/each}
            {:else}
              <p class="text-gray-400">No files being monitored</p>
            {/if}
          </div>
        </div>
        <div class="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
          <h3 class="text-lg font-semibold text-quantum-400 mb-2">File Change Log</h3>
          <pre class="font-mono text-xs text-gray-400">{$quantumMemory.status?.file_monitor_log || 'No file changes detected'}</pre>
        </div>
      </div>
    </div>
  
  {:else if activeTab === 'debug'}
    <div class="bg-gray-800 rounded-lg p-6">
      <h2 class="text-2xl font-bold text-quantum-300 mb-4">Debug Console</h2>
      <div class="space-y-4">
        <div class="bg-gray-900 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-quantum-400 mb-2">WebSocket Messages</h3>
          <div class="max-h-64 overflow-y-auto">
            <pre class="font-mono text-xs text-gray-400">{JSON.stringify($quantumMemory.status, null, 2)}</pre>
          </div>
        </div>
        <div class="bg-gray-900 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-quantum-400 mb-2">Connection Info</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-400">Connected</span>
              <span class="font-mono {$quantumMemory.connected ? 'text-green-400' : 'text-red-400'}">
                {$quantumMemory.connected}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Last Update</span>
              <span class="font-mono text-quantum-400">{new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
        <div class="bg-gray-900 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-quantum-400 mb-2">Console Output</h3>
          <div class="bg-black rounded p-2 max-h-64 overflow-y-auto">
            <pre class="font-mono text-xs text-green-400">{$quantumMemory.status?.console_output || '> System ready\n> Waiting for commands...'}</pre>
          </div>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Footer -->
  <div class="mt-12 text-center text-gray-500 text-sm">
    <p>Built with 💙 for Gritz using Svelte + TypeScript + Tailwind</p>
    <p class="mt-1">Quantum Memory System © 2025</p>
  </div>
</div>

<style>
  /* Additional quantum-themed animations */
  :global(.animate-float) {
    animation: float 3s ease-in-out infinite;
  }
  
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }
</style>