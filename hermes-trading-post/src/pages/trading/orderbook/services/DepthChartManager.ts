// @ts-nocheck - D3 callback implicit any types
/**
 * @file DepthChartManager.ts
 * @description Chart initialization and management for DepthChart
 * Extracted from DepthChart.svelte to reduce component complexity
 */

import * as d3 from 'd3';
import { OrderBookCalculator } from '../components/services/OrderBookCalculator';

export interface ChartDimensions {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
}

export interface ChartElements {
  svg: d3.Selection<SVGGElement, unknown, null, undefined>;
  bidArea: d3.Selection<SVGPathElement, unknown, null, undefined>;
  askArea: d3.Selection<SVGPathElement, unknown, null, undefined>;
  spreadLine: d3.Selection<SVGLineElement, unknown, null, undefined>;
  xScale: d3.ScaleLinear<number, number>;
  yScale: d3.ScaleLinear<number, number>;
  xAxis: d3.Selection<SVGGElement, unknown, null, undefined>;
  yAxis: d3.Selection<SVGGElement, unknown, null, undefined>;
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>;
  hoverLine: d3.Selection<SVGLineElement, unknown, null, undefined>;
  hoverRect: d3.Selection<SVGRectElement, unknown, null, undefined>;
}

export class DepthChartManager {
  private dimensions: ChartDimensions;
  private elements: ChartElements | null = null;
  private areaGenerator: d3.Area<any> | null = null;

  constructor() {
    this.dimensions = {
      width: 800,
      height: 400,
      margin: { top: 20, right: 30, bottom: 40, left: 70 }
    };
  }

  initializeChart(container: HTMLElement): ChartElements {
    // Clear existing chart
    d3.select(container).select('svg').remove();
    d3.select(container).select('.depth-chart-tooltip').remove();

    // Calculate dimensions
    const { width, height, margin } = this.dimensions;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const xScale = d3.scaleLinear().range([0, innerWidth]);
    const yScale = d3.scaleLinear().range([innerHeight, 0]);

    // Create area generator
    this.areaGenerator = d3.area<any>()
      .x(d => xScale(d.price))
      .y0(innerHeight)
      .y1(d => yScale(d.depth))
      .curve(d3.curveStepAfter);

    // Create areas for bids and asks
    const bidArea = svg.append('path')
      .attr('class', 'bid-area')
      .attr('fill', 'rgba(0, 255, 0, 0.3)')
      .attr('stroke', 'rgb(0, 255, 0)')
      .attr('stroke-width', 2);

    const askArea = svg.append('path')
      .attr('class', 'ask-area')
      .attr('fill', 'rgba(255, 0, 0, 0.3)')
      .attr('stroke', 'rgb(255, 0, 0)')
      .attr('stroke-width', 2);

    // Create spread line
    const spreadLine = svg.append('line')
      .attr('class', 'spread-line')
      .attr('stroke', '#666')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '5,5')
      .style('opacity', 0.5);

    // Create axes
    const xAxis = svg.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`);

    const yAxis = svg.append('g')
      .attr('class', 'y-axis');

    // Create tooltip
    const tooltip = d3.select(container)
      .append('div')
      .attr('class', 'depth-chart-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'rgba(0, 0, 0, 0.9)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');

    // Create hover elements
    const hoverLine = svg.append('line')
      .attr('class', 'hover-line')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .style('opacity', 0);

    const hoverRect = svg.append('rect')
      .attr('class', 'hover-rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair');

    this.elements = {
      svg,
      bidArea,
      askArea,
      spreadLine,
      xScale,
      yScale,
      xAxis,
      yAxis,
      tooltip,
      hoverLine,
      hoverRect
    };

    return this.elements;
  }

  updateChart(depthData: any, currentPrice: number) {
    if (!this.elements || !this.areaGenerator) return;

    const { bidArea, askArea, spreadLine, xScale, yScale, xAxis, yAxis } = this.elements;
    const { width, height, margin } = this.dimensions;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Calculate price range
    const priceRange = OrderBookCalculator.calculatePriceRange(depthData, currentPrice);

    // Update scales
    xScale.domain([priceRange.min, priceRange.max]);
    yScale.domain([0, d3.max([...depthData.bids, ...depthData.asks], d => d.depth) || 1]);

    // Update areas
    bidArea.datum(depthData.bids).attr('d', this.areaGenerator);
    askArea.datum(depthData.asks).attr('d', this.areaGenerator);

    // Update spread line
    const spreadX = xScale(currentPrice);
    spreadLine
      .attr('x1', spreadX)
      .attr('x2', spreadX)
      .attr('y1', 0)
      .attr('y2', innerHeight);

    // Update axes
    xAxis.call(d3.axisBottom(xScale).ticks(10).tickFormat(d3.format(',.0f')));
    yAxis.call(d3.axisLeft(yScale).ticks(10).tickFormat(d3.format('.2s')));
  }

  updateDimensions(width: number, height: number) {
    this.dimensions.width = width;
    this.dimensions.height = height;
  }

  getElements(): ChartElements | null {
    return this.elements;
  }

  getDimensions(): ChartDimensions {
    return this.dimensions;
  }

  destroy() {
    this.elements = null;
    this.areaGenerator = null;
  }
}