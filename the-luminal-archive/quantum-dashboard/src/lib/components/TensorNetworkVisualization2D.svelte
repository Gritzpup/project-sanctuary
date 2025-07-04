<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { quantumMemory } from '$lib/stores/websocket';
  
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;
  let animationId: number;
  let resizeObserver: ResizeObserver;
  
  // Animation state
  let nodePositions: Array<{x: number, y: number, vx: number, vy: number}> = [];
  let phase = 0;
  
  function setupCanvas() {
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Set actual canvas size accounting for device pixel ratio
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    // Get context and scale for high DPI
    ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Initialize or update node positions based on visible size
      if (nodePositions.length === 0) {
        for (let i = 0; i < 12; i++) {
          nodePositions.push({
            x: Math.random() * rect.width,
            y: Math.random() * rect.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5
          });
        }
      } else {
        // Scale existing positions if canvas was resized
        nodePositions.forEach(node => {
          node.x = Math.min(Math.max(node.x, 10), rect.width - 10);
          node.y = Math.min(Math.max(node.y, 10), rect.height - 10);
        });
      }
    }
  }
  
  onMount(() => {
    setupCanvas();
    
    // Watch for canvas resize
    resizeObserver = new ResizeObserver(() => {
      setupCanvas();
    });
    resizeObserver.observe(canvas);
    
    animate();
  });
  
  onDestroy(() => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });
  
  function animate() {
    if (!ctx || !canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Clear canvas with dark background
    ctx.fillStyle = '#0a0a1e';
    ctx.fillRect(0, 0, width, height);
    
    // Get current quantum state
    const status = $quantumMemory.status;
    const tensorData = status?.tensor_network;
    
    if (tensorData) {
      // Update phase
      phase += 0.01;
      
      // Create gradient for connections
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, 'rgba(100, 200, 255, 0.8)');
      gradient.addColorStop(0.5, 'rgba(200, 100, 255, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 100, 200, 0.8)');
      
      // Draw connections (quantum entanglement bonds)
      for (let i = 0; i < nodePositions.length; i++) {
        for (let j = i + 1; j < nodePositions.length; j++) {
          const dist = Math.hypot(
            nodePositions[i].x - nodePositions[j].x,
            nodePositions[i].y - nodePositions[j].y
          );
          
          if (dist < 200) {
            const opacity = (1 - dist / 200) * tensorData.entanglement;
            
            // Draw glow effect for connections
            ctx.shadowBlur = 15;
            ctx.shadowColor = `rgba(100, 200, 255, ${opacity})`;
            ctx.strokeStyle = `rgba(100, 200, 255, ${Math.min(opacity * 0.8, 0.8)})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(nodePositions[i].x, nodePositions[i].y);
            ctx.lineTo(nodePositions[j].x, nodePositions[j].y);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }
      }
      
      // Draw quantum nodes (qubits)
      nodePositions.forEach((node, i) => {
        // Update position with quantum fluctuation
        node.x += node.vx + Math.sin(phase * 3 + i) * 0.2;
        node.y += node.vy + Math.cos(phase * 2 + i) * 0.2;
        
        // Bounce off walls
        if (node.x < 10 || node.x > width - 10) node.vx *= -1;
        if (node.y < 10 || node.y > height - 10) node.vy *= -1;
        
        // Draw multiple layers of glow for brightness
        const glowSize = 30 + Math.sin(phase + i) * 10;
        
        // Outer glow layer
        const outerGlow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowSize * 1.5);
        outerGlow.addColorStop(0, `rgba(100, 200, 255, ${0.3 * tensorData.coherence})`);
        outerGlow.addColorStop(0.7, `rgba(100, 200, 255, ${0.1 * tensorData.coherence})`);
        outerGlow.addColorStop(1, 'rgba(100, 200, 255, 0)');
        
        ctx.fillStyle = outerGlow;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowSize * 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner bright glow
        const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowSize);
        grd.addColorStop(0, `rgba(150, 220, 255, ${Math.min(1.0, tensorData.coherence * 1.2)})`);
        grd.addColorStop(0.4, `rgba(100, 200, 255, ${Math.min(0.8, tensorData.coherence)})`);
        grd.addColorStop(0.7, `rgba(100, 200, 255, ${0.4 * tensorData.coherence})`);
        grd.addColorStop(1, 'rgba(100, 200, 255, 0)');
        
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw qubit core with shadow
        const size = 6 + Math.sin(phase * 2 + i) * 3;
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(150, 220, 255, 0.8)';
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      
      // Draw central quantum state visualization
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = 90;
      
      // Add shadow for depth
      ctx.shadowBlur = 30;
      ctx.shadowColor = 'rgba(255, 100, 200, 0.5)';
      
      // Quantum state circle with bright gradient
      const stateGrd = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      stateGrd.addColorStop(0, `rgba(255, 150, 220, ${Math.min(0.8, tensorData.entanglement * 0.9)})`);
      stateGrd.addColorStop(0.5, `rgba(200, 100, 255, ${Math.min(0.6, tensorData.entanglement * 0.7)})`);
      stateGrd.addColorStop(0.8, `rgba(100, 150, 255, ${tensorData.entanglement * 0.4})`);
      stateGrd.addColorStop(1, 'rgba(100, 200, 255, 0)');
      
      ctx.fillStyle = stateGrd;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Quantum state ring with glow
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'rgba(255, 100, 200, 0.8)';
      ctx.strokeStyle = `rgba(255, 100, 200, ${Math.min(1.0, tensorData.entanglement * 1.2)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // Phase indicator (rotating)
      if (status?.living_equation?.phase) {
        const phaseX = centerX + Math.cos(status.living_equation.phase) * radius;
        const phaseY = centerY + Math.sin(status.living_equation.phase) * radius;
        
        // Phase point outer glow
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#ffff00';
        const phaseGlow = ctx.createRadialGradient(phaseX, phaseY, 0, phaseX, phaseY, 15);
        phaseGlow.addColorStop(0, 'rgba(255, 255, 100, 0.8)');
        phaseGlow.addColorStop(0.5, 'rgba(255, 255, 0, 0.4)');
        phaseGlow.addColorStop(1, 'rgba(255, 255, 0, 0)');
        ctx.fillStyle = phaseGlow;
        ctx.beginPath();
        ctx.arc(phaseX, phaseY, 15, 0, Math.PI * 2);
        ctx.fill();
        
        // Phase point core
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(phaseX, phaseY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Phase line with glow
        ctx.shadowBlur = 5;
        ctx.shadowColor = 'rgba(255, 255, 100, 0.8)';
        ctx.strokeStyle = 'rgba(255, 255, 100, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(phaseX, phaseY);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      
      // Draw quantum state probability cloud with more visible rings
      for (let i = 0; i < 4; i++) {
        const cloudRadius = radius * (1.3 + i * 0.25);
        const cloudOpacity = 0.15 - i * 0.03;
        ctx.strokeStyle = `rgba(100, 200, 255, ${Math.min(0.5, cloudOpacity * tensorData.coherence * 2)})`;
        ctx.lineWidth = 2 - i * 0.3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, cloudRadius + Math.sin(phase * 2 + i) * 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Add subtle contextual labels with better anti-aliasing
      ctx.save();
      ctx.font = '14px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 3;
      ctx.shadowColor = 'rgba(100, 200, 255, 0.8)';
      ctx.fillStyle = 'rgba(200, 200, 220, 0.9)';
      
      // Label for quantum state (scientifically accurate)
      ctx.fillText('Entangled State', centerX, centerY - radius - 25);
      
      // Dynamic info in corners
      ctx.textAlign = 'left';
      ctx.font = '14px Arial, sans-serif';
      ctx.fillStyle = 'rgba(150, 220, 255, 0.9)';
      ctx.fillText(`${nodePositions.length} qubits`, 15, height - 15);
      
      ctx.textAlign = 'right';
      ctx.fillText(`ρ = ${(tensorData.coherence * 100).toFixed(0)}%`, width - 15, height - 15);
      ctx.shadowBlur = 0;
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
      <div class="relative" style="aspect-ratio: 2/1;">
        <canvas 
          bind:this={canvas}
          class="absolute inset-0 w-full h-full bg-gray-900 rounded"
          style="display: block;"
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
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  
  @supports (image-rendering: high-quality) {
    canvas {
      image-rendering: high-quality;
    }
  }
  
  @supports (image-rendering: smooth) {
    canvas {
      image-rendering: smooth;
    }
  }
</style>