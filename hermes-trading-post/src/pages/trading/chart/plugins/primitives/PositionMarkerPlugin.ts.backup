import { PrimitivePlugin } from './PrimitivePlugin';
import type { SeriesMarker, Time } from 'lightweight-charts';
import { formatPnL } from '../../../../../utils/formatters/priceFormatters';

export interface Position {
  id: string;
  type: 'long' | 'short';
  entryPrice: number;
  entryTime: Time;
  exitPrice?: number;
  exitTime?: Time;
  quantity: number;
  pnl?: number;
  status: 'open' | 'closed';
}

export interface PositionMarkerSettings {
  entryLongColor?: string;
  entryShortColor?: string;
  exitProfitColor?: string;
  exitLossColor?: string;
  markerSize?: number;
  showPnL?: boolean;
  showQuantity?: boolean;
}

export class PositionMarkerPlugin extends PrimitivePlugin {
  private positions: Map<string, Position> = new Map();
  private positionUpdateCallback: (() => void) | null = null;

  constructor(settings?: PositionMarkerSettings) {
    const defaultSettings: PositionMarkerSettings = {
      entryLongColor: '#26a69a',
      entryShortColor: '#ef5350',
      exitProfitColor: '#4caf50',
      exitLossColor: '#f44336',
      markerSize: 1,
      showPnL: true,
      showQuantity: false
    };

    super({
      id: 'position-markers',
      name: 'Position Markers',
      description: 'Displays entry and exit points for trading positions',
      version: '1.0.0',
      settings: { ...defaultSettings, ...settings }
    });
  }

  protected async setupPrimitives(): Promise<void> {
    console.log(`${this.id}: Ready to display position markers`);
  }

  protected subscribeToUpdates(): void {
    // In a real implementation, subscribe to position updates
    // this.positionUpdateCallback = positionService.subscribe((positions) => {
    //   this.updatePositions(positions);
    // });
  }

  protected unsubscribeFromUpdates(): void {
    if (this.positionUpdateCallback) {
      this.positionUpdateCallback = null;
    }
  }

  protected updatePrimitives(): void {
    // Clear existing markers
    this.primitives.clear();
    
    // Create markers for all positions
    const markers: SeriesMarker<Time>[] = [];
    
    this.positions.forEach(position => {
      // Entry marker
      const entryMarker = this.createEntryMarker(position);
      if (entryMarker) {
        markers.push(entryMarker);
      }
      
      // Exit marker (if position is closed)
      if (position.status === 'closed' && position.exitTime && position.exitPrice) {
        const exitMarker = this.createExitMarker(position);
        if (exitMarker) {
          markers.push(exitMarker);
        }
      }
    });
    
    // Store all markers
    markers.forEach((marker, index) => {
      this.primitives.set(`marker-${index}`, marker);
    });
    
    // Update series markers
    this.updateSeriesMarkers();
  }

  private createEntryMarker(position: Position): SeriesMarker<Time> | null {
    const settings = this.settings as PositionMarkerSettings;
    const isLong = position.type === 'long';
    
    let text = isLong ? '▲' : '▼';
    if (settings.showQuantity) {
      text += ` ${position.quantity}`;
    }
    
    return {
      time: position.entryTime,
      position: isLong ? 'belowBar' : 'aboveBar',
      color: isLong ? settings.entryLongColor : settings.entryShortColor,
      shape: isLong ? 'arrowUp' : 'arrowDown',
      text: text,
      size: settings.markerSize
    };
  }

  private createExitMarker(position: Position): SeriesMarker<Time> | null {
    if (!position.exitTime || position.exitPrice === undefined) return null;
    
    const settings = this.settings as PositionMarkerSettings;
    const isProfitable = position.pnl !== undefined && position.pnl > 0;
    const isLong = position.type === 'long';
    
    let text = '✕';
    if (settings.showPnL && position.pnl !== undefined) {
      const pnlText = formatPnL(position.pnl);
      text = `✕ ${pnlText}`;
    }
    
    return {
      time: position.exitTime,
      position: isLong ? 'aboveBar' : 'belowBar',
      color: isProfitable ? settings.exitProfitColor : settings.exitLossColor,
      shape: 'circle',
      text: text,
      size: settings.markerSize
    };
  }

  // Public methods
  addPosition(position: Position): void {
    this.positions.set(position.id, position);
    
    if (this.enabled && this.initialized) {
      this.updatePrimitives();
    }
  }

  updatePosition(positionId: string, updates: Partial<Position>): void {
    const position = this.positions.get(positionId);
    if (!position) return;
    
    // Update position
    const updatedPosition = { ...position, ...updates };
    this.positions.set(positionId, updatedPosition);
    
    // Recalculate PnL if closing position
    if (updates.exitPrice !== undefined && updates.exitTime !== undefined) {
      const pnl = this.calculatePnL(updatedPosition);
      updatedPosition.pnl = pnl;
      this.positions.set(positionId, updatedPosition);
    }
    
    if (this.enabled && this.initialized) {
      this.updatePrimitives();
    }
  }

  closePosition(positionId: string, exitPrice: number, exitTime: Time): void {
    const position = this.positions.get(positionId);
    if (!position || position.status === 'closed') return;
    
    this.updatePosition(positionId, {
      exitPrice,
      exitTime,
      status: 'closed',
      pnl: this.calculatePnL({ ...position, exitPrice })
    });
  }

  removePosition(positionId: string): void {
    this.positions.delete(positionId);
    
    if (this.enabled && this.initialized) {
      this.updatePrimitives();
    }
  }

  clearAllPositions(): void {
    this.positions.clear();
    this.removeAllPrimitives();
  }

  getPosition(positionId: string): Position | undefined {
    return this.positions.get(positionId);
  }

  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  getOpenPositions(): Position[] {
    return this.getAllPositions().filter(pos => pos.status === 'open');
  }

  getClosedPositions(): Position[] {
    return this.getAllPositions().filter(pos => pos.status === 'closed');
  }

  getTotalPnL(): number {
    return this.getClosedPositions()
      .reduce((total, pos) => total + (pos.pnl || 0), 0);
  }

  // Settings updates
  updateColors(colors: Partial<PositionMarkerSettings>): void {
    this.updateSettings(colors);
    this.updatePrimitives();
  }

  togglePnLDisplay(show: boolean): void {
    this.updateSettings({ showPnL: show });
    this.updatePrimitives();
  }

  toggleQuantityDisplay(show: boolean): void {
    this.updateSettings({ showQuantity: show });
    this.updatePrimitives();
  }

  // Helper methods
  private calculatePnL(position: Position): number {
    if (!position.exitPrice) return 0;
    
    const entryValue = position.entryPrice * position.quantity;
    const exitValue = position.exitPrice * position.quantity;
    
    if (position.type === 'long') {
      return exitValue - entryValue;
    } else {
      return entryValue - exitValue;
    }
  }
}