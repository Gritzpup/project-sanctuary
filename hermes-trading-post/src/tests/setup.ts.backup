import { beforeEach, vi } from 'vitest';

// Mock console methods to avoid spam during tests
global.console = {
  ...console,
  // Keep error and warn for important test feedback
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
};

// Mock browser APIs that might not be available in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock WebSocket for trading tests
global.WebSocket = vi.fn().mockImplementation(() => ({
  readyState: WebSocket.CONNECTING,
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
});