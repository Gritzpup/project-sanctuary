<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { quantumMemory } from '$lib/stores/websocket';
  
  let canvas: HTMLCanvasElement;
  let chart: any;
  let history: { time: Date; usage: number }[] = [];
  const MAX_HISTORY = 50;
  
  $: if ($quantumMemory.status?.gpu_stats) {
    const { vram_usage, vram_total } = $quantumMemory.status.gpu_stats;
    const usagePercent = (vram_usage / vram_total) * 100;
    
    history = [...history, { time: new Date(), usage: usagePercent }].slice(-MAX_HISTORY);
    
    if (chart) {
      chart.data.labels = history.map(h => h.time);
      chart.data.datasets[0].data = history.map(h => h.usage);
      chart.update('none');
    }
  }
  
  onMount(async () => {
    const Chart = (await import('chart.js/auto')).default;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'VRAM Usage %',
          data: [],
          borderColor: '#1a7eff',
          backgroundColor: 'rgba(26, 126, 255, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            display: false
          },
          y: {
            min: 0,
            max: 100,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)',
              callback: (value) => value + '%'
            }
          }
        }
      }
    });
  });
  
  onDestroy(() => {
    if (chart) chart.destroy();
  });
</script>

<div class="bg-gray-800 rounded-lg p-6 glow-quantum">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-xl font-bold text-quantum-300">GPU Memory Monitor</h3>
    {#if $quantumMemory.status?.gpu_stats}
      <div class="text-right">
        <div class="text-2xl font-mono text-quantum-400">
          {(($quantumMemory.status.gpu_stats.vram_usage / $quantumMemory.status.gpu_stats.vram_total) * 100).toFixed(1)}%
        </div>
        <div class="text-sm text-gray-400">
          {($quantumMemory.status.gpu_stats.vram_usage / 1024 / 1024 / 1024).toFixed(2)} GB / 
          {($quantumMemory.status.gpu_stats.vram_total / 1024 / 1024 / 1024).toFixed(2)} GB
        </div>
      </div>
    {/if}
  </div>
  
  <div class="h-48">
    <canvas bind:this={canvas}></canvas>
  </div>
  
  {#if $quantumMemory.status?.gpu_stats?.temperature}
    <div class="mt-4 flex items-center justify-between text-sm">
      <span class="text-gray-400">Temperature</span>
      <span class="font-mono text-quantum-400">{$quantumMemory.status.gpu_stats.temperature}°C</span>
    </div>
  {/if}
</div>