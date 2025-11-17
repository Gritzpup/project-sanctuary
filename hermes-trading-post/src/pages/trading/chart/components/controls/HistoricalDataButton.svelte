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
      } else {
      }
    } catch (error) {
    } finally {
      isLoading = false;
    }
  }

  async function load5YearsData() {
    if (isBulkLoading) return;

    isBulkLoading = true;
    try {

      // Load in chunks of 10,000 to avoid overwhelming the system
      let totalLoaded = 0;
      const chunkSize = 10000;
      const maxIterations = 300; // Prevent infinite loops

      for (let i = 0; i < maxIterations; i++) {
        const addedCount = await dataStore.fetchAndPrependHistoricalData(chunkSize);

        if (addedCount === 0) {
          break;
        }

        totalLoaded += addedCount;
        loadedCount += addedCount;


        // Small delay to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }


    } catch (error) {
    } finally {
      isBulkLoading = false;
    }
  }

  $: totalCandles = dataStore.candles.length;
</script>