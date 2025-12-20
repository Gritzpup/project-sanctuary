/**
 * @file VolumeHotspotCalculator.ts
 * @description Calculate volume hotspot data for depth chart valley indicator
 */

export interface VolumeHotspot {
  bidVolume: number;
  askVolume: number;
  bidSupport: number;
  askResistance: number;
  volumeRatio: number;
  price: number;
  spread: number;
  offset: number;
  side: 'bullish' | 'bearish' | 'neutral';
  type: string;
  volume: number;
}

export function calculateVolumeHotspot(summary: any): VolumeHotspot {
  if (!summary.bestBid || !summary.bestAsk) {
    return {
      bidVolume: 0,
      askVolume: 0,
      bidSupport: 0,
      askResistance: 0,
      volumeRatio: 0.5,
      price: 0,
      spread: 0,
      offset: 50,
      side: 'neutral',
      type: 'Neutral',
      volume: 0
    };
  }

  const spread = summary.bestAsk - summary.bestBid;
  const midPrice = (summary.bestBid + summary.bestAsk) / 2;
  const bidVolume = summary.bidVolume || 0;
  const askVolume = summary.askVolume || 0;

  return {
    bidVolume,
    askVolume,
    bidSupport: summary.bestBid,
    askResistance: summary.bestAsk,
    volumeRatio: 0.5,
    price: midPrice,
    spread,
    offset: 50,
    side: bidVolume > askVolume ? 'bullish' :
          askVolume > bidVolume ? 'bearish' : 'neutral',
    type: bidVolume > askVolume ? 'Support' :
          askVolume > bidVolume ? 'Resistance' : 'Neutral',
    volume: Math.max(bidVolume, askVolume)
  };
}

export function calculateVolumeRange(depthData: any) {
  const maxDepth = Math.max(
    ...depthData.bids.map((d: any) => d.depth),
    ...depthData.asks.map((d: any) => d.depth),
    0
  );

  return [
    { position: 100, value: 0 },
    { position: 50, value: maxDepth / 2 },
    { position: 0, value: maxDepth }
  ];
}

export function calculatePriceRange(currentPrice: number) {
  return {
    left: currentPrice - 25000,  // Match the depth chart range
    center: currentPrice,
    right: currentPrice + 25000   // Match the depth chart range
  };
}