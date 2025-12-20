<script lang="ts">
  // This component provides the two-column layout for chart and controls
</script>

<div class="panels-row">
  <slot name="chart" />
  <slot name="controls" />
</div>

<style>
  /* Mobile-first design: Default flex layout */
  .panels-row {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    min-width: 0;
    align-items: stretch;
  }

  /* Chart and controls containers */
  .panels-row > :global(.chart-container) {
    width: 100%;
    min-width: 0;
    height: 500px; /* Default height */
    order: 1;
    overflow: hidden;
    position: relative;
  }

  .panels-row > :global(.strategy-container),
  .panels-row > :global(:not(.chart-container)) {
    width: 100%;
    min-width: 0;
    height: auto;
    order: 2;
    margin-top: 0;
  }

  /* Desktop enhancement: 2-column layout for larger screens */
  @media (min-width: 769px) {
    .panels-row {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
    }

    .panels-row > :global(.chart-container) {
      grid-column: 1;
      grid-row: 1;
      height: 600px;
      order: unset;
    }

    .panels-row > :global(.strategy-container),
    .panels-row > :global(:not(.chart-container)) {
      grid-column: 2;
      grid-row: 1;
      height: 600px;
      order: unset;
      margin-top: unset;
    }
  }

  /* Mobile-specific adjustments */
  @media (max-width: 768px) {
    .panels-row > :global(.chart-container) {
      height: 650px; /* 50px taller than 600px */
      min-height: 500px;
    }

    .panels-row > :global(.strategy-container),
    .panels-row > :global(:not(.chart-container)) {
      min-height: 200px;
    }
  }

  /* Tablet responsive layout - adjust grid ratio */
  @media (min-width: 769px) and (max-width: 1024px) {
    .panels-row {
      grid-template-columns: 1.5fr 1fr;
    }
  }
</style>