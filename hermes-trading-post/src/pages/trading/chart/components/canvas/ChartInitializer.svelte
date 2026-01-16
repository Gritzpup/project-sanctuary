<script lang="ts">
  import { createChart, type IChartApi } from 'lightweight-charts';
  import { chartStore } from '../../stores/chartStore.svelte';
  import { dataStore } from '../../stores/dataStore.svelte';
  import { CHART_COLORS } from '../../utils/constants';

  // Type for theme keys
  type ThemeKey = keyof typeof CHART_COLORS;

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

  // Get theme colors safely
  const getThemeColors = () => {
    const themeKey = chartStore.config.theme.toUpperCase() as ThemeKey;
    return CHART_COLORS[themeKey] ?? CHART_COLORS.DARK;
  };

  // Reactive chart options based on store
  const chartOptions = $derived.by(() => {
    const colors = getThemeColors();
    return {
      layout: {
        background: { color: colors.background },
        textColor: colors.textColor,
      },
      grid: {
        vertLines: {
          color: colors.gridLines,
          style: 1,
          visible: chartStore.config.showGrid,
        },
        horzLines: {
          color: colors.gridLines,
          style: 1,
          visible: chartStore.config.showGrid,
        },
      },
      rightPriceScale: {
        borderColor: colors.borderColor,
        visible: true,
        autoScale: true,  // CRITICAL: Auto-scale price axis when candles exceed visible range
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: colors.borderColor,
        timeVisible: true,
        secondsVisible: false,
        visible: true,
        ticksVisible: true,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: false,
        rightBarStaysOnScroll: !isSmallDataset,
        borderVisible: true,
        shiftVisibleRangeOnNewBar: !isSmallDataset,
        rightOffset: isSmallDataset ? 0 : 3,
        leftOffset: 3,
        barSpacing: isSmallDataset ? 50 : 13,
        minBarSpacing: 0.5,
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: colors.crosshair,
          width: 1 as const,
          style: 3,
          visible: true,
          labelVisible: true,
        },
        horzLine: {
          color: colors.crosshair,
          width: 1 as const,
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
  });
  
  export function createChartInstance(): IChartApi | null {
    if (!container) {
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
      return null;
    }
  }
</script>