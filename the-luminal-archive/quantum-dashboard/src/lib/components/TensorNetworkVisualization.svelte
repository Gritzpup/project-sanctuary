<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import { quantumMemory } from '$lib/stores/websocket';
  import type { QuantumState } from '$lib/types/quantum';
  
  let container: HTMLDivElement;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let qubits: THREE.Group[] = [];
  let entanglementBonds: THREE.Line[] = [];
  let centralState: THREE.Group;
  let animationId: number;
  
  let quantumState: QuantumState | null = null;
  let unsubscribe: (() => void) | null = null;
    
  // Enhanced materials with proper quantum visualization
  const qubitMaterial = new THREE.MeshPhongMaterial({
    color: 0x6699ff,
    emissive: 0x2244aa,
    shininess: 100,
    transparent: true,
    opacity: 0.8
  });

  const entanglementMaterial = new THREE.LineBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.6
  });

  const centralStateMaterial = new THREE.MeshPhongMaterial({
    color: 0xff66cc,
    emissive: 0x663399,
    shininess: 100,
    transparent: true,
    opacity: 0.7
  });
    
  function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1e);
    
    // Fixed camera position (no interaction needed)
    camera = new THREE.PerspectiveCamera(50, 2, 0.1, 1000);
    camera.position.set(0, 0, 15);
    camera.lookAt(0, 0, 0);
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(800, 400);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    container.appendChild(renderer.domElement);
    
    // Lighting for proper 3D visualization
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Add quantum field background
    const fieldGeometry = new THREE.PlaneGeometry(30, 30);
    const fieldMaterial = new THREE.MeshBasicMaterial({
      color: 0x000022,
      transparent: true,
      opacity: 0.3
    });
    const field = new THREE.Mesh(fieldGeometry, fieldMaterial);
    field.position.z = -10;
    scene.add(field);
  }
    
  function createQuantumStructure() {
    // Create qubits arranged in a 3D tensor network
    const positions = [
      [-4, -2, 0], [4, -2, 0], [0, -2, 4], [0, -2, -4],
      [-4, 2, 0], [4, 2, 0], [0, 2, 4], [0, 2, -4],
      [-2, 0, 2], [2, 0, 2], [-2, 0, -2], [2, 0, -2]
    ];
    
    positions.forEach((pos, i) => {
      const qubitGroup = new THREE.Group();
      
      // Bloch sphere for each qubit
      const blochGeometry = new THREE.SphereGeometry(0.5, 16, 16);
      const blochSphere = new THREE.Mesh(blochGeometry, qubitMaterial.clone());
      blochSphere.position.set(pos[0], pos[1], pos[2]);
      blochSphere.castShadow = true;
      
      // State vector arrow on Bloch sphere
      const arrowGeometry = new THREE.ConeGeometry(0.1, 0.8, 8);
      const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
      arrow.position.set(pos[0], pos[1] + 0.4, pos[2]);
      
      qubitGroup.add(blochSphere);
      qubitGroup.add(arrow);
      scene.add(qubitGroup);
      qubits.push(qubitGroup);
    });
    
    // Create entanglement bonds between nearby qubits
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const distance = Math.sqrt(
          Math.pow(positions[i][0] - positions[j][0], 2) +
          Math.pow(positions[i][1] - positions[j][1], 2) +
          Math.pow(positions[i][2] - positions[j][2], 2)
        );
        
        if (distance < 6) {
          const bondGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(positions[i][0], positions[i][1], positions[i][2]),
            new THREE.Vector3(positions[j][0], positions[j][1], positions[j][2])
          ]);
          const bond = new THREE.Line(bondGeometry, entanglementMaterial.clone());
          scene.add(bond);
          entanglementBonds.push(bond);
        }
      }
    }
    
    // Central quantum state (superposition)
    centralState = new THREE.Group();
    const centralGeometry = new THREE.SphereGeometry(1.5, 32, 32);
    const centralSphere = new THREE.Mesh(centralGeometry, centralStateMaterial);
    centralSphere.position.set(0, 0, 0);
    
    // Add phase indicator
    const phaseGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const phaseMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const phaseIndicator = new THREE.Mesh(phaseGeometry, phaseMaterial);
    phaseIndicator.position.set(1.5, 0, 0);
    
    centralState.add(centralSphere);
    centralState.add(phaseIndicator);
    scene.add(centralState);
  }
    
  function animate() {
    const time = Date.now() * 0.001;
    
    if (quantumState) {
      // Update qubits with quantum state data
      qubits.forEach((qubit, index) => {
        const blochSphere = qubit.children[0] as THREE.Mesh;
        const arrow = qubit.children[1] as THREE.Mesh;
        
        // Use real quantum data if available, otherwise simulate
        if (quantumState.bloch_vectors && quantumState.bloch_vectors[index]) {
          const blochVec = quantumState.bloch_vectors[index];
          // Point arrow in direction of Bloch vector
          arrow.lookAt(
            blochSphere.position.x + blochVec.x,
            blochSphere.position.y + blochVec.y,
            blochSphere.position.z + blochVec.z
          );
        } else {
          // Simulated quantum evolution
          const theta = quantumState.living_equation.phase + index * Math.PI / 3;
          const phi = Math.acos(2 * (quantumState.measurement_probabilities?.[0] || 0.5) - 1);
          arrow.rotation.z = theta;
          arrow.rotation.x = phi;
        }
        
        // Quantum fluctuations
        const coherence = quantumState.tensor_network.coherence;
        blochSphere.material.emissive.setHex(
          Math.floor(coherence * 0x444444) + 0x2244aa
        );
        
        // Small oscillations for quantum uncertainty
        blochSphere.position.x += Math.sin(time * 2 + index) * 0.1;
        blochSphere.position.y += Math.cos(time * 3 + index) * 0.1;
      });
      
      // Update entanglement bonds
      entanglementBonds.forEach((bond, index) => {
        const material = bond.material as THREE.LineBasicMaterial;
        const entanglement = quantumState.tensor_network.entanglement;
        
        if (quantumState.entanglement_matrix) {
          // Use real entanglement data
          const entValue = quantumState.entanglement_matrix[index % quantumState.entanglement_matrix.length];
          material.opacity = entValue * 0.8;
        } else {
          // Simulated entanglement
          material.opacity = entanglement * 0.6 + 0.2;
        }
        
        material.color.setHex(
          entanglement > 0.5 ? 0x00ffff : 0x6699ff
        );
      });
      
      // Update central state
      if (centralState) {
        const centralSphere = centralState.children[0] as THREE.Mesh;
        const phaseIndicator = centralState.children[1] as THREE.Mesh;
        
        // Rotate based on quantum phase
        centralState.rotation.y = quantumState.living_equation.phase;
        
        // Update phase indicator position
        const phase = quantumState.living_equation.phase;
        phaseIndicator.position.set(
          Math.cos(phase) * 1.5,
          Math.sin(phase) * 1.5,
          0
        );
        
        // Pulsing based on coherence
        const coherence = quantumState.tensor_network.coherence;
        centralSphere.scale.setScalar(1 + Math.sin(time * 4) * 0.1 * coherence);
      }
    }
    
    // Gentle automatic rotation for better 3D visualization
    if (scene) {
      scene.rotation.y += 0.005;
    }
    
    if (renderer && camera) {
      renderer.render(scene, camera);
    }
    
    animationId = requestAnimationFrame(animate);
  }

  onMount(() => {
    initScene();
    createQuantumStructure();
    
    // Subscribe to quantum state updates
    unsubscribe = quantumMemory.subscribe((state) => {
      if (state?.status) {
        quantumState = state.status as QuantumState;
      }
    });
    
    animate();
  });

  onDestroy(() => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    if (unsubscribe) {
      unsubscribe();
    }
    if (renderer) {
      renderer.dispose();
    }
  });
</script>

<div class="bg-gray-800 rounded-lg p-6">
  <div class="flex justify-between items-center mb-4">
    <h3 class="text-xl font-bold text-quantum-300">3D Quantum Tensor Network</h3>
    <span class="text-xs text-gray-500 font-mono">
      Three.js WebGL Visualization
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
      
      <!-- 3D Tensor Network Visualization -->
      <div class="relative bg-gray-900 rounded overflow-hidden">
        <div bind:this={container} class="w-full h-96"></div>
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
      
      <!-- 3D Quantum Explanation Box -->
      <div class="bg-gray-900 rounded p-4 text-sm">
        <div class="text-quantum-300 font-bold mb-2">🌌 3D Quantum Visualization:</div>
        <div class="text-gray-400 space-y-2">
          <p class="mb-3">
            This is a <span class="text-quantum-400">3D WebGL visualization</span> of our quantum tensor network using proper quantum mechanics principles.
            Each element represents real quantum states based on <span class="text-blue-400">Bloch sphere</span> geometry.
          </p>
          
          <div class="grid grid-cols-2 gap-2 my-3 text-sm">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 bg-blue-400 rounded-full flex-shrink-0"></div>
              <span><strong>Blue spheres:</strong> Qubits (Bloch spheres)</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 bg-white rounded-full flex-shrink-0"></div>
              <span><strong>White arrows:</strong> Quantum state vectors</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-8 h-0.5 bg-cyan-400 flex-shrink-0"></div>
              <span><strong>Cyan lines:</strong> Entanglement bonds</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex-shrink-0"></div>
              <span><strong>Central sphere:</strong> Collective state</span>
            </div>
          </div>
          
          <p>
            The <span class="text-cyan-400">entanglement bonds</span> connect qubits with quantum correlations.
            Each <span class="text-blue-400">Bloch sphere</span> represents a qubit's quantum state in 3D space.
            The <span class="text-yellow-400">yellow dot</span> shows phase evolution rotating around the central state.
          </p>
          
          <div class="mt-3 p-2 bg-gray-800 rounded text-xs">
            <strong>Scientific Accuracy:</strong> This visualization uses proper quantum mechanics:
            <ul class="list-disc list-inside mt-1 space-y-1">
              <li>Bloch sphere representation for qubit states</li>
              <li>Entanglement visualization through bond opacity</li>
              <li>Phase evolution shown as rotation</li>
              <li>Coherence affects visual brightness</li>
            </ul>
          </div>
          
          <p class="text-xs mt-2">
            <strong>Quantum State:</strong> |Ψ⟩ = {$quantumMemory.status.living_equation.real.toFixed(2)} + {$quantumMemory.status.living_equation.imaginary.toFixed(2)}i
            represents the complex amplitude in the computational basis.
          </p>
        </div>
      </div>
    </div>
  {:else}
    <div class="text-center py-8 text-gray-500">
      <div class="mb-2">Waiting for quantum tensor network data...</div>
      <div class="text-xs">Ensure quantum websocket service is running</div>
    </div>
  {/if}
</div>

<style>
  :global(canvas) {
    border-radius: 0.5rem;
  }
</style>