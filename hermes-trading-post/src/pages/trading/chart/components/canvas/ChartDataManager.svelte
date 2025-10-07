<script lang="ts">
  import { type IChartApi, type ISeriesApi } from 'lightweight-charts';
  import { dataStore } from '../../stores/dataStore.svelte';
  import { CHART_COLORS } from '../../utils/constants';
  
  export let chart: IChartApi | null = null;
  export let candleSeries: ISeriesApi<'Candlestick'> | null = null;
  
  export function setupSeries() {
    if (!chart) {
      console.error('Chart not available for series setup');
      return false;
    }
    
    try {
      // Create candlestick series
      candleSeries = chart.addCandlestickSeries({
        upColor: CHART_COLORS.DARK.candleUp,
        downColor: CHART_COLORS.DARK.candleDown,
        borderUpColor: CHART_COLORS.DARK.candleUp,
        borderDownColor: CHART_COLORS.DARK.candleDown,
        wickUpColor: CHART_COLORS.DARK.candleUp,
        wickDownColor: CHART_COLORS.DARK.candleDown,
      });
      
      // NOTE: Volume series will be handled by VolumePlugin, not here
      // The old volume series creation is commented out to avoid conflicts
      
      return true;
    } catch (error) {
      console.error('❌ Error creating series:', error);
      return false;
    }
  }
  
  export function updateChartData() {
    if (!candleSeries || !dataStore.candles.length) {
      return;
    }
    
    try {
      const formattedCandles = dataStore.candles.map(candle => ({
        time: candle.time as any,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));
      
      candleSeries.setData(formattedCandles);
    } catch (error) {
      console.error('❌ Error updating chart data:', error);
    }
  }
  
  export function updateVolumeData() {
    // Volume data is now handled by VolumePlugin
    return;
  }
  
  export function handleRealtimeUpdate(candle: any) {
    if (!candleSeries) return;
    
    try {
      const formattedCandle = {
        time: candle.time as any,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      };
      
      candleSeries.update(formattedCandle);
      
      // Volume updates are handled by VolumePlugin
    } catch (error) {
      console.error('❌ Error updating realtime data:', error);
    }
  }
</script>