<script lang="ts">
  import { createChart, type IChartApi } from 'lightweight-charts';
  import { chartStore } from '../../stores/chartStore.svelte';
  import { CHART_COLORS } from '../../utils/constants';
  
  export let container: HTMLDivElement;
  export let width: number | undefined = undefined;
  export let height: number | undefined = undefined;
  
  // Reactive chart options based on store
  $: chartOptions = {
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
      rightBarStaysOnScroll: true,
      borderVisible: true,
      shiftVisibleRangeOnNewBar: true, // Enable auto-scrolling for new candles
      rightOffset: 12, // Keep new candles visible
      leftOffset: 0,
      barSpacing: 12,
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
  };
  
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