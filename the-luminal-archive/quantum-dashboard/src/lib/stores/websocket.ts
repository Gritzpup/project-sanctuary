import { writable } from 'svelte/store';

export interface QuantumMemoryStatus {
  timestamp: string;
  living_equation: {
    real: number;
    imaginary: number;
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
  gpu_stats?: {
    vram_usage: number;
    vram_total: number;
    temperature: number;
  };
  test_results?: {
    phase1: { passed: number; total: number };
    phase2: { passed: number; total: number };
  };
}

interface WebSocketStore {
  connected: boolean;
  status: QuantumMemoryStatus | null;
  error: string | null;
}

function createWebSocketStore() {
  const { subscribe, set, update } = writable<WebSocketStore>({
    connected: false,
    status: null,
    error: null
  });

  let ws: WebSocket | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    try {
      console.log('[WebSocket] Attempting to connect to ws://localhost:8768');
      ws = new WebSocket('ws://localhost:8768');

      ws.onopen = () => {
        update(state => ({ ...state, connected: true, error: null }));
        console.log('[WebSocket] ✅ Connected to quantum memory system');
      };

      ws.onmessage = (event) => {
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
      ws.send(JSON.stringify(message));
    }
  }

  return {
    subscribe,
    connect,
    disconnect,
    sendMessage
  };
}

export const quantumMemory = createWebSocketStore();