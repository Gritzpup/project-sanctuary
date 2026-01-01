/**
 * Chart integration utilities for Paper Trading
 */

export class ChartIntegration {
  public static updateChartMarkers(chartComponent: any, trades: any[], activeBotId?: string) {
    if (!chartComponent || !trades.length) return;

    try {
      // Filter trades by active bot if specified
      const filteredTrades = activeBotId
        ? trades.filter(trade => trade.botId === activeBotId)
        : trades;

      if (!filteredTrades.length) {
        // Clear markers if no trades for this bot
        if (chartComponent.clearMarkers) {
          chartComponent.clearMarkers();
        }
        return;
      }

      // Create markers from filtered trades
      const markers = filteredTrades.map(trade => {
        const quantity = trade.quantity || trade.amount || 0;
        const price = trade.price || 0;
        const side = trade.side || 'unknown';
        
        return {
          time: Math.floor(new Date(trade.timestamp).getTime() / 1000),
          position: side === 'buy' ? 'belowBar' : 'aboveBar',
          color: side === 'buy' ? '#26a69a' : '#ef5350',
          shape: side === 'buy' ? 'arrowUp' : 'arrowDown',
          text: side.toUpperCase()
        };
      });
      
      // Update chart with markers
      if (chartComponent.clearMarkers && chartComponent.addMarkers) {
        chartComponent.clearMarkers();
        chartComponent.addMarkers(markers);
      }
      
      // Chart markers updated
    } catch (error) {
    }
  }

  public static clearChartMarkers(chartComponent: any) {
    if (chartComponent && chartComponent.clearMarkers) {
      chartComponent.clearMarkers();
    }
  }
}