<script lang="ts">
  /**
   * @file OrderbookList.svelte
   * @description Orderbook bid/ask list display component
   */

  import type { OrderbookLevel } from './useDepthChartData';
  import { FastNumberFormatter } from '../../../utils/shared/Formatters';

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
</script>

<div class="orderbook-list">
  <div class="orderbook-side bids">
    <div class="orderbook-header">
      <span>Quantity</span>
      <span>Buy Price</span>
    </div>
    <div class="orderbook-rows">
      {#each bidsWithCumulative as bid, i (bid.key)}
        <div class="orderbook-row bid-row"
             class:top-order={i === 0}
             style="--volume-width: {(bid.size / maxBidSize * 100)}%"
             data-price={bid.price}>
          <div class="volume-bar bid-bar"></div>
          <span class="quantity">{bid.cumulative.toFixed(5)}</span>
          <span class="price">{FastNumberFormatter.formatPrice(Math.floor(bid.price))}</span>
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
      {#each asksWithCumulative as ask, i (ask.key)}
        <div class="orderbook-row ask-row"
             class:top-order={i === 0}
             style="--volume-width: {(ask.size / maxAskSize * 100)}%"
             data-price={ask.price}>
          <div class="volume-bar ask-bar"></div>
          <span class="price">{FastNumberFormatter.formatPrice(Math.floor(ask.price))}</span>
          <span class="quantity">{ask.cumulative.toFixed(5)}</span>
        </div>
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

  .orderbook-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 8px;
    font-size: 10px;
    font-family: 'Monaco', 'Courier New', monospace;
    position: relative;
    border-radius: 3px;
    will-change: transform, opacity;
    transition: transform 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                opacity 0.1s ease-out,
                background-color 0.1s ease-out;
    transform: translateY(0);
  }

  .orderbook-row:nth-child(1) { animation-delay: calc(0 * var(--stagger-delay)); }
  .orderbook-row:nth-child(2) { animation-delay: calc(1 * var(--stagger-delay)); }
  .orderbook-row:nth-child(3) { animation-delay: calc(2 * var(--stagger-delay)); }
  .orderbook-row:nth-child(4) { animation-delay: calc(3 * var(--stagger-delay)); }
  .orderbook-row:nth-child(5) { animation-delay: calc(4 * var(--stagger-delay)); }
  .orderbook-row:nth-child(6) { animation-delay: calc(5 * var(--stagger-delay)); }
  .orderbook-row:nth-child(7) { animation-delay: calc(6 * var(--stagger-delay)); }
  .orderbook-row:nth-child(8) { animation-delay: calc(7 * var(--stagger-delay)); }
  .orderbook-row:nth-child(9) { animation-delay: calc(8 * var(--stagger-delay)); }
  .orderbook-row:nth-child(10) { animation-delay: calc(9 * var(--stagger-delay)); }
  .orderbook-row:nth-child(11) { animation-delay: calc(10 * var(--stagger-delay)); }
  .orderbook-row:nth-child(12) { animation-delay: calc(11 * var(--stagger-delay)); }

  .volume-bar {
    position: absolute;
    top: 0;
    bottom: 0;
    width: var(--volume-width);
    z-index: 0;
    opacity: 0.15;
    will-change: width;
    transition: width 0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  .orderbook-row .quantity,
  .orderbook-row .price {
    position: relative;
    z-index: 1;
    transition: all 0.1s ease-out;
    user-select: none;
  }

  @keyframes valueChange {
    0% { text-shadow: 0 0 0 transparent; }
    50% { text-shadow: 0 0 8px rgba(255, 255, 255, 0.3); }
    100% { text-shadow: 0 0 0 transparent; }
  }

  .bid-bar {
    right: 0;
    background: rgba(38, 166, 154, 0.6);
  }

  .ask-bar {
    left: 0;
    background: rgba(239, 83, 80, 0.6);
  }

  .bid-row {
    background: rgba(38, 166, 154, 0.1);
  }

  .bid-row .price {
    color: rgba(38, 166, 154, 1);
    font-weight: 600;
    position: relative;
    z-index: 1;
  }

  .bid-row .quantity {
    position: relative;
    z-index: 1;
  }

  .ask-row {
    background: rgba(239, 83, 80, 0.1);
  }

  .ask-row .price {
    color: rgba(239, 83, 80, 1);
    font-weight: 600;
    position: relative;
    z-index: 1;
  }

  .ask-row .quantity {
    position: relative;
    z-index: 1;
  }

  .orderbook-row .quantity {
    color: #9ca3af;
  }

  .top-order {
    font-size: 13px !important;
    padding: 4px 8px !important;
  }

  .top-order .price {
    font-weight: 700 !important;
  }

  .top-order .quantity {
    color: #ffffff !important;
  }

  @media (max-width: 768px) {
    .orderbook-list {
      grid-template-columns: 1fr;
    }
  }
</style>
