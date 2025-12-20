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