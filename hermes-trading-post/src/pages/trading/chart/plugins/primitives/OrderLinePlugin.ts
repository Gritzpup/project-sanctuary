import { PrimitivePlugin } from './PrimitivePlugin';
import type { CreatePriceLineOptions } from 'lightweight-charts';

export interface Order {
  id: string;
  type: 'buy' | 'sell';
  price: number;
  quantity: number;
  status: 'pending' | 'active' | 'filled' | 'cancelled';
  timestamp: number;
}

export interface OrderLineSettings {
  buyColor?: string;
  sellColor?: string;
  lineWidth?: number;
  lineStyle?: number; // 0: Solid, 1: Dotted, 2: Dashed, 3: LargeDashed, 4: SparseDotted
  showQuantity?: boolean;
  opacity?: number;
}

export class OrderLinePlugin extends PrimitivePlugin {
  private orders: Map<string, Order> = new Map();
  private orderUpdateCallback: (() => void) | null = null;

  constructor(settings?: OrderLineSettings) {
    const defaultSettings: OrderLineSettings = {
      buyColor: '#26a69a',
      sellColor: '#ef5350',
      lineWidth: 2,
      lineStyle: 2, // Dashed
      showQuantity: true,
      opacity: 0.8
    };

    super({
      id: 'order-lines',
      name: 'Order Lines',
      description: 'Displays pending orders as horizontal lines',
      version: '1.0.0',
      settings: { ...defaultSettings, ...settings }
    });
  }

  protected async setupPrimitives(): Promise<void> {
    // Initial setup - orders will be added via addOrder method
    console.log(`${this.id}: Ready to display order lines`);
  }

  protected subscribeToUpdates(): void {
    // In a real implementation, this would subscribe to order updates
    // from your trading system or order management service
    
    // Example subscription (you would replace this with actual implementation):
    // this.orderUpdateCallback = orderService.subscribe((orders) => {
    //   this.updateOrders(orders);
    // });
  }

  protected unsubscribeFromUpdates(): void {
    if (this.orderUpdateCallback) {
      // Unsubscribe from order updates
      this.orderUpdateCallback = null;
    }
  }

  protected updatePrimitives(): void {
    // Clear existing lines
    this.removeAllPrimitives();
    
    // Recreate lines for all orders
    this.orders.forEach(order => {
      this.createOrderLine(order);
    });
  }

  private createOrderLine(order: Order): void {
    if (order.status !== 'pending' && order.status !== 'active') {
      return; // Only show pending and active orders
    }

    const settings = this.settings as OrderLineSettings;
    const color = order.type === 'buy' ? settings.buyColor : settings.sellColor;
    
    const lineOptions: CreatePriceLineOptions = {
      price: order.price,
      color: this.addAlphaToColor(color || '#000000', settings.opacity || 0.8),
      lineWidth: settings.lineWidth || 2,
      lineStyle: settings.lineStyle || 2,
      axisLabelVisible: true,
      title: settings.showQuantity ? `${order.type.toUpperCase()} ${order.quantity}` : order.type.toUpperCase(),
    };

    this.createPriceLine(`line-${order.id}`, lineOptions);
  }

  // Public methods
  addOrder(order: Order): void {
    this.orders.set(order.id, order);
    
    if (this.enabled && this.initialized) {
      this.createOrderLine(order);
    }
  }

  updateOrder(orderId: string, updates: Partial<Order>): void {
    const order = this.orders.get(orderId);
    if (!order) return;
    
    // Update order
    const updatedOrder = { ...order, ...updates };
    this.orders.set(orderId, updatedOrder);
    
    // Remove old line
    this.removePriceLine(`line-${orderId}`);
    
    // Create new line if order is still active
    if (this.enabled && this.initialized) {
      this.createOrderLine(updatedOrder);
    }
  }

  removeOrder(orderId: string): void {
    this.orders.delete(orderId);
    this.removePriceLine(`line-${orderId}`);
  }

  clearAllOrders(): void {
    this.orders.clear();
    this.removeAllPrimitives();
  }

  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  getAllOrders(): Order[] {
    return Array.from(this.orders.values());
  }

  getOrdersByType(type: 'buy' | 'sell'): Order[] {
    return this.getAllOrders().filter(order => order.type === type);
  }

  getActiveOrders(): Order[] {
    return this.getAllOrders().filter(
      order => order.status === 'pending' || order.status === 'active'
    );
  }

  // Settings updates
  updateColors(buyColor: string, sellColor: string): void {
    this.updateSettings({ buyColor, sellColor });
    this.updatePrimitives();
  }

  updateLineStyle(style: number): void {
    this.updateSettings({ lineStyle: style });
    this.updatePrimitives();
  }

  toggleQuantityDisplay(show: boolean): void {
    this.updateSettings({ showQuantity: show });
    this.updatePrimitives();
  }

  // Helper methods
  private addAlphaToColor(color: string, opacity: number): string {
    // Remove existing alpha if present
    const baseColor = color.replace(/[0-9a-fA-F]{2}$/, '');
    
    // Convert opacity (0-1) to hex (00-FF)
    const alphaHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
    
    return `${baseColor}${alphaHex}`;
  }
}