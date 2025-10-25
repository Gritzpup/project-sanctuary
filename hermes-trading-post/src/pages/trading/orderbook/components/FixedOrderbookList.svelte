<script lang="ts">
  /**
   * @file FixedOrderbookList.svelte
   * @description Fixed 15-row orderbook display with no animations
   * Shows persistent rows for $25k range on each side
   */

  import { orderbookStore } from '../stores/orderbookStore.svelte';

  // Simple price formatter
  function formatPrice(price: number): string {
    return `$${price.toFixed(0)}`;
  }

  // Get current price
  $: currentPrice = orderbookStore.summary?.currentPrice || 100000;

  // Calculate fixed price levels for 14 rows covering $25k range
  // Bids: current - 25k to current, divided into 14 levels
  // Asks: current to current + 25k, divided into 14 levels
  const ROWS = 14;
  const RANGE = 25000;

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

  $: bidPriceLevels = calculatePriceLevels(currentPrice, true);
  $: askPriceLevels = calculatePriceLevels(currentPrice, false);

  // Make orderbook data reactive by accessing it in reactive statements
  $: allBids = orderbookStore.getBids(1000);
  $: allAsks = orderbookStore.getAsks(1000);

  // Debug: log when orderbook updates
  $: if (allBids.length > 0 || allAsks.length > 0) {
    console.log(`[FixedOrderbook] Updated: ${allBids.length} bids, ${allAsks.length} asks`);
  }

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

  // These will re-run when allBids or allAsks change
  $: bidRows = calculateCumulative(bidPriceLevels, allBids);
  $: askRows = calculateCumulative(askPriceLevels, allAsks);

  // Get max sizes for bar scaling
  $: maxBidSize = Math.max(...bidRows.map(r => r.size), 0.001);
  $: maxAskSize = Math.max(...askRows.map(r => r.size), 0.001);
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
          <span class="price">{formatPrice(row.price)}</span>
          <span class="quantity">{row.size.toFixed(8)}</span>
          <div class="size-bar ask-bar" style="width: {(row.size / maxAskSize) * 100}%"></div>
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
    height: 400px;
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
    grid-template-columns: auto 1fr;
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
    grid-template-columns: auto 1fr;
  }

  .quantity, .price {
    font-family: 'Monaco', monospace;
    font-size: 11px;
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