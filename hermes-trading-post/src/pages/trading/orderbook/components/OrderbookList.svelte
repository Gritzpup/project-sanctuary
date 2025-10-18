<script lang="ts">
  /**
   * @file OrderbookList.svelte
   * @description Orderbook bid/ask list display component
   */

  import type { OrderbookLevel } from './useDepthChartData';
  import OrderbookRow from './OrderbookRow.svelte';

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
    <div class="orderbook-header">
      <span>Quantity</span>
      <span>Buy Price</span>
    </div>
    <div class="orderbook-rows">
      {#each bidsWithCumulative as bid, i (bid.key)}
        <OrderbookRow
          level={bid}
          maxSize={maxBidSize}
          isTopOrder={i === 0}
          isBid={true}
        />
      {/each}
    </div>
  </div>

  <div class="orderbook-side asks">
    <div class="orderbook-header">
      <span>Sell Price</span>
      <span>Quantity</span>
    </div>
    <div class="orderbook-rows">
      {#each asksWithCumulative as ask, i (ask.key)}
        <OrderbookRow
          level={ask}
          maxSize={maxAskSize}
          isTopOrder={i === 0}
          isBid={false}
        />
      {/each}
    </div>
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
  }

  .orderbook-side {
    display: flex;
    flex-direction: column;
  }

  .orderbook-header {
    display: flex;
    justify-content: space-between;
    padding: 6px 8px;
    font-size: 11px;
    font-weight: 600;
    color: #c4b5fd;
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
    margin-bottom: 6px;
  }

  .orderbook-rows {
    display: flex;
    flex-direction: column;
    gap: 2px;
    --stagger-delay: 0.02s;
  }

  @media (max-width: 768px) {
    .orderbook-list {
      grid-template-columns: 1fr;
    }
  }
</style>
