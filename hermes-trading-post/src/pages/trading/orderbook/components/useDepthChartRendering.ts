/**
 * @file useDepthChartRendering.ts
 * @description Chart rendering logic for LightweightCharts depth chart
 */
import { onMount, onDestroy } from 'svelte';
import { createChart, type IChartApi, type ISeriesApi, ColorType } from 'lightweight-charts';
import { orderbookStore } from '../stores/orderbookStore.svelte';
import { logger } from '../../../../services/logging';

export interface ChartHoverState {
  mouseX: number;
  mouseY: number;
  isHovering: boolean;
  hoverPrice: number;
  hoverVolume: number;
}

export function useDepthChartRendering(
  chartContainer: HTMLDivElement,
  onLevel2Message: (data: any) => void
) {
  let chart: IChartApi | null = null;
  let bidSeries: ISeriesApi<'Area'> | null = null;
  let askSeries: ISeriesApi<'Area'> | null = null;

  // Hover tracking state
  let hoverState = $state<ChartHoverState>({
    mouseX: 0,
    mouseY: 0,
    isHovering: false,
    hoverPrice: 0,
    hoverVolume: 0
  });

  // Chart update tracking
  let lastBidCount = 0;
  let lastAskCount = 0;
  let chartUpdateCount = 0;
  let updatePending = false;
  let hasPendingData = false;

  function initializeChart() {
    if (!chartContainer) return;

    chart = createChart(chartContainer, {
      layout: {
        background: { type: ColorType.Solid, color: '#1a1a1a' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      width: chartContainer.clientWidth,
      height: (chartContainer.clientHeight || 230) - 5,
      timeScale: {
        visible: false,
        borderVisible: false,
      },
      leftPriceScale: {
        visible: false,
      },
      localization: {
        priceFormatter: (price: number) => {
          if (price >= 1000000) {
            return `$${(price / 1000000).toFixed(1)}M`;
          } else if (price >= 1000) {
            return `$${Math.floor(price / 1000)}k`;
          }
          return `$${price.toFixed(0)}`;
        },
      },
      rightPriceScale: {
        visible: false,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          labelVisible: false,
          color: 'rgba(255, 255, 255, 0.3)',
          width: 1,
          style: 2,
        },
        horzLine: {
          labelVisible: false,
          color: 'rgba(255, 255, 255, 0.3)',
          width: 1,
          style: 2,
        },
      },
      watermark: {
        visible: false,
      },
    });

    // Create bid series (green)
    bidSeries = chart.addAreaSeries({
      topColor: 'rgba(38, 166, 154, 0.4)',
      bottomColor: 'rgba(38, 166, 154, 0.0)',
      lineColor: 'rgba(38, 166, 154, 1)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      priceScaleId: 'left',
      crosshairMarkerVisible: false,
      lineStyle: 0,
      lineType: 2,
    });

    // Create ask series (red)
    askSeries = chart.addAreaSeries({
      topColor: 'rgba(239, 83, 80, 0.4)',
      bottomColor: 'rgba(239, 83, 80, 0.0)',
      lineColor: 'rgba(239, 83, 80, 1)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      priceScaleId: 'left',
      crosshairMarkerVisible: false,
      lineStyle: 0,
      lineType: 2,
    });

    // Subscribe to crosshair movement
    chart.subscribeCrosshairMove((param) => {
      if (!param || param.point === undefined) {
        hoverState.isHovering = false;
        return;
      }

      const { x, y } = param.point;
      hoverState.mouseX = x;
      hoverState.mouseY = y;

      if (param.time !== undefined) {
        hoverState.hoverPrice = param.time as number;

        const depthData = orderbookStore.getDepthData(500);
        let foundVolume = 0;

        const bidPoint = depthData.bids.find(b => Math.abs(b.price - hoverState.hoverPrice) < 50);
        if (bidPoint) {
          foundVolume = bidPoint.depth;
        } else {
          const askPoint = depthData.asks.find(a => Math.abs(a.price - hoverState.hoverPrice) < 50);
          if (askPoint) {
            foundVolume = askPoint.depth;
          }
        }

        hoverState.hoverVolume = foundVolume;

        if (foundVolume > 0 && bidSeries && askSeries) {
          const useSeries = bidPoint ? bidSeries : askSeries;

          try {
            const yCoord = useSeries.priceToCoordinate(foundVolume);
            if (yCoord !== null) {
              hoverState.mouseY = yCoord;
            }
          } catch (error) {
            // Silently ignore coordinate conversion errors
          }
        }

        hoverState.isHovering = true;
      }
    });

    // Setup resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (chart && chartContainer) {
        const newWidth = chartContainer.clientWidth;
        const newHeight = (chartContainer.clientHeight || 230) - 5;

        chart.applyOptions({
          width: newWidth,
          height: newHeight,
        });

        const summary = orderbookStore.summary;
        if (summary.bestBid && summary.bestAsk) {
          const midPrice = (summary.bestBid + summary.bestAsk) / 2;
          const rangeMultiplier = Math.max(0.5, Math.min(1.5, newWidth / 500));
          const baseRange = 10000;
          const adjustedRange = baseRange * rangeMultiplier;

          chart.timeScale().setVisibleRange({
            from: (midPrice - adjustedRange) as any,
            to: (midPrice + adjustedRange) as any
          });
        }
      }
    });
    resizeObserver.observe(chartContainer);

    return () => {
      resizeObserver.disconnect();
    };
  }

  function updateChart() {
    if (!bidSeries || !askSeries) return;

    const { bids, asks } = orderbookStore.getDepthData(500);

    if (bids.length === 0 || asks.length === 0) {
      logger.warn('No depth data available yet', {}, 'DepthChartRendering');
      return;
    }

    const bidData = bids.map(level => ({
      time: level.price as any,
      value: level.depth
    }));

    const askData = asks.map(level => ({
      time: level.price as any,
      value: level.depth
    }));

    // Add gap in the middle
    if (bids.length > 0 && asks.length > 0) {
      const highestBidPrice = bids[bids.length - 1].price;
      const lowestAskPrice = asks[0].price;
      const spread = lowestAskPrice - highestBidPrice;
      const gapSize = spread * 0.30;

      bidData.push({
        time: (highestBidPrice + gapSize) as any,
        value: 0
      });

      askData.unshift({
        time: (lowestAskPrice - gapSize) as any,
        value: 0
      });
    }

    // Check if data changed
    const bidsChanged = bids.length !== lastBidCount ||
                       (bids.length > 0 && (bids[0].depth !== bidData[0]?.value));
    const asksChanged = asks.length !== lastAskCount ||
                       (asks.length > 0 && (asks[0].depth !== askData[0]?.value));

    if (bidsChanged || asksChanged) {
      chartUpdateCount++;

      bidSeries.setData(bidData);
      askSeries.setData(askData);

      lastBidCount = bids.length;
      lastAskCount = asks.length;
    }

    // Keep chart centered
    try {
      const summary = orderbookStore.summary;
      if (summary.bestBid && summary.bestAsk) {
        const midPrice = (summary.bestBid + summary.bestAsk) / 2;
        const chartWidth = chartContainer?.clientWidth || 500;
        const rangeMultiplier = Math.max(0.5, Math.min(1.5, chartWidth / 500));
        const baseRange = 10000;
        const adjustedRange = baseRange * rangeMultiplier;

        chart!.timeScale().setVisibleRange({
          from: (midPrice - adjustedRange) as any,
          to: (midPrice + adjustedRange) as any
        });
      }
    } catch (e) {
      try {
        chart!.timeScale().fitContent();
      } catch (e2) {
        // Ignore if chart not ready
      }
    }
  }

  function handleLevel2MessageWithBatching(data: any) {
    onLevel2Message(data);

    if (data.type === 'snapshot') {
      updateChart();
    } else if (data.type === 'update') {
      hasPendingData = true;

      if (!updatePending) {
        updatePending = true;
        requestAnimationFrame(() => {
          if (hasPendingData) {
            updateChart();
            hasPendingData = false;
          }
          updatePending = false;
        });
      }
    }
  }

  function handleMouseMove(event: MouseEvent) {
    if (!hoverState.isHovering && chartContainer) {
      const rect = chartContainer.getBoundingClientRect();
      hoverState.mouseX = event.clientX - rect.left;
      hoverState.mouseY = event.clientY - rect.top;
    }
  }

  function handleMouseLeave() {
    hoverState.isHovering = false;
  }

  function cleanup() {
    if (chart) {
      chart.remove();
      chart = null;
    }
    bidSeries = null;
    askSeries = null;
  }

  return {
    get hoverState() { return hoverState; },
    initializeChart,
    handleLevel2MessageWithBatching,
    handleMouseMove,
    handleMouseLeave,
    cleanup
  };
}
