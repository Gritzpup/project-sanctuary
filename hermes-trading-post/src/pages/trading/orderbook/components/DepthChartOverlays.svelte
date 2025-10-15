<script lang="ts">
  /**
   * @file DepthChartOverlays.svelte
   * @description UI overlays for depth chart (hover, hotspot, price/volume gauges)
   */

  interface Props {
    isHovering: boolean;
    mouseX: number;
    mouseY: number;
    hoverPrice: number;
    hoverVolume: number;
    volumeHotspot: {
      offset: number;
      price: number;
      side: string;
      volume: number;
      type?: string;
    };
    volumeRange: Array<{ position: number; value: number }>;
    priceRange: { left: number; center: number; right: number };
  }

  let {
    isHovering,
    mouseX,
    mouseY,
    hoverPrice,
    hoverVolume,
    volumeHotspot,
    volumeRange,
    priceRange
  }: Props = $props();

  function formatPrice(price: number): string {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
    if (price >= 1000) return `$${(price / 1000).toFixed(1)}k`;
    return `$${price.toFixed(0)}`;
  }

  function formatVolume(volume: number): string {
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}k`;
    return volume.toFixed(1);
  }
</script>

<!-- Mid price indicator line -->
<div class="mid-price-line"></div>

<!-- Dynamic volume hotspot indicator -->
<div class="valley-indicator valley-{volumeHotspot.side}" style="left: {volumeHotspot.offset}%">
  <div class="valley-price-label">
    <span class="price-type">{volumeHotspot.type}</span>
    <span class="price-value">${Math.floor(volumeHotspot.price).toLocaleString('en-US')}</span>
    <span class="volume-value">{volumeHotspot.volume.toFixed(2)} BTC</span>
  </div>
  <div class="valley-point"></div>
  <div class="valley-line"></div>
</div>

<!-- Hover overlay -->
{#if isHovering}
  <div class="hover-overlay" style="left: {mouseX}px">
    <div class="hover-line"></div>
    <div class="hover-circle" style="top: {mouseY}px"></div>
    <div class="hover-price-label">
      <span class="hover-price">${Math.floor(hoverPrice).toLocaleString('en-US')}</span>
      {#if hoverVolume > 0}
        <span class="hover-volume">{hoverVolume.toFixed(3)} BTC</span>
      {/if}
    </div>
  </div>
{/if}

<!-- Custom volume gauge overlay (left side) -->
<div class="volume-gauge-overlay">
  {#each volumeRange as item}
    <div class="volume-label" style="top: {100 - item.position}%">
      {formatVolume(item.value)}
    </div>
  {/each}
</div>

<!-- Custom price gauge overlay (bottom) -->
<div class="price-gauge-overlay">
  <div class="price-label" style="left: 10%">
    {formatPrice(priceRange.left)}
  </div>
  <div class="price-label price-label-center" style="left: 50%">
    {formatPrice(priceRange.center)}
  </div>
  <div class="price-label" style="left: 90%">
    {formatPrice(priceRange.right)}
  </div>
</div>

<style>
  /* Mid-price vertical line */
  .mid-price-line {
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 2px;
    background: rgba(255, 255, 255, 0.1);
    transform: translateX(-50%);
    pointer-events: none;
    z-index: 99;
  }

  /* Hover overlay */
  .hover-overlay {
    position: absolute;
    top: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 102;
    transform: translateX(-1px);
  }

  .hover-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgba(255, 255, 255, 0.5);
    box-shadow: 0 0 4px rgba(255, 255, 255, 0.3);
  }

  .hover-circle {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: white;
    border: 2px solid #a78bfa;
    transform: translate(-50%, -50%);
    left: 0;
    box-shadow: 0 0 6px rgba(167, 139, 250, 0.8);
  }

  .hover-price-label {
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid rgba(167, 139, 250, 0.5);
    border-radius: 4px;
    padding: 4px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 11px;
    white-space: nowrap;
    color: white;
  }

  .hover-price {
    font-weight: 700;
    font-size: 12px;
    color: #a78bfa;
  }

  .hover-volume {
    font-size: 10px;
    opacity: 0.8;
  }

  /* Dynamic valley indicator */
  .valley-indicator {
    position: absolute;
    bottom: 0;
    height: 100%;
    transform: translateX(-50%);
    transition: left 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    pointer-events: none;
    z-index: 100;
  }

  .valley-price-label {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid currentColor;
    border-radius: 6px;
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 11px;
    white-space: nowrap;
    z-index: 101;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }

  .valley-price-label .price-type {
    font-size: 9px;
    opacity: 0.8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }

  .valley-price-label .price-value {
    font-weight: 700;
    font-size: 12px;
    margin-bottom: 2px;
  }

  .valley-price-label .volume-value {
    font-size: 10px;
    opacity: 0.9;
  }

  .valley-point {
    position: absolute;
    bottom: -2px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 12px solid #a78bfa;
    filter: drop-shadow(0 0 6px rgba(167, 139, 250, 1));
    animation: valleyPulse 2s ease-in-out infinite;
  }

  .valley-line {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    width: 2px;
    height: calc(100% - 15px);
    background: linear-gradient(180deg,
      transparent 0%,
      rgba(167, 139, 250, 0.2) 30%,
      rgba(167, 139, 250, 0.5) 100%
    );
  }

  @keyframes valleyPulse {
    0%, 100% {
      opacity: 0.7;
      transform: translateX(-50%) translateY(0);
    }
    50% {
      opacity: 1;
      transform: translateX(-50%) translateY(-3px);
    }
  }

  /* Volume hotspot color variations */
  .valley-bullish .valley-point {
    border-top-color: #26a69a;
    filter: drop-shadow(0 0 6px rgba(38, 166, 154, 1));
  }

  .valley-bullish .valley-line {
    background: linear-gradient(180deg,
      transparent 0%,
      rgba(38, 166, 154, 0.2) 30%,
      rgba(38, 166, 154, 0.5) 100%
    );
  }

  .valley-bullish .valley-price-label {
    color: #26a69a;
    border-color: rgba(38, 166, 154, 0.5);
    background: rgba(0, 0, 0, 0.95);
  }

  .valley-bearish .valley-point {
    border-top-color: #ef5350;
    filter: drop-shadow(0 0 6px rgba(239, 83, 80, 1));
  }

  .valley-bearish .valley-line {
    background: linear-gradient(180deg,
      transparent 0%,
      rgba(239, 83, 80, 0.2) 30%,
      rgba(239, 83, 80, 0.5) 100%
    );
  }

  .valley-bearish .valley-price-label {
    color: #ef5350;
    border-color: rgba(239, 83, 80, 0.5);
    background: rgba(0, 0, 0, 0.95);
  }

  .valley-neutral .valley-point {
    border-top-color: #a78bfa;
    filter: drop-shadow(0 0 6px rgba(167, 139, 250, 1));
  }

  .valley-neutral .valley-line {
    background: linear-gradient(180deg,
      transparent 0%,
      rgba(167, 139, 250, 0.2) 30%,
      rgba(167, 139, 250, 0.5) 100%
    );
  }

  .valley-neutral .valley-price-label {
    color: #a78bfa;
    border-color: rgba(167, 139, 250, 0.5);
    background: rgba(0, 0, 0, 0.95);
  }

  /* Custom volume gauge overlay */
  .volume-gauge-overlay {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 60px;
    pointer-events: none;
    z-index: 100;
    display: flex;
    flex-direction: column;
  }

  .volume-label {
    position: absolute;
    left: 0;
    color: #ffffff;
    font-size: 10px;
    font-weight: 600;
    text-shadow:
      0 0 3px rgba(0, 0, 0, 1),
      0 0 5px rgba(0, 0, 0, 0.8),
      0 0 8px rgba(0, 0, 0, 0.6);
    transform: translateY(-50%);
    line-height: 1;
    transition: top 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                opacity 0.2s ease-out;
  }

  .volume-label-center {
    color: rgba(255, 255, 255, 0.5);
    font-size: 9px;
  }

  /* Custom price gauge overlay */
  .price-gauge-overlay {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 15px;
    pointer-events: none;
    z-index: 100;
    display: flex;
    justify-content: space-between;
  }

  .price-label {
    position: absolute;
    bottom: 0;
    color: #ffffff;
    font-size: 11px;
    font-weight: 600;
    text-shadow:
      0 0 3px rgba(0, 0, 0, 1),
      0 0 5px rgba(0, 0, 0, 0.8),
      0 0 8px rgba(0, 0, 0, 0.6);
    transform: translateX(-50%);
    line-height: 1;
    transition: opacity 0.15s ease-out,
                color 0.15s ease-out;
  }

  .price-label-center {
    color: #a78bfa;
    font-weight: 700;
  }
</style>
