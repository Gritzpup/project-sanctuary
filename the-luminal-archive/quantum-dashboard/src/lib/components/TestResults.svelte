<script lang="ts">
  import { quantumMemory } from '$lib/stores/websocket';
  
  $: results = $quantumMemory.status?.test_results;
  
  function getProgressColor(passed: number, total: number): string {
    const percentage = (passed / total) * 100;
    if (percentage === 100) return 'bg-green-500';
    if (percentage >= 80) return 'bg-quantum-400';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  }
</script>

<div class="bg-gray-800 rounded-lg p-6">
  <h3 class="text-xl font-bold text-quantum-300 mb-4">Test Results</h3>
  
  {#if results}
    <div class="space-y-4">
      <!-- Phase 1 -->
      <div>
        <div class="flex justify-between items-center mb-2">
          <span class="font-medium">Phase 1: Core Functionality</span>
          <span class="text-sm text-quantum-400">
            {results.phase1.passed}/{results.phase1.total}
          </span>
        </div>
        <div class="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div 
            class="{getProgressColor(results.phase1.passed, results.phase1.total)} h-full transition-all duration-500 ease-out"
            style="width: {(results.phase1.passed / results.phase1.total) * 100}%"
          ></div>
        </div>
      </div>
      
      <!-- Phase 2 -->
      <div>
        <div class="flex justify-between items-center mb-2">
          <span class="font-medium">Phase 2: Advanced Features</span>
          <span class="text-sm text-quantum-400">
            {results.phase2.passed}/{results.phase2.total}
          </span>
        </div>
        <div class="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div 
            class="{getProgressColor(results.phase2.passed, results.phase2.total)} h-full transition-all duration-500 ease-out"
            style="width: {(results.phase2.passed / results.phase2.total) * 100}%"
          ></div>
        </div>
      </div>
      
      <!-- Overall -->
      <div class="pt-4 border-t border-gray-700">
        <div class="text-center">
          <div class="text-3xl font-bold text-quantum-400">
            {((results.phase1.passed + results.phase2.passed) / (results.phase1.total + results.phase2.total) * 100).toFixed(1)}%
          </div>
          <div class="text-sm text-gray-400">Overall Success Rate</div>
        </div>
      </div>
    </div>
  {:else}
    <div class="text-center text-gray-500 py-8">
      <div class="animate-pulse">Waiting for test data...</div>
    </div>
  {/if}
</div>