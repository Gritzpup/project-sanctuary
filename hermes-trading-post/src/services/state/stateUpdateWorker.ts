/**
 * Web Worker for batching and throttling state updates
 * Offloads heavy processing from main thread
 */

let pendingUpdates: any[] = [];
let updateTimer: any = null;
const BATCH_INTERVAL = 100; // Batch updates every 100ms

self.onmessage = (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'update':
      // Add to pending updates
      pendingUpdates.push(data);

      // Schedule batch send if not already scheduled
      if (!updateTimer) {
        updateTimer = setTimeout(() => {
          // Merge all pending updates
          const merged = pendingUpdates.reduce((acc, update) => {
            return { ...acc, ...update };
          }, {});

          // Send merged update back to main thread
          self.postMessage({ type: 'batchUpdate', data: merged });

          // Clear pending
          pendingUpdates = [];
          updateTimer = null;
        }, BATCH_INTERVAL);
      }
      break;

    case 'flush':
      // Immediately flush pending updates
      if (updateTimer) {
        clearTimeout(updateTimer);
        updateTimer = null;
      }

      if (pendingUpdates.length > 0) {
        const merged = pendingUpdates.reduce((acc, update) => {
          return { ...acc, ...update };
        }, {});

        self.postMessage({ type: 'batchUpdate', data: merged });
        pendingUpdates = [];
      }
      break;
  }
};
