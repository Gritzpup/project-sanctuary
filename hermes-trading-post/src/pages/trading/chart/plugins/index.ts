// Base classes
export { Plugin, type PluginConfig, type PluginContext } from './base/Plugin';
export { PluginManager, type PluginEvent } from './base/PluginManager';

// Series plugins
export { SeriesPlugin, type SeriesPluginConfig } from './series/SeriesPlugin';
export { VolumePlugin, type VolumePluginSettings } from './series/VolumePlugin';

// Indicator plugins
export { IndicatorPlugin, type IndicatorSettings } from './indicators/IndicatorPlugin';
export { SMAPlugin, type SMASettings } from './indicators/SMAPlugin';
export { EMAPlugin, type EMASettings } from './indicators/EMAPlugin';
export { RSIPlugin, type RSISettings } from './indicators/RSIPlugin';

// Primitive plugins
export { PrimitivePlugin, type PrimitivePluginConfig } from './primitives/PrimitivePlugin';
export { OrderLinePlugin, type Order, type OrderLineSettings } from './primitives/OrderLinePlugin';
export { PositionMarkerPlugin, type Position, type PositionMarkerSettings } from './primitives/PositionMarkerPlugin';

// Plugin factory helper
export function createPlugin(type: string, settings?: Record<string, any>): Plugin | null {
  switch (type) {
    case 'volume':
      return new VolumePlugin(settings);
    case 'sma':
      return new SMAPlugin(settings);
    case 'ema':
      return new EMAPlugin(settings);
    case 'rsi':
      return new RSIPlugin(settings);
    case 'orderLines':
      return new OrderLinePlugin(settings);
    case 'positionMarkers':
      return new PositionMarkerPlugin(settings);
    default:
      return null;
  }
}