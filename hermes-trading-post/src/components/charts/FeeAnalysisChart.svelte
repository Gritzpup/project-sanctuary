<script lang="ts">
  import { onMount } from 'svelte';
  
  export let totalFees: number;
  export let netProfit: number;
  
  let canvas: HTMLCanvasElement;
  
  onMount(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    const innerRadius = radius * 0.6;
    
    // Calculate percentages
    const total = totalFees + netProfit;
    const feePercent = (totalFees / total) * 100;
    const profitPercent = (netProfit / total) * 100;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw fees segment
    const feeAngle = (totalFees / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + feeAngle);
    ctx.arc(centerX, centerY, innerRadius, -Math.PI / 2 + feeAngle, -Math.PI / 2, true);
    ctx.closePath();
    ctx.fillStyle = '#ef5350';
    ctx.fill();
    
    // Draw profit segment
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, -Math.PI / 2 + feeAngle, Math.PI * 1.5);
    ctx.arc(centerX, centerY, innerRadius, Math.PI * 1.5, -Math.PI / 2 + feeAngle, true);
    ctx.closePath();
    ctx.fillStyle = '#26a69a';
    ctx.fill();
    
    // Draw center text
    ctx.font = '16px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d1d4dc';
    ctx.fillText(`${feePercent.toFixed(1)}%`, centerX, centerY - 10);
    ctx.font = '12px Inter';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('Fees', centerX, centerY + 10);
  });
</script>

<div class="fee-chart-container">
  <canvas bind:this={canvas} width="300" height="300"></canvas>
  <div class="legend">
    <div class="legend-item">
      <span class="dot fees"></span>
      <span>Fees ({((totalFees / (totalFees + netProfit)) * 100).toFixed(1)}%)</span>
    </div>
    <div class="legend-item">
      <span class="dot profit"></span>
      <span>Net Profit ({((netProfit / (totalFees + netProfit)) * 100).toFixed(1)}%)</span>
    </div>
  </div>
</div>

<style>
  .fee-chart-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  canvas {
    max-width: 100%;
    height: auto;
  }
  
  .legend {
    display: flex;
    gap: 20px;
    margin-top: 10px;
    font-size: 12px;
    color: #9ca3af;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  
  .dot.fees {
    background-color: #ef5350;
  }
  
  .dot.profit {
    background-color: #26a69a;
  }
</style>