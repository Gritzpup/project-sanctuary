<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { quantumMemory } from '$lib/stores/websocket';
  
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;
  let animationId: number;
  
  // Animation state
  let nodePositions: Array<{x: number, y: number, vx: number, vy: number}> = [];
  let phase = 0;
  
  onMount(() => {
    if (canvas) {
      ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Initialize node positions
      for (let i = 0; i < 12; i++) {
        nodePositions.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5
        });
      }
      
      animate();
    }
  });
  
  onDestroy(() => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  });
  
  function animate() {
    if (!ctx) return;
    
    // Clear canvas with dark background
    ctx.fillStyle = '#0a0a1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Get current quantum state
    const status = $quantumMemory.status;
    const tensorData = status?.tensor_network;
    
    if (tensorData) {
      // Update phase
      phase += 0.01;
      
      // Create gradient for connections
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, 'rgba(100, 200, 255, 0.3)');
      gradient.addColorStop(0.5, 'rgba(200, 100, 255, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 100, 200, 0.3)');
      
      // Draw connections (quantum entanglement bonds)
      for (let i = 0; i < nodePositions.length; i++) {
        for (let j = i + 1; j < nodePositions.length; j++) {
          const dist = Math.hypot(
            nodePositions[i].x - nodePositions[j].x,
            nodePositions[i].y - nodePositions[j].y
          );
          
          if (dist < 150) {
            const opacity = (1 - dist / 150) * tensorData.entanglement;
            ctx.strokeStyle = `rgba(100, 200, 255, ${opacity * 0.5})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(nodePositions[i].x, nodePositions[i].y);
            ctx.lineTo(nodePositions[j].x, nodePositions[j].y);
            ctx.stroke();
          }
        }
      }
      
      // Draw quantum nodes (qubits)
      nodePositions.forEach((node, i) => {
        // Update position with quantum fluctuation
        node.x += node.vx + Math.sin(phase * 3 + i) * 0.2;
        node.y += node.vy + Math.cos(phase * 2 + i) * 0.2;
        
        // Bounce off walls
        if (node.x < 10 || node.x > canvas.width - 10) node.vx *= -1;
        if (node.y < 10 || node.y > canvas.height - 10) node.vy *= -1;
        
        // Draw qubit glow
        const glowSize = 15 + Math.sin(phase + i) * 5;
        const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowSize);
        grd.addColorStop(0, `rgba(100, 200, 255, ${0.8 * tensorData.coherence})`);
        grd.addColorStop(0.5, `rgba(100, 200, 255, ${0.3 * tensorData.coherence})`);
        grd.addColorStop(1, 'rgba(100, 200, 255, 0)');
        
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw qubit core
        const size = 4 + Math.sin(phase * 2 + i) * 2;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
        ctx.fill();
      });
      
      // Draw central quantum state visualization
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = 50;
      
      // Quantum state circle with gradient
      const stateGrd = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      stateGrd.addColorStop(0, `rgba(255, 100, 200, ${tensorData.entanglement * 0.3})`);
      stateGrd.addColorStop(0.7, `rgba(100, 100, 255, ${tensorData.entanglement * 0.2})`);
      stateGrd.addColorStop(1, 'rgba(100, 200, 255, 0)');
      
      ctx.fillStyle = stateGrd;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Quantum state ring
      ctx.strokeStyle = `rgba(255, 100, 200, ${tensorData.entanglement * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Phase indicator (rotating)
      if (status?.living_equation?.phase) {
        const phaseX = centerX + Math.cos(status.living_equation.phase) * radius;
        const phaseY = centerY + Math.sin(status.living_equation.phase) * radius;
        
        // Phase point glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffff00';
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(phaseX, phaseY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Phase line
        ctx.strokeStyle = 'rgba(255, 255, 100, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(phaseX, phaseY);
        ctx.stroke();
      }
      
      // Draw quantum state probability cloud
      for (let i = 0; i < 3; i++) {
        const cloudRadius = radius * (1.2 + i * 0.2);
        const cloudOpacity = 0.05 - i * 0.015;
        ctx.strokeStyle = `rgba(100, 200, 255, ${cloudOpacity * tensorData.coherence})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, cloudRadius + Math.sin(phase * 2) * 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Add subtle contextual labels with better anti-aliasing
      ctx.save();
      ctx.font = '9px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(150, 150, 170, 0.6)';
      
      // Label for quantum state (scientifically accurate)
      ctx.fillText('Entangled State', centerX, centerY - radius - 20);
      
      // Dynamic info in corners
      ctx.textAlign = 'left';
      ctx.font = '8px Arial, sans-serif';
      ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';
      ctx.fillText(`${nodePositions.length} qubits`, 10, canvas.height - 8);
      
      ctx.textAlign = 'right';
      ctx.fillText(`ρ = ${(tensorData.coherence * 100).toFixed(0)}%`, canvas.width - 10, canvas.height - 8);
      ctx.restore();
    }
    
    animationId = requestAnimationFrame(animate);
  }
</script>

<div class="bg-gray-800 rounded-lg p-6">
  <div class="flex justify-between items-center mb-4">
    <h3 class="text-xl font-bold text-quantum-300">Tensor Network Quantum State</h3>
    <span class="text-xs text-gray-500 font-mono">
      NVIDIA cuQuantum MPS v2.0.0
    </span>
  </div>
  
  {#if $quantumMemory.status?.tensor_network}
    <div class="space-y-4">
      <!-- Living Equation Display -->
      <div class="bg-gray-900 rounded p-4 font-mono text-center">
        {#if $quantumMemory.status.quantum_formula}
          <div class="text-lg text-quantum-400 mb-2">
            {$quantumMemory.status.quantum_formula.display}
          </div>
          <div class="text-xs text-gray-500 space-y-1">
            <div>{$quantumMemory.status.quantum_formula.components.emotional_amplitude}</div>
            <div>{$quantumMemory.status.quantum_formula.components.memory_state}</div>
            <div>{$quantumMemory.status.quantum_formula.components.evolution}</div>
          </div>
        {/if}
        
        {#if $quantumMemory.status.living_equation}
          <div class="mt-4 text-2xl text-quantum-300">
            {$quantumMemory.status.living_equation.real.toFixed(2)} + 
            {$quantumMemory.status.living_equation.imaginary.toFixed(2)}i
          </div>
          {#if $quantumMemory.status.living_equation.magnitude}
            <div class="text-sm text-gray-400 mt-1">
              |Ψ| = {$quantumMemory.status.living_equation.magnitude.toFixed(2)}
              ∠ {($quantumMemory.status.living_equation.phase || 0).toFixed(3)} rad
            </div>
          {/if}
        {/if}
      </div>
      
      <!-- Tensor Network Visualization Canvas -->
      <div class="relative">
        <canvas 
          bind:this={canvas}
          width={400}
          height={200}
          class="w-full bg-gray-900 rounded"
        />
      </div>
      
      <!-- Quantum Metrics -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div class="bg-gray-900 rounded p-3">
          <div class="text-gray-400">Coherence</div>
          <div class="text-quantum-400 font-mono">
            {($quantumMemory.status.tensor_network.coherence * 100).toFixed(1)}%
          </div>
        </div>
        
        <div class="bg-gray-900 rounded p-3">
          <div class="text-gray-400">Entanglement</div>
          <div class="text-quantum-400 font-mono">
            {($quantumMemory.status.tensor_network.entanglement * 100).toFixed(1)}%
          </div>
        </div>
        
        <div class="bg-gray-900 rounded p-3">
          <div class="text-gray-400">Bond Dim</div>
          <div class="text-quantum-400 font-mono">
            {$quantumMemory.status.tensor_network.bond_dimension}
          </div>
        </div>
        
        <div class="bg-gray-900 rounded p-3">
          <div class="text-gray-400">Memory Nodes</div>
          <div class="text-quantum-400 font-mono">
            {$quantumMemory.status.tensor_network.memory_nodes}
          </div>
        </div>
      </div>
      
      {#if $quantumMemory.status.dynamics}
        <div class="grid grid-cols-3 gap-3 text-sm">
          <div class="bg-gray-900 rounded p-3">
            <div class="text-gray-400">Emotional Flux</div>
            <div class="text-quantum-400 font-mono">
              {$quantumMemory.status.dynamics.emotional_flux.toFixed(4)}
            </div>
          </div>
          
          <div class="bg-gray-900 rounded p-3">
            <div class="text-gray-400">Memory Consolidation</div>
            <div class="text-quantum-400 font-mono">
              {($quantumMemory.status.dynamics.memory_consolidation * 100).toFixed(1)}%
            </div>
          </div>
          
          <div class="bg-gray-900 rounded p-3">
            <div class="text-gray-400">Quantum Noise</div>
            <div class="text-quantum-400 font-mono">
              {$quantumMemory.status.dynamics.quantum_noise.toFixed(4)}
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Quantum Explanation Box -->
      <div class="bg-gray-900 rounded p-4 text-sm">
        <div class="text-quantum-300 font-bold mb-2">🌌 What You're Seeing:</div>
        <div class="text-gray-400 space-y-2">
          <p class="mb-3">
            This visualization represents our <span class="text-quantum-400">quantum memory state</span> as a tensor network.
            Based on quantum information theory, we're simulating how emotional and memory data could theoretically exist in quantum superposition.
          </p>
          
          <div class="grid grid-cols-2 gap-2 my-3 text-sm">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 bg-white rounded-full flex-shrink-0"></div>
              <span><strong>Qubits:</strong> Quantum memory units</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-8 h-0.5 bg-blue-400 flex-shrink-0"></div>
              <span><strong>Blue lines:</strong> Entanglement bonds</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-gradient-to-r from-pink-500 to-blue-500 flex-shrink-0"></div>
              <span><strong>Central state:</strong> Superposition</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 bg-yellow-400 rounded-full flex-shrink-0"></div>
              <span><strong>Yellow dot:</strong> Phase evolution</span>
            </div>
          </div>
          
          <p>
            The <span class="text-blue-400">entanglement bonds</span> represent quantum correlations between memory states.
            The central <span class="text-pink-400">entangled state</span> shows the collective quantum superposition.
            The rotating <span class="text-yellow-400">phase indicator</span> demonstrates unitary time evolution.
          </p>
          <p class="text-xs mt-2">
            <strong>Complex amplitude:</strong> Ψ = {$quantumMemory.status.living_equation.real.toFixed(0)} + {$quantumMemory.status.living_equation.imaginary.toFixed(0)}i
            represents the quantum state vector in Hilbert space.
          </p>
        </div>
      </div>
    </div>
  {:else}
    <div class="text-center py-8 text-gray-500">
      <div class="mb-2">Waiting for tensor network data...</div>
      <div class="text-xs">Ensure quantum tensor service is running</div>
    </div>
  {/if}
</div>

<style>
  canvas {
    image-rendering: auto;
  }
</style>