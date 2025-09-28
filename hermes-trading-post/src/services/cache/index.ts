/**
 * Cache Service Modules
 * Modularized components with backend-first approach
 */

// New backend-first cache service (recommended)
export { BackendCacheService, backendCache } from './BackendCacheService';

// Legacy browser-based modules (for migration)
export { ChunkManager } from './ChunkManager';
export type { DataChunk } from './ChunkManager';
export { MetadataManager } from './MetadataManager';
export type { DataMetadata } from './MetadataManager';

// Legacy IndexedDB cache (deprecated - use BackendCacheService instead)
export { IndexedDBCache } from './indexedDB';