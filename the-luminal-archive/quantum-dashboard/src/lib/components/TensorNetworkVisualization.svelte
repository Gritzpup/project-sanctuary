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
  let entanglementBonds: THREE.Mesh[] = [];
  let centralState: THREE.Group;
  let animationId: number;
  let isInitialized = false;
  let particleSystem: THREE.Points;
  
  let quantumState: QuantumState | null = null;
  let unsubscribe: (() => void) | null = null;
  
  // Reactive statement to update quantum state
  $: if ($quantumMemory?.status && isInitialized && qubits.length > 0) {
    quantumState = $quantumMemory.status as QuantumState;
    updateEntanglementBonds();
    updateQubitColors(); // Update colors immediately when state changes
  }
  
  // Debug info
  let debugInfo = {
    fps: 0,
    lastTime: 0,
    objectCount: 0,
    frameCount: 0
  };
  
  function log(message: string, data?: any) {
    console.log(`[3D Quantum] ${message}`, data || '');
  }
  
  function createParticleField() {
    // Create quantum particle field - reduced for performance
    const particleCount = 300;
    const particles = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Random positions in a sphere
      const radius = 25;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      particles[i3] = radius * Math.sin(phi) * Math.cos(theta);
      particles[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      particles[i3 + 2] = radius * Math.cos(phi);
      
      // Random velocities
      velocities[i3] = (Math.random() - 0.5) * 0.02;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.02;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.02;
      
      // Quantum-inspired colors (blues and purples)
      const hue = 200 + Math.random() * 60;
      const color = new THREE.Color();
      color.setHSL(hue / 360, 0.8, 0.6);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }
    
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.userData.velocities = velocities;
    
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.005,  // Much smaller particles
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });
    
    particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);
    
    log('Created particle field with', particleCount, 'particles');
  }
  
  function createEntanglementBond(q1Index: number, q2Index: number, strength: number, entropy: number) {
    const qubit1 = qubits[q1Index];
    const qubit2 = qubits[q2Index];
    
    if (!qubit1 || !qubit2) return;
    
    // Get qubit positions
    const p1 = qubit1.position.clone();
    const p2 = qubit2.position.clone();
    
    // Create tube geometry for bond - optimized
    const path = new THREE.CatmullRomCurve3([p1, p2]);
    const radius = 0.05 + strength * 0.15; // Thicker for stronger entanglement
    const tubeGeometry = new THREE.TubeGeometry(path, 10, radius, 6, false);
    
    // Clean glowing bonds for entanglement
    const material = new THREE.MeshPhongMaterial({
      color: 0x66bbff,  // Bright blue to match entangled qubits
      emissive: 0x4499ff,
      emissiveIntensity: 0.6 + strength * 0.3,
      transparent: true,
      opacity: 0.3 + strength * 0.3,
      depthWrite: false,  // Better transparency
      side: THREE.DoubleSide
    });
    
    const bond = new THREE.Mesh(tubeGeometry, material);
    bond.userData = { 
      q1: q1Index, 
      q2: q2Index, 
      strength, 
      entropy,
      targetOpacity: 0.3 + strength * 0.3,
      currentOpacity: 0 // Start invisible for fade-in
    };
    
    // Start with 0 opacity for smooth fade-in
    material.opacity = 0;
    
    scene.add(bond);
    entanglementBonds.push(bond);
  }
  
  function updateQubitColors() {
    if (!quantumState || qubits.length === 0) return;
    
    console.log('[3D DEBUG] Updating qubit colors based on quantum state');
    
    // First, check which qubits are connected by bonds
    const entangledQubitIndices = new Set<number>();
    entanglementBonds.forEach(bond => {
      if (bond.userData) {
        entangledQubitIndices.add(bond.userData.q1);
        entangledQubitIndices.add(bond.userData.q2);
      }
    });
    
    console.log('[3D DEBUG] Entangled qubits from bonds:', Array.from(entangledQubitIndices));
    
    qubits.forEach((qubit, index) => {
      const blochSphere = qubit.children[1] as THREE.Mesh;
      if (!blochSphere || !blochSphere.material) return;
      
      const material = blochSphere.material as THREE.MeshPhysicalMaterial;
      let isEntangled = entangledQubitIndices.has(index); // Check bonds first
      let maxStrength = 0.8; // Default strength for bond-based entanglement
      
      // Also check real quantum data if available
      if (quantumState.entanglement_measures?.pairs) {
        quantumState.entanglement_measures.pairs.forEach(pair => {
          if (pair.qubits.includes(index)) {
            isEntangled = true;
            maxStrength = Math.max(maxStrength, pair.strength || 0);
          }
        });
      }
      
      if (isEntangled) {
        const intensity = Math.min(maxStrength * 1.5, 1.0);
        // Enhanced blue for entangled states
        material.color.setHex(0x66bbff);
        material.emissive.setHex(0x4499ff);
        material.emissiveIntensity = 0.4 + intensity * 0.3;
        
        const glowSphere = qubit.children[0] as THREE.Mesh;
        if (glowSphere && glowSphere.material) {
          (glowSphere.material as THREE.MeshBasicMaterial).color.setHex(0x66bbff);
          (glowSphere.material as THREE.MeshBasicMaterial).opacity = 0.3 + intensity * 0.2;
        }
      } else {
        // Standard blue for non-entangled
        material.color.setHex(0x4488ff);
        material.emissive.setHex(0x2266ff);
        material.emissiveIntensity = 0.3;
        
        const glowSphere = qubit.children[0] as THREE.Mesh;
        if (glowSphere && glowSphere.material) {
          (glowSphere.material as THREE.MeshBasicMaterial).color.setHex(0x4488ff);
          (glowSphere.material as THREE.MeshBasicMaterial).opacity = 0.2;
        }
      }
      
      material.needsUpdate = true;
    });
  }
  
  function updateEntanglementBonds() {
    console.log('[3D DEBUG] updateEntanglementBonds called, qubits.length:', qubits.length);
    
    // Clear existing bonds
    entanglementBonds.forEach(bond => {
      scene.remove(bond);
      bond.geometry.dispose();
      if (bond.material instanceof THREE.Material) {
        bond.material.dispose();
      }
    });
    entanglementBonds = [];
    
    // Create bonds based on REAL quantum data
    if (quantumState?.entanglement_measures?.pairs && quantumState.entanglement_measures.pairs.length > 0) {
      console.log('[3D DEBUG] Found real entanglement data:', quantumState.entanglement_measures.pairs);
      quantumState.entanglement_measures.pairs.forEach(pair => {
        const q1 = pair.qubits[0];
        const q2 = pair.qubits[1];
        const strength = pair.strength || 0;
        const entropy = pair.entropy || 0;
        
        // Removed debug logging for performance
        
        // Only show strong entanglement bonds for clarity
        if (strength > 0.5 && q1 < qubits.length && q2 < qubits.length) {
          createEntanglementBond(q1, q2, strength, entropy);
        }
      });
      
      log(`Created ${entanglementBonds.length} entanglement bonds from real data`);
    } else {
      // No real quantum data - bonds will only appear when real entanglement occurs
      log('No quantum entanglement data available - waiting for real quantum states');
    }
  }
  
  // REMOVED - NO FAKE PROXIMITY ENTANGLEMENT
  
  function updateQubitPositions() {
    if (!quantumState || qubits.length === 0) return;
    
    const ATTRACTION_FORCE = 0.3;
    const MIN_DISTANCE = 5;
    const MAX_DISTANCE = 20;
    
    // Reset target positions to original positions
    qubits.forEach(qubit => {
      qubit.userData.targetPosition.copy(qubit.userData.originalPosition);
      qubit.userData.entanglementPartners = [];
    });
    
    // Apply attraction for entangled pairs based on REAL data
    if (quantumState.entanglement_measures?.pairs) {
      quantumState.entanglement_measures.pairs.forEach(pair => {
        if (pair.strength > 0.3 && pair.qubits[0] < qubits.length && pair.qubits[1] < qubits.length) {
          const q1 = qubits[pair.qubits[0]];
          const q2 = qubits[pair.qubits[1]];
          
          if (!q1 || !q2) return;
          
          // Record entanglement partners
          q1.userData.entanglementPartners.push(pair.qubits[1]);
          q2.userData.entanglementPartners.push(pair.qubits[0]);
          
          // Calculate attraction based on strength
          const midpoint = q1.userData.originalPosition.clone()
            .add(q2.userData.originalPosition).multiplyScalar(0.5);
          
          // Move proportionally to entanglement strength
          const moveDistance = pair.strength * ATTRACTION_FORCE * 10;
          
          // Don't move too close - maintain minimum distance
          const currentDistance = q1.position.distanceTo(q2.position);
          if (currentDistance > MIN_DISTANCE) {
            q1.userData.targetPosition.lerp(midpoint, Math.min(moveDistance / 20, 0.4));
            q2.userData.targetPosition.lerp(midpoint, Math.min(moveDistance / 20, 0.4));
          }
        }
      });
    }
    
    // Smooth movement with lerp
    qubits.forEach((qubit, index) => {
      // Interpolate position
      qubit.position.lerp(qubit.userData.targetPosition, 0.05);
      
      // Add gentle floating only for non-entangled qubits
      if (qubit.userData.entanglementPartners.length === 0) {
        const time = Date.now() * 0.001;
        const floatY = Math.sin(time * 0.8 + index * 0.5) * 0.5;
        qubit.position.y += floatY;
      }
    });
  }
    
  function initScene() {
    try {
      log('Initializing scene...');
      
      // Ensure container has dimensions
      const rect = container.getBoundingClientRect();
      const width = rect.width || 800;
      const height = rect.height || 400;
      log('Container dimensions:', { width, height });
      console.log('[3D DEBUG] Container rect:', rect);
      
      // Create scene
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a0a1e);
      console.log('[3D DEBUG] Scene created');
      
      // Camera - positioned to see full 3x3x3 grid
      camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
      camera.position.set(30, 25, 40);
      camera.lookAt(0, 0, 0);
      console.log('[3D DEBUG] Camera created at position:', camera.position);
      
      // Renderer
      try {
        renderer = new THREE.WebGLRenderer({ 
          antialias: true, 
          alpha: false,
          powerPreference: 'high-performance'
        });
        console.log('[3D DEBUG] WebGL renderer created');
      } catch (rendererError) {
        console.error('[3D DEBUG] Failed to create WebGL renderer:', rendererError);
        throw rendererError;
      }
      
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Limit for performance
      renderer.shadowMap.enabled = false; // Disable shadows for performance
      renderer.setSize(width, height);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      renderer.powerPreference = 'high-performance';
      
      // Clear any existing canvas
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      
      // DEBUG: Check if canvas was added
      const canvas = container.querySelector('canvas');
      if (canvas) {
        log('[DEBUG] Canvas element created:', {
          width: canvas.width,
          height: canvas.height,
          style: canvas.style.cssText
        });
        console.log('[3D DEBUG] Canvas successfully attached to container');
        console.log('[3D DEBUG] Canvas display style:', window.getComputedStyle(canvas).display);
        console.log('[3D DEBUG] Canvas visibility:', window.getComputedStyle(canvas).visibility);
      } else {
        console.error('[DEBUG] No canvas element found after appendChild!');
      }
      
      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      scene.add(ambientLight);
      
      const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
      directionalLight1.position.set(10, 10, 10);
      // directionalLight1.castShadow = true; // Disabled for performance
      scene.add(directionalLight1);
      
      const directionalLight2 = new THREE.DirectionalLight(0x8080ff, 0.6);
      directionalLight2.position.set(-10, 5, -10);
      scene.add(directionalLight2);
      
      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
      hemiLight.position.set(0, 20, 0);
      scene.add(hemiLight);
      
      
      // Add particle field for quantum atmosphere
      createParticleField();
      
      isInitialized = true;
      log('Scene initialized successfully');
      
    } catch (error) {
      console.error('[3D Quantum] Failed to initialize scene:', error);
    }
  }
    
  function createQuantumStructure() {
    try {
      log('Creating quantum structure...');
      
      // Create 27 qubits - REAL quantum system configuration
      // PAD Model: Pleasure (0-9), Arousal (10-18), Dominance (19-26)
      const positions = [];
      
      // Generate 27 qubits distributed evenly in 3D space
      const gridSize = 3; // 3x3x3 = 27 positions
      
      for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
          for (let z = 0; z < gridSize; z++) {
            positions.push([
              (x - 1) * 12,  // -12, 0, 12 - even more spacing
              (y - 1) * 12,  // -12, 0, 12
              (z - 1) * 12   // -12, 0, 12
            ]);
          }
        }
      }
      
      // Create each qubit
      positions.forEach((pos, i) => {
        const qubitGroup = new THREE.Group();
        qubitGroup.name = `qubit_${i}`;
        
        // Bloch sphere - sized for 27 qubits
        const blochGeometry = new THREE.SphereGeometry(1.0, 16, 16);
        const material = new THREE.MeshPhysicalMaterial({
          color: 0x4488ff,
          emissive: 0x2266ff,
          emissiveIntensity: 0.5,
          metalness: 0.3,
          roughness: 0.4,
          clearcoat: 1.0,
          clearcoatRoughness: 0.1
        });
        const blochSphere = new THREE.Mesh(blochGeometry, material);
        blochSphere.position.set(0, 0, 0);
        // Shadows disabled for performance
        // blochSphere.castShadow = true;
        // blochSphere.receiveShadow = true;
        
        // Glow effect
        const glowGeometry = new THREE.SphereGeometry(1.2, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: 0x4488ff,
          transparent: true,
          opacity: 0.2,
          side: THREE.BackSide
        });
        const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
        glowSphere.position.set(0, 0, 0);
        
        // Removed arrow for cleaner look and better performance
        
        qubitGroup.add(glowSphere);
        qubitGroup.add(blochSphere);
        
        // Debug: Log qubit structure for first qubit
        if (i === 0) {
          console.log('[3D DEBUG] Qubit 0 structure:', {
            children: qubitGroup.children.length,
            blochSphereName: blochSphere.name,
            blochMaterial: material.type,
            glowMaterial: glowMaterial.type
          });
        }
        
        // Set the group position
        qubitGroup.position.set(pos[0], pos[1], pos[2]);
        qubitGroup.userData.originalPosition = new THREE.Vector3(pos[0], pos[1], pos[2]);
        qubitGroup.userData.targetPosition = new THREE.Vector3(pos[0], pos[1], pos[2]);
        qubitGroup.userData.velocity = new THREE.Vector3(0, 0, 0);
        qubitGroup.userData.entanglementPartners = [];
        
        scene.add(qubitGroup);
        qubits.push(qubitGroup);
      });
      
      // Don't create static bonds - they'll be created based on real data
      
      // Central quantum state
      centralState = new THREE.Group();
      centralState.name = 'centralQuantumState';
      
      const centralGeometry = new THREE.IcosahedronGeometry(3.5, 2);
      const centralMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xff1493,
        emissive: 0xff0066,
        emissiveIntensity: 0.7,
        metalness: 0.5,
        roughness: 0.2,
        clearcoat: 1.0
      });
      const centralSphere = new THREE.Mesh(centralGeometry, centralMaterial);
      centralSphere.position.set(0, 0, 0);
      
      // Central glow
      const centralGlowGeometry = new THREE.IcosahedronGeometry(4.0, 2);
      const centralGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff1493,
        transparent: true,
        opacity: 0.25,
        side: THREE.BackSide
      });
      const centralGlow = new THREE.Mesh(centralGlowGeometry, centralGlowMaterial);
      
      // Phase ring
      const ringGeometry = new THREE.TorusGeometry(4.5, 0.3, 8, 32);
      const ringMaterial = new THREE.MeshPhongMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.7
      });
      const phaseRing = new THREE.Mesh(ringGeometry, ringMaterial);
      phaseRing.rotation.x = Math.PI / 2;
      
      // Phase indicator
      const phaseGeometry = new THREE.SphereGeometry(0.4, 16, 16);
      const phaseMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffff00,
        emissive: 0xffff00
      });
      const phaseIndicator = new THREE.Mesh(phaseGeometry, phaseMaterial);
      phaseIndicator.position.set(4.5, 0, 0);
      
      centralState.add(centralGlow);
      centralState.add(centralSphere);
      centralState.add(phaseRing);
      centralState.add(phaseIndicator);
      scene.add(centralState);
      
      // Count objects
      debugInfo.objectCount = scene.children.length;
      log(`Created ${qubits.length} qubits`);
      log(`Total scene objects: ${debugInfo.objectCount}`);
      
    } catch (error) {
      console.error('[3D Quantum] Failed to create quantum structure:', error);
    }
  }
    
  function animate() {
    if (!isInitialized || !renderer || !camera || !scene) {
      console.log('[DEBUG] Animation loop waiting for initialization...');
      animationId = requestAnimationFrame(animate);
      return;
    }
    
    // Log only first frame
    if (debugInfo.frameCount === 0) {
      console.log('[3D DEBUG] First animation frame - renderer exists:', !!renderer);
      console.log('[3D DEBUG] Scene children count:', scene.children.length);
    }
    
    const time = Date.now() * 0.001;
    
    // Calculate FPS
    if (debugInfo.lastTime > 0) {
      const delta = time - debugInfo.lastTime;
      debugInfo.fps = Math.round(1 / delta);
    }
    debugInfo.lastTime = time;
    debugInfo.frameCount++;
    
    // Subtle scene rotation
    if (scene) {
      scene.rotation.y = time * 0.03; // Even slower rotation for smoothness
    }
    
    // Animate particle field - optimized
    if (particleSystem && debugInfo.frameCount % 2 === 0) { // Update every other frame
      const positions = particleSystem.geometry.attributes.position.array as Float32Array;
      const velocities = particleSystem.geometry.userData.velocities;
      
      for (let i = 0; i < positions.length; i += 3) {
        // Update positions
        positions[i] += velocities[i];
        positions[i + 1] += velocities[i + 1];
        positions[i + 2] += velocities[i + 2];
        
        // Simplified boundary check
        const radiusSq = positions[i] * positions[i] + positions[i + 1] * positions[i + 1] + positions[i + 2] * positions[i + 2];
        if (radiusSq > 900 || radiusSq < 25) { // Use squared values to avoid sqrt
          // Reset particle
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const r = 15 + Math.random() * 10;
          
          positions[i] = r * Math.sin(phi) * Math.cos(theta);
          positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
          positions[i + 2] = r * Math.cos(phi);
        }
      }
      
      particleSystem.geometry.attributes.position.needsUpdate = true;
      particleSystem.rotation.y = time * 0.02;
    }
    
    // Update qubit positions based on entanglement
    updateQubitPositions();
    
    // Animate qubits - pulse and rotation only
    qubits.forEach((qubit, index) => {
      // Gentle pulse - stronger for entangled qubits
      const isEntangled = qubit.userData.entanglementPartners.length > 0;
      const pulseIntensity = isEntangled ? 0.12 : 0.08;
      const pulse = 1 + Math.sin(time * 1.5 + index * 0.3) * pulseIntensity;
      qubit.scale.setScalar(pulse);
      
      // Slow rotation - faster for entangled qubits
      const rotationSpeed = isEntangled ? 0.4 : 0.2;
      qubit.rotation.y = time * rotationSpeed + index * 0.2;
    });
    
    // Animate central state
    if (centralState) {
      centralState.rotation.y = time * 0.5;
      centralState.rotation.z = Math.sin(time * 0.7) * 0.2;
      centralState.rotation.x = Math.cos(time * 0.9) * 0.1;
      
      const centralPulse = 1 + Math.sin(time * 3) * 0.15;
      centralState.scale.setScalar(centralPulse);
      
      // Animate phase indicator
      const phaseIndicator = centralState.children.find(child => 
        child.geometry instanceof THREE.SphereGeometry && 
        (child.material as any).color.getHex() === 0xffff00
      );
      if (phaseIndicator) {
        const orbitRadius = 4.5 + Math.sin(time * 2) * 0.5;
        phaseIndicator.position.x = Math.cos(time * 2) * orbitRadius;
        phaseIndicator.position.z = Math.sin(time * 2) * orbitRadius;
        phaseIndicator.position.y = Math.sin(time * 4) * 0.5;
      }
    }
    
    // Animate entanglement bonds - update positions and fade in/out
    entanglementBonds.forEach(bond => {
      if (bond.userData) {
        const q1 = qubits[bond.userData.q1];
        const q2 = qubits[bond.userData.q2];
        
        if (q1 && q2) {
          // Update bond position to follow moving qubits
          const curve = new THREE.CatmullRomCurve3([q1.position, q2.position]);
          const points = curve.getPoints(10);
          
          // Update geometry
          const tubeGeometry = bond.geometry as THREE.TubeGeometry;
          const newGeometry = new THREE.TubeGeometry(curve, 10, 0.05 + bond.userData.strength * 0.15, 6, false);
          bond.geometry.dispose();
          bond.geometry = newGeometry;
          
          // Smooth opacity animation
          const material = bond.material as THREE.MeshPhongMaterial;
          bond.userData.currentOpacity = THREE.MathUtils.lerp(
            bond.userData.currentOpacity,
            bond.userData.targetOpacity,
            0.1
          );
          material.opacity = bond.userData.currentOpacity;
          
          // Pulse effect based on strength
          const pulseFactor = 1 + Math.sin(time * 3 + bond.userData.q1) * 0.1 * bond.userData.strength;
          material.emissiveIntensity = (0.6 + bond.userData.strength * 0.3) * pulseFactor;
        }
      }
    });
    
    // Update qubits based on quantum data - ONLY EVERY 10 FRAMES FOR PERFORMANCE
    if (quantumState && qubits.length > 0 && debugInfo.frameCount % 10 === 0) {
      const coherence = quantumState.tensor_network?.coherence || 0.9;
      const entanglement = quantumState.tensor_network?.entanglement || 0.8;
      
      // Log entanglement data for debugging
      if (debugInfo.frameCount % 60 === 0 && quantumState.entanglement_measures?.pairs) {
        console.log('[3D DEBUG] Entanglement pairs:', quantumState.entanglement_measures.pairs);
        console.log('[3D DEBUG] Checking qubits 0-26 for entanglement');
        
        // Log which qubits should be entangled
        const entangledIndices = new Set();
        quantumState.entanglement_measures.pairs.forEach(pair => {
          if (pair.qubits[0] < 27) entangledIndices.add(pair.qubits[0]);
          if (pair.qubits[1] < 27) entangledIndices.add(pair.qubits[1]);
        });
        console.log('[3D DEBUG] Qubits that should be colored:', Array.from(entangledIndices));
      }
      
      // Update qubit appearance based on entanglement
      qubits.forEach((qubit, index) => {
        // Find the main sphere (the second child, after glow sphere)
        // We know from creation: first child is glow, second is bloch
        const blochSphere = qubit.children[1] as THREE.Mesh; // Bloch sphere is second child
        
        // Debug for first qubit
        if (index === 0 && debugInfo.frameCount % 60 === 0) {
          console.log('[3D DEBUG] Qubit 0 children:', qubit.children.map(c => ({
            type: c.type,
            isMesh: c instanceof THREE.Mesh,
            hasGeometry: !!(c as any).geometry,
            materialSide: (c as any).material?.side
          })));
        }
        
        if (blochSphere && blochSphere.material) {
          const material = blochSphere.material as THREE.MeshPhysicalMaterial;
          
          // Debug log first qubit
          if (index === 0 && debugInfo.frameCount % 60 === 0) {
            console.log('[3D DEBUG] Qubit 0 blochSphere found:', !!blochSphere);
            console.log('[3D DEBUG] Qubit 0 material type:', material.type);
            console.log('[3D DEBUG] Qubit 0 current color:', material.color.getHex());
          }
          
          // ONLY check real quantum data - NO FAKE PROXIMITY BULLSHIT
          let isEntangled = false;
          let maxStrength = 0;
          let entanglementEntropy = 0;
          
          if (quantumState.entanglement_measures?.pairs) {
            quantumState.entanglement_measures.pairs.forEach(pair => {
              if (pair.qubits.includes(index)) {
                isEntangled = true;
                maxStrength = Math.max(maxStrength, pair.strength || 0);
                entanglementEntropy = Math.max(entanglementEntropy, pair.entropy || 0);
                
                // Debug log entanglement detection
                if (debugInfo.frameCount % 60 === 0) {
                  console.log(`[3D DEBUG] Qubit ${index} is entangled in pair:`, pair);
                }
              }
            });
          }
          
          if (isEntangled) {
            // Dramatic color change for entangled qubits
            const intensity = Math.min(maxStrength * 1.5, 1.0); // Boost intensity
            
            // Enhanced blue for entangled states
            material.color.setHex(0x66bbff); // Brighter blue
            material.emissive.setHex(0x4499ff); // Blue glow
            material.emissiveIntensity = 0.6 + intensity * 0.4;
            material.metalness = 0.2;
            material.roughness = 0.1;
            material.clearcoat = 0.8;
            material.needsUpdate = true; // Force material update
            
            console.log(`[3D DEBUG] Qubit ${index} is entangled with strength ${maxStrength}`);
            
            // Bright glow for entangled qubits
            const glowSphere = qubit.children[0] as THREE.Mesh; // Glow sphere is first child
            if (glowSphere && glowSphere.material) {
              (glowSphere.material as THREE.MeshBasicMaterial).color.setHex(0x66bbff);
              (glowSphere.material as THREE.MeshBasicMaterial).opacity = 0.5 + intensity * 0.3;
            }
          } else {
            // Non-entangled qubits - cool blue
            material.color.setHex(0x4488ff);
            material.emissive.setHex(0x2266ff);
            material.emissiveIntensity = 0.3;
            material.metalness = 0.3;
            material.roughness = 0.4;
            material.clearcoat = 1.0;
            material.needsUpdate = true; // Force material update
            
            // Soft blue glow
            const glowSphere = qubit.children[0] as THREE.Mesh; // Glow sphere is first child
            if (glowSphere && glowSphere.material) {
              (glowSphere.material as THREE.MeshBasicMaterial).color.setHex(0x4488ff);
              (glowSphere.material as THREE.MeshBasicMaterial).opacity = 0.2;
            }
          }
        }
      });
    }
    
    // Render
    try {
      renderer.render(scene, camera);
      
      // Performance: remove debug logging in production
    } catch (error) {
      console.error('[3D Quantum] Render error:', error);
    }
    
    animationId = requestAnimationFrame(animate);
  }
  
  // Handle resize
  function handleResize() {
    if (!container || !camera || !renderer) return;
    
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 400;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  onMount(() => {
    console.log('[3D DEBUG] onMount called');
    
    // Use tick to ensure DOM is ready
    setTimeout(() => {
      console.log('[3D DEBUG] container element after timeout:', container);
      
      if (!container) {
        console.error('[3D Quantum] Container not ready after timeout');
        return;
      }
      
      // Log container dimensions
      const rect = container.getBoundingClientRect();
      console.log('[3D DEBUG] Container dimensions:', {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left
      });
      
      log('Component mounted, initializing...');
      
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', handleResize);
      }
      
      // Initialize scene
      console.log('[3D DEBUG] Starting initialization...');
      initScene();
      console.log('[3D DEBUG] initScene completed, isInitialized:', isInitialized);
      
      if (isInitialized) {
        createQuantumStructure();
        console.log('[3D DEBUG] Quantum structure created');
        
        // Set initial quantum state if available
        if ($quantumMemory?.status) {
          quantumState = $quantumMemory.status as QuantumState;
          updateEntanglementBonds();
          updateQubitColors();
          console.log('[3D DEBUG] Initial quantum state applied');
        } else {
          // Create default quantum state for testing
          quantumState = {
            tensor_network: {
              coherence: 0.9,
              entanglement: 0.8,
              bond_dimension: 128,
              memory_nodes: 42
            }
          } as QuantumState;
          updateEntanglementBonds();
          updateQubitColors();
          console.log('[3D DEBUG] Default quantum state applied');
        }
        
        console.log('[3D DEBUG] Starting animation loop...');
        animate();
      } else {
        console.error('[3D DEBUG] Initialization failed!');
      }
    }, 200); // Increased delay to ensure DOM is ready
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
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize);
    }
    
    // Clean up Three.js resources
    if (scene) {
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
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
      <div class="relative bg-gray-900 rounded overflow-hidden" style="height: 400px;">
        <div bind:this={container} class="w-full h-full" style="min-height: 400px;"></div>
        {#if debugInfo.fps > 0}
          <div class="absolute top-2 right-2 text-xs text-green-400 font-mono bg-black bg-opacity-50 px-2 py-1 rounded">
            FPS: {debugInfo.fps} | Objects: {debugInfo.objectCount}
          </div>
        {/if}
        {#if quantumState?.entanglement_measures?.pairs}
          <div class="absolute top-2 left-2 text-xs text-cyan-400 font-mono bg-black bg-opacity-50 px-2 py-1 rounded">
            Entangled Pairs: {quantumState.entanglement_measures.pairs.length}
          </div>
        {/if}
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
      
      <!-- Real Entanglement Info -->
      {#if quantumState?.entanglement_measures?.pairs}
        <div class="bg-gray-900 rounded p-4 text-sm">
          <div class="text-quantum-300 font-bold mb-2">🔗 Real Quantum Entanglement:</div>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
            {#each quantumState.entanglement_measures.pairs as pair}
              <div class="bg-gray-800 rounded p-2 text-xs">
                <div class="text-cyan-400">Q{pair.qubits[0]} ↔ Q{pair.qubits[1]}</div>
                <div class="text-gray-400">
                  Strength: {(pair.strength * 100).toFixed(0)}%
                </div>
                <div class="text-gray-500">
                  Entropy: {pair.entropy.toFixed(2)}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
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