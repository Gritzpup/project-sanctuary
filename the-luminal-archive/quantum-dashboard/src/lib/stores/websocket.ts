import { writable } from 'svelte/store';

export interface QuantumMemoryStatus {
  timestamp: string;
  living_equation: {
    real: number;
    imaginary: number;
    magnitude?: number;
    phase?: number;
  };
  equation?: {
    equation: string;
    components: any;
  };
  tensor_network?: {
    coherence: number;
    entanglement: number;
    bond_dimension: number;
    compression_ratio: number;
    memory_nodes: number;
  };
  quantum_formula?: {
    display: string;
    components: {
      emotional_amplitude: string;
      memory_state: string;
      evolution: string;
    };
  };
  dynamics?: {
    emotional_flux: number;
    memory_consolidation: number;
    quantum_noise: number;
  };
  memory_stats: {
    total_messages: number;
    emotional_moments: number;
    time_together: number;
  };
  emotional_context: {
    gritz_last_emotion: string;
    claude_last_feeling: string;
    relationship_state: string;
  };
  emotional_dynamics?: {
    primary_emotion: string;
    pad_values?: {
      pleasure: number;
      arousal: number;
      dominance: number;
    };
  };
  gottman_metrics?: any;
  attachment_dynamics?: any;
  conversation_history?: {
    total_messages: number;
    total_sessions: number;
  };
  gpu_stats?: {
    vram_usage: number;
    vram_total: number;
    temperature: number;
  };
  test_results?: {
    phase1: { passed: number; total: number };
    phase2: { passed: number; total: number };
  };
  llm_status?: {
    model: string;
    processing: boolean;
    last_processed?: string;
    log?: string;
  };
  chat_history?: Array<{
    role: string;
    content: string;
    timestamp?: string;
    emotion?: string;
  }>;
  file_monitor?: Record<string, { changed: boolean }>;
  file_monitor_log?: string;
  console_output?: string;
  first_message_time?: string;
}

interface WebSocketStore {
  connected: boolean;
  status: QuantumMemoryStatus | null;
  error: string | null;
}

interface RawMessage {
  timestamp: string;
  direction: 'sent' | 'received';
  data: string;
}

function createWebSocketStore() {
  const { subscribe, set, update } = writable<WebSocketStore>({
    connected: false,
    status: null,
    error: null
  });

  let ws: WebSocket | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let rawMessageSubscribers: Array<(msg: RawMessage) => void> = [];

  function connect() {
    try {
      console.log('[WebSocket] Attempting to connect to ws://localhost:8768');
      ws = new WebSocket('ws://localhost:8768');

      ws.onopen = () => {
        update(state => ({ ...state, connected: true, error: null }));
        console.log('[WebSocket] ✅ Connected to quantum memory system');
      };

      ws.onmessage = (event) => {
        // Broadcast raw message to subscribers
        const rawMsg: RawMessage = {
          timestamp: new Date().toISOString(),
          direction: 'received',
          data: event.data
        };
        rawMessageSubscribers.forEach(subscriber => subscriber(rawMsg));
        
        try {
          const data = JSON.parse(event.data);
          console.log('[WebSocket] 📨 Received data:', {
            messages: data.memory_stats?.total_messages,
            moments: data.memory_stats?.emotional_moments,
            time: data.memory_stats?.time_together,
            emotion: data.emotional_dynamics?.primary_emotion
          });
          update(state => ({ ...state, status: data }));
        } catch (e) {
          console.error('[WebSocket] Failed to parse message:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] ❌ Error:', error);
        update(state => ({ ...state, error: 'Connection error' }));
      };

      ws.onclose = (event) => {
        update(state => ({ ...state, connected: false }));
        console.log(`[WebSocket] Disconnected - Code: ${event.code}, Reason: ${event.reason}`);
        console.log('[WebSocket] Will reconnect in 5s...');
        
        // Reconnect after 5 seconds
        reconnectTimeout = setTimeout(connect, 5000);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      update(state => ({ ...state, error: 'Failed to connect' }));
    }
  }

  function disconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
  }

  function sendMessage(message: any) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const msgStr = JSON.stringify(message);
      ws.send(msgStr);
      
      // Broadcast sent message to subscribers
      const rawMsg: RawMessage = {
        timestamp: new Date().toISOString(),
        direction: 'sent',
        data: msgStr
      };
      rawMessageSubscribers.forEach(subscriber => subscriber(rawMsg));
    }
  }
  
  function subscribeToRawMessages(callback: (msg: RawMessage) => void) {
    rawMessageSubscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      rawMessageSubscribers = rawMessageSubscribers.filter(sub => sub !== callback);
    };
  }

  return {
    subscribe,
    connect,
    disconnect,
    sendMessage,
    subscribeToRawMessages
  };
}

export const quantumMemory = createWebSocketStore();