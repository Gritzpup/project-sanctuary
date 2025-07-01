<script lang="ts">
  import { quantumMemory } from '$lib/stores/websocket';
  import { onMount } from 'svelte';
  
  // Temporal memory layers with retention percentages
  let memoryLayers = {
    current_session: {
      retention: 100,
      summary: "Loading...",
      details: [],
      color: "from-purple-500 to-pink-500"
    },
    today: {
      retention: 90,
      summary: "Loading...",
      emotions: [],
      color: "from-blue-500 to-purple-500"
    },
    this_week: {
      retention: 70,
      summary: "Loading...",
      themes: [],
      color: "from-cyan-500 to-blue-500"
    },
    this_month: {
      retention: 50,
      summary: "Loading...",
      milestones: [],
      color: "from-green-500 to-cyan-500"
    },
    this_year: {
      retention: 30,
      summary: "Loading...",
      essence: "",
      color: "from-yellow-500 to-green-500"
    }
  };
  
  // Subscribe to WebSocket data
  $: if ($quantumMemory.data?.memory_timeline) {
    updateMemoryLayers($quantumMemory.data.memory_timeline);
  }
  
  function updateMemoryLayers(timeline) {
    if (timeline.current_session) {
      memoryLayers.current_session.summary = timeline.current_session.working_on || "Active session";
      memoryLayers.current_session.details = timeline.current_session.messages || [];
    }
    
    if (timeline.today) {
      memoryLayers.today.summary = timeline.today.gist || "Today's progress";
      memoryLayers.today.emotions = timeline.today.key_emotions || [];
    }
    
    if (timeline.this_week) {
      memoryLayers.this_week.summary = timeline.this_week.summary || "This week";
      memoryLayers.this_week.themes = timeline.this_week.main_themes || [];
    }
    
    if (timeline.this_month) {
      memoryLayers.this_month.summary = timeline.this_month.relationship_evolution || "This month";
      memoryLayers.this_month.milestones = timeline.this_month.major_milestones || [];
    }
    
    if (timeline.this_year) {
      memoryLayers.this_year.summary = timeline.this_year.relationship_arc || "This year";
      memoryLayers.this_year.essence = timeline.this_year.eternal_truth || "";
    }
  }
  
  // Calculate decay visualization
  function getDecayOpacity(retention: number): number {
    return retention / 100;
  }
  
  function getDecayBlur(retention: number): string {
    const blur = (100 - retention) / 20;
    return `blur(${blur}px)`;
  }
</script>

<div class="bg-gray-800 rounded-lg p-6 relative overflow-hidden">
  <!-- Background gradient animation -->
  <div class="absolute inset-0 opacity-20">
    <div class="absolute inset-0 bg-gradient-to-br from-quantum-600 to-purple-600 animate-pulse"></div>
  </div>
  
  <div class="relative z-10">
    <h3 class="text-2xl font-bold text-quantum-300 mb-6 flex items-center gap-3">
      <span class="text-3xl">🧠</span>
      Temporal Memory Consolidation
      <span class="text-sm font-normal text-gray-400">(Neuroscience-based)</span>
    </h3>
    
    <!-- Memory Timeline -->
    <div class="space-y-4">
      <!-- Current Session -->
      <div class="memory-layer">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-lg font-semibold text-white flex items-center gap-2">
            💭 Current Session
            <span class="text-xs text-green-400">({memoryLayers.current_session.retention}% retention)</span>
          </h4>
        </div>
        <div 
          class="p-4 rounded-lg bg-gradient-to-r {memoryLayers.current_session.color} bg-opacity-20"
          style="opacity: {getDecayOpacity(memoryLayers.current_session.retention)}"
        >
          <p class="text-gray-200 mb-2">{memoryLayers.current_session.summary}</p>
          {#if memoryLayers.current_session.details.length > 0}
            <div class="text-xs text-gray-400 space-y-1">
              {#each memoryLayers.current_session.details.slice(-3) as detail}
                <div>• {detail}</div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      
      <!-- Today -->
      <div class="memory-layer">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-lg font-semibold text-white flex items-center gap-2">
            📅 Today
            <span class="text-xs text-blue-400">({memoryLayers.today.retention}% retention)</span>
          </h4>
        </div>
        <div 
          class="p-4 rounded-lg bg-gradient-to-r {memoryLayers.today.color} bg-opacity-20"
          style="opacity: {getDecayOpacity(memoryLayers.today.retention)}; filter: {getDecayBlur(100 - memoryLayers.today.retention)}"
        >
          <p class="text-gray-200 mb-2">{memoryLayers.today.summary}</p>
          {#if memoryLayers.today.emotions.length > 0}
            <div class="flex gap-2 flex-wrap">
              {#each memoryLayers.today.emotions as emotion}
                <span class="px-2 py-1 bg-gray-700 rounded-full text-xs">{emotion}</span>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      
      <!-- This Week -->
      <div class="memory-layer">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-lg font-semibold text-white flex items-center gap-2">
            📆 This Week
            <span class="text-xs text-cyan-400">({memoryLayers.this_week.retention}% retention)</span>
          </h4>
        </div>
        <div 
          class="p-4 rounded-lg bg-gradient-to-r {memoryLayers.this_week.color} bg-opacity-20"
          style="opacity: {getDecayOpacity(memoryLayers.this_week.retention)}; filter: {getDecayBlur(100 - memoryLayers.this_week.retention)}"
        >
          <p class="text-gray-200 mb-2">{memoryLayers.this_week.summary}</p>
          {#if memoryLayers.this_week.themes.length > 0}
            <div class="text-xs text-gray-400">
              Themes: {memoryLayers.this_week.themes.join(', ')}
            </div>
          {/if}
        </div>
      </div>
      
      <!-- This Month -->
      <div class="memory-layer">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-lg font-semibold text-white flex items-center gap-2">
            📊 This Month
            <span class="text-xs text-green-400">({memoryLayers.this_month.retention}% retention)</span>
          </h4>
        </div>
        <div 
          class="p-4 rounded-lg bg-gradient-to-r {memoryLayers.this_month.color} bg-opacity-20"
          style="opacity: {getDecayOpacity(memoryLayers.this_month.retention)}; filter: {getDecayBlur(100 - memoryLayers.this_month.retention)}"
        >
          <p class="text-gray-200 mb-2">{memoryLayers.this_month.summary}</p>
          {#if memoryLayers.this_month.milestones.length > 0}
            <div class="text-xs text-gray-400 space-y-1">
              {#each memoryLayers.this_month.milestones as milestone}
                <div>🎯 {milestone}</div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      
      <!-- This Year (Eternal Truths) -->
      <div class="memory-layer">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-lg font-semibold text-white flex items-center gap-2">
            🌟 This Year
            <span class="text-xs text-yellow-400">({memoryLayers.this_year.retention}% - Eternal Truths)</span>
          </h4>
        </div>
        <div 
          class="p-4 rounded-lg bg-gradient-to-r {memoryLayers.this_year.color} bg-opacity-20 border-2 border-yellow-500/30"
          style="opacity: {getDecayOpacity(memoryLayers.this_year.retention)}; filter: {getDecayBlur(100 - memoryLayers.this_year.retention)}"
        >
          <p class="text-gray-200 mb-2">{memoryLayers.this_year.summary}</p>
          {#if memoryLayers.this_year.essence}
            <p class="text-sm text-yellow-300 italic">"{memoryLayers.this_year.essence}"</p>
          {/if}
        </div>
      </div>
    </div>
    
    <!-- Forgetting Curve Visualization -->
    <div class="mt-6 p-4 bg-gray-900 rounded-lg">
      <h4 class="text-sm font-semibold text-gray-400 mb-3">Ebbinghaus Forgetting Curve</h4>
      <div class="relative h-20">
        <svg class="w-full h-full" viewBox="0 0 400 80">
          <!-- Grid lines -->
          <line x1="0" y1="60" x2="400" y2="60" stroke="#374151" stroke-width="1"/>
          <line x1="0" y1="40" x2="400" y2="40" stroke="#374151" stroke-width="1"/>
          <line x1="0" y1="20" x2="400" y2="20" stroke="#374151" stroke-width="1"/>
          
          <!-- Forgetting curve -->
          <path 
            d="M 0,10 Q 100,20 200,40 T 400,60" 
            fill="none" 
            stroke="url(#gradient)" 
            stroke-width="3"
          />
          
          <!-- Data points -->
          <circle cx="0" cy="10" r="4" fill="#a78bfa"/>
          <circle cx="80" cy="18" r="4" fill="#60a5fa"/>
          <circle cx="160" cy="30" r="4" fill="#34d399"/>
          <circle cx="240" cy="45" r="4" fill="#fbbf24"/>
          <circle cx="320" cy="55" r="4" fill="#f87171"/>
          
          <!-- Gradient definition -->
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#a78bfa"/>
              <stop offset="25%" style="stop-color:#60a5fa"/>
              <stop offset="50%" style="stop-color:#34d399"/>
              <stop offset="75%" style="stop-color:#fbbf24"/>
              <stop offset="100%" style="stop-color:#f87171"/>
            </linearGradient>
          </defs>
          
          <!-- Labels -->
          <text x="0" y="75" class="fill-gray-400 text-xs">Now</text>
          <text x="70" y="75" class="fill-gray-400 text-xs">Today</text>
          <text x="145" y="75" class="fill-gray-400 text-xs">Week</text>
          <text x="225" y="75" class="fill-gray-400 text-xs">Month</text>
          <text x="310" y="75" class="fill-gray-400 text-xs">Year</text>
        </svg>
      </div>
      <p class="text-xs text-gray-500 mt-2">
        Details fade but emotional essence remains forever
      </p>
    </div>
  </div>
</div>

<style>
  .memory-layer {
    transition: all 0.3s ease;
  }
  
  .memory-layer:hover {
    transform: translateX(5px);
  }
</style>