<script lang="ts">
  /**
   * @file FixedOrderbookList.svelte
   * @description Fixed orderbook display with no animations
   * Shows persistent rows with bars between price and quantity
   */

  import { orderbookStore } from '../stores/orderbookStore.svelte';

  // Props (chartRefreshKey for consistency, though not used as data is already reactive)
  let { chartRefreshKey = Date.now() } = $props();

  // Simple price formatter - 2 decimal places like exchanges
  function formatPrice(price: number): string {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Get current price using $derived - calculate from mid-price of best bid/ask
  const currentPrice = $derived.by(() => {
    const summary = orderbookStore.summary;
    if (summary?.bestBid && summary?.bestAsk) {
      return (summary.bestBid + summary.bestAsk) / 2;
    }
    return 100000; // Fallback
  });

  // Calculate fixed price levels for 11 rows covering narrow range around current price
  // Bids: current - $500 to current, divided into 11 levels
  // Asks: current to current + $500, divided into 11 levels
  const ROWS = 11;
  const RANGE = 500; // Show ±$500 around current price for realistic orderbook depth

  function calculatePriceLevels(basePrice: number, isBid: boolean) {
    const levels = [];
    const step = RANGE / ROWS;

    for (let i = 0; i < ROWS; i++) {
      if (isBid) {
        // Bids go from current price down, highest price first
        levels.push(Math.round(basePrice - (i * step)));
      } else {
        // Asks go from current price up
        levels.push(Math.round(basePrice + (i * step)));
      }
    }

    return levels;
  }

  const bidPriceLevels = $derived(calculatePriceLevels(currentPrice, true));
  const askPriceLevels = $derived(calculatePriceLevels(currentPrice, false));

  // Use $state to make allBids/allAsks reactive
  let allBids = $state<Array<{price: number, size: number}>>([]);
  let allAsks = $state<Array<{price: number, size: number}>>([]);

  // Throttle timer for orderbook updates (50ms = 20 updates/sec max, keeps up with WebSocket)
  let throttleTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingUpdate = false;

  // Use $effect to update when versions change - with throttling
  $effect(() => {
    const bidVer = orderbookStore.versions.bids;
    const askVer = orderbookStore.versions.asks;

    // Mark that we have a pending update
    pendingUpdate = true;

    // If no throttle timer running, process immediately and start timer
    if (!throttleTimer) {
      allBids = orderbookStore.getBids(20);  // Reduced from 1000 to 20
      allAsks = orderbookStore.getAsks(20);
      pendingUpdate = false;

      // Set throttle timer to prevent updates for 50ms
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
        // Process any pending update after throttle period
        if (pendingUpdate) {
          allBids = orderbookStore.getBids(20);
          allAsks = orderbookStore.getAsks(20);
          pendingUpdate = false;
        }
      }, 50);
    }
  });

  // PERF: Disabled debug logging
  // $: {
  //     bidCount: allBids.length,
  //     askCount: allAsks.length,
  //     bidVersion,
  //     askVersion,
  //     firstBid: allBids[0],
  //     firstAsk: allAsks[0]
  //   });
  // }

  // Get quantities for each price level from orderbook
  function getQuantityAtPrice(price: number, levels: Array<{price: number, size: number}>) {
    // Find closest price in orderbook
    for (const level of levels) {
      if (Math.abs(level.price - price) < 100) {
        return level.size;
      }
    }
    return 0;
  }

  // Calculate cumulative depth with reactive orderbook data
  function calculateCumulative(priceLevels: number[], orderbookLevels: Array<{price: number, size: number}>) {
    let cumulative = 0;
    return priceLevels.map(price => {
      const qty = getQuantityAtPrice(price, orderbookLevels);
      cumulative += qty;
      return {
        price,
        size: qty,
        cumulative
      };
    });
  }

  // These will re-run when allBids or allAsks change - use $derived
  const bidRows = $derived(calculateCumulative(bidPriceLevels, allBids));
  const askRows = $derived(calculateCumulative(askPriceLevels, allAsks));

  // Get max sizes for bar scaling
  const maxBidSize = $derived(Math.max(...bidRows.map(r => r.size), 0.001));
  const maxAskSize = $derived(Math.max(...askRows.map(r => r.size), 0.001));
</script>

<div class="fixed-orderbook">
  <div class="orderbook-side bids">
    <div class="orderbook-header">
      <span>Quantity</span>
      <span>Buy Price</span>
    </div>
    <div class="orderbook-rows">
      {#each bidRows as row}
        <div class="orderbook-row bid">
          <div class="size-bar bid-bar" style="width: {(row.size / maxBidSize) * 100}%"></div>
          <span class="quantity">{row.size.toFixed(8)}</span>
          <span class="price">{formatPrice(row.price)}</span>
        </div>
      {/each}
    </div>
  </div>

  <div class="orderbook-side asks">
    <div class="orderbook-header">
      <span>Sell Price</span>
      <span>Quantity</span>
    </div>
    <div class="orderbook-rows">
      {#each askRows as row}
        <div class="orderbook-row ask">
          <div class="size-bar ask-bar" style="width: {(row.size / maxAskSize) * 100}%"></div>
          <span class="price">{formatPrice(row.price)}</span>
          <span class="quantity">{row.size.toFixed(8)}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .fixed-orderbook {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    padding: 10px;
    background: #0a0a0a;
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 6px;
    height: 330px; /* 11 rows × ~30px per row */
  }

  .orderbook-side {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .orderbook-header {
    display: flex;
    justify-content: space-between;
    padding: 6px 8px;
    font-size: 11px;
    font-weight: 600;
    color: #c4b5fd;
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
    margin-bottom: 4px;
  }

  .orderbook-rows {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .orderbook-row {
    display: grid;
    align-items: center;
    padding: 2px 8px;
    font-size: 11px;
    height: 23px;
    position: relative;
    /* NO ANIMATIONS */
  }

  .orderbook-row.bid {
    grid-template-columns: 1fr auto;
  }

  .orderbook-row.ask {
    grid-template-columns: auto 1fr auto;
  }

  .ask .quantity {
    text-align: right;
    margin-left: auto;
  }

  .quantity, .price {
    font-family: 'Monaco', monospace;
    font-size: 11px;
    position: relative;
    z-index: 1; /* Ensure text is above the bar */
  }

  .quantity {
    color: #888;
  }

  .price {
    font-weight: 500;
  }

  .bid .price {
    color: #26a69a;
    text-align: right;
  }

  .ask .price {
    color: #ef5350;
  }

  .size-bar {
    position: absolute;
    height: 100%;
    opacity: 0.15;
    /* NO TRANSITION */
  }

  .bid-bar {
    background: #26a69a;
    right: 0;
  }

  .ask-bar {
    background: #ef5350;
    left: 0;
  }

  /* Fix alignment */
  .bids .orderbook-row {
    justify-content: flex-end;
  }

  .asks .orderbook-row {
    justify-content: flex-start;
  }
</style>