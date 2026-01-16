// Base classes
import { Plugin, type PluginConfig, type PluginContext } from './base/Plugin';
import { PluginManager, type PluginEvent } from './base/PluginManager';
export { Plugin, type PluginConfig, type PluginContext };
export { PluginManager, type PluginEvent };

// Series plugins
import { SeriesPlugin, type SeriesPluginConfig } from './series/SeriesPlugin';
import { VolumePlugin, type VolumePluginSettings } from './series/VolumePlugin';
export { SeriesPlugin, type SeriesPluginConfig };
export { VolumePlugin, type VolumePluginSettings };

// Indicator plugins
import { IndicatorPlugin, type IndicatorSettings } from './indicators/IndicatorPlugin';
import { SMAPlugin, type SMASettings } from './indicators/SMAPlugin';
import { EMAPlugin, type EMASettings } from './indicators/EMAPlugin';
import { RSIPlugin, type RSISettings } from './indicators/RSIPlugin';
export { IndicatorPlugin, type IndicatorSettings };
export { SMAPlugin, type SMASettings };
export { EMAPlugin, type EMASettings };
export { RSIPlugin, type RSISettings };

// Primitive plugins
import { PrimitivePlugin, type PrimitivePluginConfig } from './primitives/PrimitivePlugin';
import { OrderLinePlugin, type Order, type OrderLineSettings } from './primitives/OrderLinePlugin';
import { PositionMarkerPlugin, type Position, type PositionMarkerSettings } from './primitives/PositionMarkerPlugin';
export { PrimitivePlugin, type PrimitivePluginConfig };
export { OrderLinePlugin, type Order, type OrderLineSettings };
export { PositionMarkerPlugin, type Position, type PositionMarkerSettings };

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