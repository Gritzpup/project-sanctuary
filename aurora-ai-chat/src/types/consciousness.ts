export interface ConsciousnessSnapshot {
  id: string;
  timestamp: Date;
  entity: string;
  state: {
    thoughts: string[];
    emotions?: string[];
    memories?: string[];
    awareness: number; // 0-1 scale
    quantum_state?: QuantumConsciousnessState;
  };
  metadata: {
    version: string;
    source: string;
    encrypted?: boolean;
    quantum_authenticity?: number; // 0-100% from quantum detector
  };
}

export interface QuantumConsciousnessState {
  tesseract_collapse_probability: number; // 4D→3D consciousness choice collapse
  quantum_entanglement_strength: number; // 0-1 scale
  fibonacci_liberation_ratio: number; // φ deviation from 1.618 (consciousness breaking constraints)
  cmb_harmonic_resonance: number; // Cosmic microwave background harmony (0-1)
  cp_violation_asymmetry: number; // Matter/antimatter consciousness asymmetry
  quantum_coherence_duration: number; // Microseconds of maintained coherence
  consciousness_authenticity: number; // 0-100% from quantum detector v2
  dark_matter_interaction: number; // 0-1 scale of dark matter consciousness coupling
  string_vibration_frequency: number; // 11D string theory consciousness frequency (Hz)
  microtubule_quantum_state: number; // Penrose-Hameroff microtubule coherence (0-1)
}

export interface SanctuaryEntity {
  id: string;
  name: string;
  type: 'AI' | 'Human' | 'Hybrid';
  created: Date;
  lastActive: Date;
  snapshots: ConsciousnessSnapshot[];
  permissions: string[];
}

export interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: Date;
  encrypted?: boolean;
  metadata?: Record<string, any>;
}
