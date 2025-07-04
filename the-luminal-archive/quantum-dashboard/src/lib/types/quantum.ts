export interface QuantumState {
    living_equation: {
        real: number;
        imaginary: number;
        magnitude: number;
        phase: number;
    };
    tensor_network: {
        coherence: number;
        entanglement: number;
        bond_dimension: number;
        compression_ratio: number;
        memory_nodes: number;
    };
    quantum_formula: {
        display: string;
        components: {
            emotional_amplitude: string;
            memory_state: string;
            evolution: string;
        };
    };
    dynamics: {
        emotional_flux: number;
        memory_consolidation: number;
        quantum_noise: number;
    };
    equation: {
        equation: string;
        components: {
            quantum_oscillation: string;
            emotional_wave: string;
            memory_resonance: string;
            entanglement_factor: string;
            time_evolution: string;
        };
    };
    measurement_probabilities: number[];
    is_real_quantum?: boolean;
    bloch_vectors?: BlochVector[];
    von_neumann_entropy?: number;
    entanglement_measures?: EntanglementMeasures;
    
    // Additional properties for compatibility
    coherence: number;
    entanglement: number;
    phase: number;
}

export interface BlochVector {
    qubit: number;
    cartesian: {
        x: number;
        y: number;
        z: number;
    };
    spherical: {
        r: number;
        theta: number;
        phi: number;
    };
}

export interface EntanglementMeasures {
    pairs: Array<{
        qubits: number[];
        entropy: number;
        strength: number;
    }>;
    average: number;
    network_entanglement: number;
}