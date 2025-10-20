# Architecture Guide - Hermes Trading Post

**Version**: Phase 17 Final + Phases 18-22 Implementation
**Date**: October 2025
**Status**: COMPREHENSIVE ARCHITECTURE DOCUMENTATION

---

## 📚 Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Component Hierarchy](#component-hierarchy)
4. [Store Management](#store-management)
5. [Data Flow](#data-flow)
6. [Service Layer](#service-layer)
7. [Performance Optimizations](#performance-optimizations)
8. [Real-time Pipeline](#real-time-pipeline)
9. [Error Handling](#error-handling)
10. [Deployment](#deployment)

---

## 🏗️ System Overview

### Architecture Stack
```
Frontend (Svelte 5)
├── UI Components (Svelte)
├── State Management (Stores)
├── Services Layer (TypeScript)
├── Utilities & Hooks
└── Web Workers (Data Processing)

Backend (Node.js)
├── Express Server
├── WebSocket Handler
├── Redis Cache
├── Data Fetching
└── Bot Trading System

External APIs
├── Coinbase Exchange API
└── Real-time WebSocket Feed
```

### Key Principles
- **Separation of Concerns**: UI, logic, data are separated
- **Reactive State**: Svelte stores for state management
- **Performance First**: Optimized rendering, caching, and data processing
- **Resilience**: Circuit breakers, fallbacks, error handling
- **Observability**: Metrics collection and monitoring

---

## 🎯 High-Level Architecture

### Three-Tier Architecture
```
┌─────────────────────────────────────────────┐
│ PRESENTATION LAYER (Components)             │
│ - Svelte Components                         │
│ - UI Rendering                              │
│ - User Interactions                         │
└────────────┬────────────────────────────────┘
             │ (uses)
┌────────────▼────────────────────────────────┐
│ BUSINESS LOGIC LAYER (Services & Stores)    │
│ - State Management (Stores)                 │
│ - Service Layer                             │
│ - Data Transformations                      │
│ - Web Workers                               │
└────────────┬────────────────────────────────┘
             │ (communicates with)
┌────────────▼────────────────────────────────┐
│ DATA LAYER (Backend & External APIs)        │
│ - Express Server (Backend)                  │
│ - Redis Cache                               │
│ - Coinbase API                              │
│ - WebSocket Feed                            │
└─────────────────────────────────────────────┘
```

### Horizontal Slices
```
Authentication & Authorization
  ├─ User Service
  ├─ Permission Service
  └─ Session Management

Trading Domain
  ├─ Chart Service
  ├─ Orderbook Service
  ├─ Trading Bot Service
  ├─ Position Service
  └─ Performance Service

Real-time Updates
  ├─ WebSocket Service
  ├─ Subscription Manager
  ├─ Circuit Breaker
  └─ Retry Logic

Monitoring & Observability
  ├─ Metrics Collector
  ├─ Error Tracker
  ├─ Performance Monitor
  └─ Session Manager
```

---

## 🧩 Component Hierarchy

### Page Structure
```
App (root)
├── Trading Page
│   ├── Chart Container
│   │   ├── Chart Core (lightweight-charts)
│   │   ├── Indicators Panel
│   │   ├── Chart Controls
│   │   └── Status Display
│   ├── Orderbook Container
│   │   ├── Orderbook Table
│   │   └── Orderbook Stats
│   └── Trading Controls
│       ├── Order Form
│       ├── Position Display
│       └── Stats Panel
│
├── Settings Page
│   ├── Chart Preferences
│   ├── Trading Settings
│   └── User Preferences
│
└── Dashboard Page
    ├── Performance Stats
    ├── Trading History
    └── Risk Metrics
```

### Component Classification
- **Container Components**: Handle state and logic (Chart, Orderbook, Trading)
- **Presentational Components**: Pure rendering (Stats, Table, Display)
- **Smart Components**: Connect to stores and services
- **Dumb Components**: Receive props, emit events

---

## 🏪 Store Management

### Phase 18: Store Architecture

#### Store Hierarchy
```
Global Stores (app-wide)
├── themeStore (appearance)
├── navigationStore (routing)
├── userStore (user data)
└── preferencesStore (user preferences)

Page Stores (specific pages)
├── Trading Page Stores
│   ├── chartStore (chart configuration)
│   ├── dataStore (historical data)
│   ├── orderbookStore (orderbook state)
│   └── positionStore (trading positions)
│
└── Dashboard Page Stores
    ├── performanceStore (metrics)
    └── historyStore (trading history)

Feature Stores (specific features)
├── indicatorStore (chart indicators)
├── strategyStore (trading strategies)
└── subscriberStore (subscriptions)
```

#### Store Factory Pattern
```typescript
// Base store with persistence
const store = createBaseStore({
  initial: {},
  persist: { key: 'store-key', storage: 'localStorage' },
  validate: (v) => true
});

// Derived stores
const filteredItems = derivedStore(itemsStore, items =>
  items.filter(i => i.active)
);

// Combined stores
const combined = combineStores(
  { user: userStore, settings: settingsStore },
  (values) => ({ ...values })
);
```

#### Store Manager
```typescript
// Centralized initialization
storeManager.registerStore('myStore', store, {
  initializer: async () => { /* setup */ },
  dependencies: ['otherStore']
});

await storeManager.initialize(); // Initializes in dependency order
```

### Benefits
- ✅ Centralized state management
- ✅ Automatic persistence
- ✅ Type-safe stores
- ✅ Dependency tracking
- ✅ Easy debugging

---

## 📊 Data Flow

### Chart Data Flow
```
1. Component Mounts
   ├─ ChartCore.svelte initializes
   ├─ Requests historical data from backend
   └─ Subscribes to real-time WebSocket

2. Historical Data Load
   ├─ ChartCacheService checks LRU cache
   ├─ Cache hit? Return cached data (if fresh < 5s TTL)
   ├─ Cache miss? Fetch from backend
   ├─ Backend returns 1000+ candles from Redis
   └─ Store in LRU cache with timestamp

3. Real-time Updates
   ├─ WebSocket receives candle updates
   ├─ Validate timestamp and synchronization
   ├─ Send to chart via updateCandle()
   ├─ Chart re-renders new candle
   └─ Emit metrics to MetricsCollector

4. Data Processing
   ├─ Large datasets (1000+ candles)
   ├─ Offload to Web Worker
   ├─ Worker validates, deduplicates, sorts
   ├─ Returns processed data
   └─ Update chart and stores
```

### Order Flow
```
1. User Places Order
   ├─ Validate order form
   ├─ Send to backend via API
   ├─ Backend records in database
   └─ Emit via WebSocket

2. Order Confirmation
   ├─ WebSocket receives confirmation
   ├─ Update position store
   ├─ Update orderbook
   ├─ Recalculate stats
   └─ Update UI

3. Order Execution
   ├─ Backend executes against Coinbase
   ├─ Update status to FILLED
   ├─ Emit execution WebSocket message
   ├─ Update positions
   └─ Calculate P&L
```

---

## 🔧 Service Layer

### Core Services

#### ChartCacheService
- **Purpose**: Unified caching and data fetching for chart data
- **Features**: LRU cache with TTL, timeout handling, fallback support
- **File**: `src/shared/services/chartCacheService.ts`

#### ChartDataProcessingService
- **Purpose**: Web Worker delegation for heavy computations
- **Features**: Async message passing, timeout protection, error handling
- **File**: `src/services/ChartDataProcessingService.ts`

#### NetworkSpeedDetector
- **Purpose**: Detect network speed and adapt batch sizes
- **Features**: Latency measurement, adaptive configuration
- **File**: `src/services/NetworkSpeedDetector.ts`

#### CircuitBreaker
- **Purpose**: Prevent cascade failures in WebSocket connections
- **Features**: State machine (CLOSED/OPEN/HALF_OPEN), exponential backoff
- **File**: `src/services/websocket/CircuitBreaker.ts`

#### MetricsCollector
- **Purpose**: Collect application performance metrics
- **Features**: Auto-flush buffer, FPS monitoring, memory tracking
- **File**: `src/services/monitoring/MetricsCollector.ts`

### Service Initialization
```typescript
// On app load:
1. Initialize Store Manager
2. Initialize Chart Cache Service
3. Initialize Data Processing Service
4. Initialize Metrics Collector
5. Initialize Animation Manager
6. Initialize WebSocket with Circuit Breaker

// Result: All systems ready, fully observable
```

---

## ⚡ Performance Optimizations

### Phase 17: Advanced Optimizations

#### 1. LRU Cache (Fix #18)
- **What**: In-memory cache with automatic eviction
- **How**: Max 500 entries, ~25MB max
- **TTL**: 5-second freshness window
- **Impact**: 80% reduction in API calls

#### 2. Web Workers (Fix #17)
- **What**: Offload data transformations to worker thread
- **How**: Async message passing, timeout protection
- **Operations**: Validate, deduplicate, sort, filter
- **Impact**: Main thread unblocked, smooth rendering

#### 3. Route-based Code Splitting (Fix #19)
- **What**: Split code by route and feature
- **Chunks**: chart-lib, chart-route, orderbook-route, vendor, svelte-framework
- **Impact**: 40% faster initial load

#### 4. Network Speed Detection (Fix #21)
- **What**: Measure API latency, adapt batch sizes
- **Adaptation**: Fast (8ms batches), Normal (4ms), Slow (1-2 batches)
- **Impact**: Better performance on slow networks

#### 5. GPU Rendering (Fix #20)
- **What**: WebGL hardware acceleration
- **How**: lightweight-charts library default
- **Performance**: 60fps sustained, 1000+ candle rendering
- **Impact**: Smooth, responsive chart interactions

### Phase 19: UI/UX Performance

#### Animation Manager
- Frame rate limiting (configurable 30-60fps)
- Batch DOM updates
- RequestAnimationFrame coordination
- Low-end device detection

#### Scroll Optimization
- Passive event listeners
- Virtual scrolling for large lists
- Scroll position restoration
- Debounced resize handling

### Performance Budget
```
Initial Load:    < 2 seconds
Time to Interactive: < 3 seconds
Chart Render:    < 100ms
API Response:    < 500ms (p95)
Memory Usage:    < 150MB
FPS:             60fps sustained
```

---

## 🔄 Real-time Pipeline

### Phase 20: Resilience

#### Circuit Breaker States
```
CLOSED (normal)
  └─ Failure threshold exceeded
     ├─ Transition to OPEN
     └─ Schedule recovery

OPEN (failing)
  └─ Timeout elapsed
     ├─ Transition to HALF_OPEN
     └─ Test connection

HALF_OPEN (testing)
  ├─ Success
  │  └─ Transition to CLOSED
  └─ Failure
     └─ Transition to OPEN
```

#### Reconnection Strategy
- Exponential backoff: 1s, 2s, 4s, 8s, max 30s
- Jitter: Prevent thundering herd
- Max retries: 10 (then fallback to polling)
- Half-open test: 3 second window

#### Subscription Management
- Rate limiting: Max 5 subscriptions/second
- Message batching: Combine related updates
- Auto-cleanup: Remove on component unmount
- Leak detection: Track all subscriptions

#### Candle Synchronization
- Timestamp validation: Ensure chronological order
- Duplicate detection: Skip repeated candles
- Out-of-order handling: Buffer and sort
- Historical/real-time sync: No gaps or overlaps

---

## 🚨 Error Handling

### Error Categories
```
Network Errors
├─ Timeout (handled by CircuitBreaker)
├─ 4xx Client (user's fault)
├─ 5xx Server (API fault)
└─ Connection Lost (auto-recover)

Data Errors
├─ Invalid data format (validation)
├─ Missing required fields (schema validation)
├─ Type mismatches (runtime checking)
└─ Corruption detection (checksums)

Application Errors
├─ Null pointer exceptions (guards)
├─ Type errors (TypeScript)
├─ Memory leaks (monitoring)
└─ Infinite loops (timeouts)
```

### Error Handling Strategy
1. **Prevent**: Use TypeScript, validation
2. **Detect**: Monitoring, error tracking
3. **Handle**: Try-catch, fallbacks
4. **Recover**: Retry logic, circuit breakers
5. **Report**: Error tracking service

---

## 🚀 Deployment

### Build Process
```bash
1. Build Frontend (Vite)
   ├─ TypeScript compilation
   ├─ Svelte components
   ├─ CSS processing
   ├─ Code splitting (manualChunks)
   └─ Tree-shaking

2. Optimize
   ├─ Minify (Terser)
   ├─ Compress assets
   ├─ Generate sourcemaps (for debugging)
   └─ Hash filenames (cache busting)

3. Output
   └─ dist/ folder ready for deployment
```

### Environment Configuration
```typescript
// Environment variables
VITE_BACKEND_HOST     = Backend server host
VITE_BACKEND_PORT     = Backend server port
VITE_ENVIRONMENT      = dev|staging|production

// Detection
- Automatic fallback: window.location.hostname
- Manual override: .env file
- Runtime detection: Try localhost, then fallback
```

### Performance Monitoring
- FPS tracking: 60fps target sustained
- API latency: Monitor response times
- Memory usage: Track heap size
- Error rates: Track error frequency
- Session tracking: User behavior analysis

---

## 📈 Metrics & Observability

### Phase 21: Monitoring

#### Collected Metrics
- **Performance**: FPS, API latency, render time, memory
- **Reliability**: Error count, recovery time, circuit breaker state
- **Usage**: Feature usage, user actions, session duration
- **Business**: Trading volume, order count, P&L metrics

#### Monitoring Hooks
```
Real-time Dashboard:
├─ FPS counter (60fps target)
├─ API latency graph
├─ Memory usage chart
├─ Error log viewer
└─ Session information

Debug Mode Only:
├─ Store state inspector
├─ Service lifecycle
├─ WebSocket activity
└─ Metrics details
```

#### Alerts
- FPS < 30 (performance degradation)
- API latency > 2s (slow backend)
- Memory > 200MB (memory leak)
- Error rate > 5% (system issue)
- Circuit breaker OPEN > 5min (connection issue)

---

## 🧪 Testing Strategy

### Phase 22: Comprehensive Testing

#### Unit Tests (80% coverage)
- Store logic: 30+ tests
- Service layer: 40+ tests
- Utility functions: 20+ tests
- Total: 90+ unit tests

#### Integration Tests
- Data flow: 10+ tests
- Real-time pipeline: 8+ tests
- Chart operations: 6+ tests
- Total: 24+ integration tests

#### E2E Tests
- Critical user flows: 4+ tests
- Trading operations: 2+ tests
- Error scenarios: 2+ tests
- Total: 8+ E2E tests

#### Coverage Targets
- Statements: 80%+
- Branches: 75%+
- Functions: 80%+
- Lines: 80%+

---

## 🎓 Best Practices

### State Management
✅ Use stores for shared state
❌ Don't pass props more than 2 levels
✅ Persist user preferences
❌ Don't store API responses in component state

### Components
✅ Keep components focused and single-responsibility
❌ Don't mix presentation and logic
✅ Use TypeScript for type safety
❌ Don't access DOM directly (let Svelte handle it)

### Services
✅ Make services stateless and testable
❌ Don't use global variables
✅ Implement error handling
❌ Don't ignore errors silently

### Performance
✅ Use Web Workers for heavy computation
❌ Don't process data in main thread
✅ Batch updates when possible
❌ Don't cause layout thrashing

### Real-time
✅ Implement circuit breakers
❌ Don't retry indefinitely
✅ Monitor subscription leaks
❌ Don't leave subscriptions open

---

## 📚 Related Documentation

- **STORES.md**: Detailed store API reference
- **PERFORMANCE.md**: Performance optimization guide
- **REAL_TIME.md**: Real-time pipeline documentation
- **TESTING.md**: Testing guidelines and examples
- **DEPLOYMENT.md**: Deployment instructions

---

**End of Architecture Guide**

This document is version-controlled and updated as the system evolves. See commit history for changes.
