/**
 * Chart integration utilities for Paper Trading
 */

export class ChartIntegration {
  public static updateChartMarkers(chartComponent: any, trades: any[]) {
    if (!chartComponent || !trades.length) return;
    
    try {
      // Create markers from trades
      const markers = trades.map(trade => {
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
      
      console.log(`📍 Updated chart with ${markers.length} trade markers`);
    } catch (error) {
      console.error('❌ Failed to update chart markers:', error);
    }
  }

  public static clearChartMarkers(chartComponent: any) {
    if (chartComponent && chartComponent.clearMarkers) {
      chartComponent.clearMarkers();
    }
  }
}