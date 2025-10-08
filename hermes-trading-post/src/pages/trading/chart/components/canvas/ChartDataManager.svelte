<script lang="ts">
  import { type IChartApi, type ISeriesApi } from 'lightweight-charts';
  import { dataStore } from '../../stores/dataStore.svelte';
  import { chartStore } from '../../stores/chartStore.svelte';
  import { CHART_COLORS } from '../../utils/constants';
  
  // Props using Svelte 5 runes syntax  
  let {
    chart = $bindable(null),
    candleSeries = $bindable(null)
  }: {
    chart: IChartApi | null;
    candleSeries: ISeriesApi<'Candlestick'> | null;
  } = $props();
  
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
      console.log('🔍 updateChartData skipped:', { 
        hasCandleSeries: !!candleSeries, 
        candleCount: dataStore.candles.length 
      });
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
      
      // Sort by time and remove duplicates
      const sortedCandles = formattedCandles
        .sort((a, b) => (a.time as number) - (b.time as number))
        .filter((candle, index, array) => {
          // Keep only the first occurrence of each timestamp
          return index === 0 || candle.time !== array[index - 1].time;
        });
      
      console.log(`📊 [ChartDataManager] Setting ${sortedCandles.length} candles (from ${formattedCandles.length}) on chart series`);
      
      // Set the data on the chart series
      candleSeries.setData(sortedCandles);
      
      // Simple positioning after data is set
      setTimeout(() => {
        const chart = (candleSeries as any)?._chart || (candleSeries as any)?.chart;
        if (chart && formattedCandles.length > 1) {
          chart.timeScale().fitContent();
          console.log(`📊 [ChartDataManager] Chart updated with ${formattedCandles.length} candles`);
        }
      }, 100);
    } catch (error) {
      console.error('❌ [ChartDataManager] Error updating chart data:', error);
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