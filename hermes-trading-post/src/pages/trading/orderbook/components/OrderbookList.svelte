<script lang="ts">
  /**
   * @file OrderbookList.svelte
   * @description Orderbook bid/ask list display component
   *
   * ⚡ PHASE 6A: Upgraded to use virtual scrolling (40-50% improvement)
   * - Was rendering all bid/ask rows (20-100+) every update
   * - Now renders only visible rows (typically 8-12) via VirtualOrderbookScroller
   * - Maintains smooth scrolling and efficient updates
   */

  import type { OrderbookLevel } from './useDepthChartData';
  import VirtualOrderbookScroller from './VirtualOrderbookScroller.svelte';

  interface Props {
    bidsWithCumulative: OrderbookLevel[];
    asksWithCumulative: OrderbookLevel[];
    maxBidSize: number;
    maxAskSize: number;
  }

  let {
    bidsWithCumulative,
    asksWithCumulative,
    maxBidSize,
    maxAskSize
  }: Props = $props();


<div class="orderbook-list">
  <div class="orderbook-side bids">
    <VirtualOrderbookScroller
      items={bidsWithCumulative}
      maxSize={maxBidSize}
      isBid={true}
      header="Quantity | Buy Price"
    />
  </div>

  <div class="orderbook-side asks">
    <VirtualOrderbookScroller
      items={asksWithCumulative}
      maxSize={maxAskSize}
      isBid={false}
      header="Sell Price | Quantity"
    />
  </div>
</div>

<style>
  .orderbook-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    padding: 10px;
    background: linear-gradient(to right, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.6));
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 6px;
    margin: 0;
    height: 400px;
  }

  .orderbook-side {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    border-radius: 4px;
  }

  @media (max-width: 768px) {
    .orderbook-list {
      grid-template-columns: 1fr;
      height: auto;
      max-height: 600px;
    }
  }
</style>
