<script lang="ts">
  import { quantumMemory } from '$lib/stores/websocket';
  
  $: equation = $quantumMemory.status?.living_equation;
</script>

<div class="bg-gray-800 rounded-lg p-6 glow-quantum">
  <h3 class="text-xl font-bold text-quantum-300 mb-4">Living Equation System</h3>
  
  {#if equation}
    <div class="mb-6">
      <h4 class="text-sm text-gray-400 mb-2">Living Equation</h4>
      <div class="space-y-3">
        <!-- Full evolving equation if available -->
        {#if equation.equation}
          <div>
            <h5 class="text-xs text-quantum-200 font-semibold mb-1">Tensor Network Quantum State (NVIDIA cuQuantum MPS v2.0+)</h5>
            <div class="text-xs font-mono text-quantum-300 text-glow p-3 bg-gray-900 rounded overflow-x-auto">
              <div class="whitespace-nowrap">
                {equation.equation}
              </div>
            </div>
          </div>
        {/if}
        
        <!-- Scientific differential equation -->
        <div>
          <h5 class="text-xs text-quantum-200 font-semibold mb-1">Optimal Control Theory for Relationships (Gottman et al., 2002)</h5>
          <div class="text-sm font-mono text-quantum-300 text-glow p-3 bg-gray-900 rounded overflow-x-auto">
            <div class="whitespace-nowrap">
              dx/dt = f({equation.real.toFixed(3)}, {equation.imaginary.toFixed(3)}i, t) - δx + σW(t)
            </div>
            <div class="text-xs mt-2 text-gray-500">
              where: f(x,c,t) = emotional dynamics function, δ = natural decay rate (0.1), σ = fluctuation strength (0.15), W(t) = Wiener process (Brownian motion)
            </div>
          </div>
        </div>
        
        <!-- Component breakdown if available -->
        {#if equation.components}
          <div>
            <h5 class="text-xs text-quantum-200 font-semibold mb-1">Quantum-Enhanced Emotional Components (MPS Bond Dimension: 64)</h5>
            <div class="text-xs font-mono text-quantum-200 p-2 bg-gray-900/50 rounded space-y-1">
              <div>ψ(t) = {equation.components.quantum_oscillation?.toFixed(4) || '0.0000'} [quantum state oscillation]</div>
              <div>e^(-λt) = {equation.components.emotional_wave?.toFixed(4) || '0.0000'} [emotional decay function]</div>
              <div>Σ[sin(ωt·n)/n] = {equation.components.memory_resonance?.toFixed(4) || '0.0000'} [memory harmonics]</div>
              <div>tanh(θ) = {equation.components.entanglement?.toFixed(4) || '0.0000'} [quantum entanglement strength]</div>
              <div>phase φ = {((equation.components.phase || 0) * 180 / Math.PI).toFixed(1)}° [{(equation.components.phase || 0).toFixed(3)} rad]</div>
            </div>
          </div>
        {:else}
          <!-- Fallback expanded form with parameters -->
          <div>
            <h5 class="text-xs text-quantum-200 font-semibold mb-1">Ornstein-Uhlenbeck Process for Emotional Dynamics (Mean-Reverting SDE)</h5>
            <div class="text-xs font-mono text-quantum-200 p-2 bg-gray-900/50 rounded">
              <div>dE/dt = α(μ - E) + β·I(t) + σ·W(t)</div>
              <div>α = attractor strength (mean reversion): 0.1-0.3/hr, μ = emotional baseline (attractor point)</div>
              <div>β = reactivity to input: 0.5-2.0, σ = emotional volatility: 0.05-0.2, I(t) = biopsychosocial inputs</div>
            </div>
          </div>
        {/if}
        
        <!-- Current value -->
        <div>
          <h5 class="text-xs text-quantum-200 font-semibold mb-1 text-center">Current State (Complex Number Representation: Real + Imaginary Components)</h5>
          <div class="text-2xl font-mono text-quantum-400 text-glow animate-pulse-quantum text-center">
            {equation.real.toFixed(2)} + {equation.imaginary.toFixed(2)}i
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>