<script lang="ts">
  import { createChart, type IChartApi } from 'lightweight-charts';
  import { chartStore } from '../../stores/chartStore.svelte';
  import { dataStore } from '../../stores/dataStore.svelte';
  import { CHART_COLORS } from '../../utils/constants';
  
  // Props using Svelte 5 runes syntax
  const {
    container,
    width = undefined,
    height = undefined
  }: {
    container: HTMLDivElement;
    width?: number;
    height?: number;
  } = $props();
  
  // Check if we have a small dataset (5m chart case) - but never for 1m charts
  const isSmallDataset = $derived(dataStore.candles.length <= 30 && dataStore.candles.length > 0 && chartStore.config.granularity !== '1m');

  // Reactive chart options based on store
  const chartOptions = $derived({
    layout: {
      background: { 
        color: CHART_COLORS[chartStore.config.theme.toUpperCase()].background 
      },
      textColor: CHART_COLORS[chartStore.config.theme.toUpperCase()].textColor,
    },
    grid: {
      vertLines: { 
        color: CHART_COLORS[chartStore.config.theme.toUpperCase()].gridLines,
        style: 1,
        visible: chartStore.config.showGrid,
      },
      horzLines: { 
        color: CHART_COLORS[chartStore.config.theme.toUpperCase()].gridLines,
        style: 1,
        visible: chartStore.config.showGrid,
      },
    },
    rightPriceScale: {
      borderColor: CHART_COLORS[chartStore.config.theme.toUpperCase()].borderColor,
      visible: true,
      scaleMargins: {
        top: 0.1,
        bottom: 0.1,
      },
    },
    timeScale: {
      borderColor: CHART_COLORS[chartStore.config.theme.toUpperCase()].borderColor,
      timeVisible: true,
      secondsVisible: false,
      visible: true,
      ticksVisible: true,
      fixLeftEdge: false,
      fixRightEdge: false,
      lockVisibleTimeRangeOnResize: false,
      rightBarStaysOnScroll: !isSmallDataset, // Disable for small datasets
      borderVisible: true,
      shiftVisibleRangeOnNewBar: !isSmallDataset, // Disable auto-scrolling for small datasets
      rightOffset: isSmallDataset ? 0 : 3, // Minimal right offset for maximum chart utilization
      leftOffset: 3, // Adjust for price scale to center chart properly
      barSpacing: isSmallDataset ? 50 : 13, // Close to 60-candle view (800px/60 ≈ 13px)
      minBarSpacing: 0.5,
    },
    crosshair: {
      mode: 0,
      vertLine: {
        color: CHART_COLORS[chartStore.config.theme.toUpperCase()].crosshair,
        width: 1,
        style: 3,
        visible: true,
        labelVisible: true,
      },
      horzLine: {
        color: CHART_COLORS[chartStore.config.theme.toUpperCase()].crosshair,
        width: 1,
        style: 3,
        visible: true,
        labelVisible: true,
      },
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: true,
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true,
    },
  });
  
  export function createChartInstance(): IChartApi | null {
    if (!container) {
      console.error('Container not available for chart creation');
      return null;
    }
    
    try {
      const containerWidth = width || container.clientWidth;
      const containerHeight = height || container.clientHeight || 500;
      
      
      const chartInstance = createChart(container, {
        ...chartOptions,
        width: containerWidth,
        height: containerHeight,
      });
      
      return chartInstance;
    } catch (error) {
      console.error('❌ Error creating chart:', error);
      return null;
    }
  }
</script>