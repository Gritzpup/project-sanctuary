<script lang="ts">
  import { dataStore } from '../../stores/dataStore.svelte';
  
  let isLoading = false;
  let loadedCount = 0;
  let isBulkLoading = false;
  
  async function loadMoreHistoricalData() {
    if (isLoading) return;
    
    isLoading = true;
    try {
      const addedCount = await dataStore.fetchAndPrependHistoricalData(300);
      loadedCount += addedCount;
      
      if (addedCount > 0) {
        console.log(`📈 Loaded ${addedCount} additional historical candles. Total added: ${loadedCount}`);
      } else {
        console.log('📈 No more historical data available');
      }
    } catch (error) {
      console.error('❌ Failed to load historical data:', error);
    } finally {
      isLoading = false;
    }
  }
  
  async function load5YearsData() {
    if (isBulkLoading) return;
    
    isBulkLoading = true;
    try {
      console.log('🚀 Starting 5-year bulk data load...');
      
      // Load in chunks of 10,000 to avoid overwhelming the system
      let totalLoaded = 0;
      const chunkSize = 10000;
      const maxIterations = 300; // Prevent infinite loops
      
      for (let i = 0; i < maxIterations; i++) {
        console.log(`📊 Loading chunk ${i + 1}/${maxIterations}...`);
        const addedCount = await dataStore.fetchAndPrependHistoricalData(chunkSize);
        
        if (addedCount === 0) {
          console.log('📈 No more historical data available');
          break;
        }
        
        totalLoaded += addedCount;
        loadedCount += addedCount;
        
        console.log(`📈 Loaded ${addedCount} candles. Total loaded: ${totalLoaded.toLocaleString()}`);
        
        // Small delay to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`✅ Bulk loading complete! Total loaded: ${totalLoaded.toLocaleString()} candles`);
      
    } catch (error) {
      console.error('❌ Failed to bulk load historical data:', error);
    } finally {
      isBulkLoading = false;
    }
  }
  
  $: totalCandles = dataStore.candles.length;
</script>


<style>
  .historical-data-controls {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-sm);
    background: var(--surface-elevated);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-primary);
  }

  .load-historical-btn {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .load-historical-btn:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .load-historical-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .load-historical-btn.loading {
    background: var(--color-primary-dark);
  }
  
  .load-bulk-btn {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    background: var(--color-accent);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: background 0.2s ease;
    margin-left: var(--space-xs);
  }

  .load-bulk-btn:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }

  .load-bulk-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .load-bulk-btn.loading {
    background: var(--color-accent-dark);
  }

  .loading-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .candle-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .candle-count {
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    font-weight: var(--font-weight-medium);
    font-family: var(--font-family-mono);
  }

  .loaded-count {
    font-size: var(--font-size-xs);
    color: var(--color-success);
    font-family: var(--font-family-mono);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .historical-data-controls {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }
  }
</style>