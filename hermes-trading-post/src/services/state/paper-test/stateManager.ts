// @ts-nocheck - ChartDataFeed module path compatibility
/**
 * @file stateManager.ts
 * @description Manages paper test state and initialization
 */

import type { CandleData } from '../../../types/coinbase';
import type { ChartDataFeed } from '../../chart/dataFeed';
import type { PaperTestOptions, PaperTestState, PlaybackState, ChartState } from './types';

export class PaperTestStateManager {
  private state: PaperTestState;
  private playbackState: PlaybackState;
  private chartState: ChartState;
  private debug: boolean = false;

  // Constants
  private readonly BASE_SIMULATION_DURATION = 60000; // 60 seconds at 1x speed
  private readonly TIME_MULTIPLIER = 1440; // 24 hours in 60 seconds

  constructor() {
    this.state = this.createInitialState();
    this.playbackState = this.createInitialPlaybackState();
    this.chartState = this.createInitialChartState();
  }

  private createInitialState(): PaperTestState {
    return {
      isRunning: false,
      animationFrameId: null,
      startTime: 0,
      currentSimTime: 0,
      endTime: 0,
      candles: [],
      currentCandleIndex: 0,
      trades: [],
      balance: 0,
      btcBalance: 0,
      positions: [],
      dataFeed: null,
      processedCandles: [],
      currentOptions: null,
      lastLoggedProgress: -5
    };
  }

  private createInitialPlaybackState(): PlaybackState {
    return {
      playbackSpeed: 1,
      isPaused: false,
      pausedAtProgress: 0,
      animationStartTime: 0,
      totalElapsedBeforePause: 0
    };
  }

  private createInitialChartState(): ChartState {
    return {
      markers: []
    };
  }

  getState(): PaperTestState {
    return this.state;
  }

  getPlaybackState(): PlaybackState {
    return this.playbackState;
  }

  getChartState(): ChartState {
    return this.chartState;
  }

  initializeForTest(options: PaperTestOptions): void {
    this.state.isRunning = true;
    this.state.trades = [];
    this.state.balance = options.initialBalance;
    this.state.btcBalance = 0;
    this.state.positions = [];
    this.state.currentCandleIndex = 0;
    this.state.dataFeed = options.dataFeed;
    this.state.currentOptions = options;
    this.debug = options.debug || false;
    this.chartState.markers = [];
  }

  setCandles(candles: CandleData[]): void {
    this.state.candles = candles;
    this.state.startTime = candles[0]?.time || 0;
    this.state.endTime = candles[candles.length - 1]?.time || 0;
  }

  addProcessedCandle(candle: CandleData): void {
    this.state.processedCandles.push(candle);
  }

  addTrade(trade: any): void {
    this.state.trades.push(trade);
  }

  addPosition(position: any): void {
    this.state.positions.push(position);
  }

  updateBalance(newBalance: number): void {
    this.state.balance = newBalance;
  }

  updateBtcBalance(newBtcBalance: number): void {
    this.state.btcBalance = newBtcBalance;
  }

  updatePositions(newPositions: any[]): void {
    this.state.positions = newPositions;
  }

  addMarker(marker: any): void {
    this.chartState.markers.push(marker);
  }

  updateCurrentSimTime(time: number): void {
    this.state.currentSimTime = time;
  }

  incrementCandleIndex(): void {
    this.state.currentCandleIndex++;
  }

  setAnimationFrameId(id: number | null): void {
    this.state.animationFrameId = id;
  }

  // Playback controls
  setPlaybackSpeed(speed: number): void {
    this.playbackState.playbackSpeed = speed;
  }

  pause(): void {
    if (!this.state.isRunning || this.playbackState.isPaused) return;
    
    this.playbackState.isPaused = true;
    const elapsed = Date.now() - this.playbackState.animationStartTime;
    this.playbackState.totalElapsedBeforePause += elapsed;
  }

  resume(): void {
    if (!this.state.isRunning || !this.playbackState.isPaused) return;
    
    this.playbackState.isPaused = false;
    this.playbackState.animationStartTime = Date.now();
  }

  setAnimationStartTime(time: number): void {
    this.playbackState.animationStartTime = time;
  }

  resetTotalElapsed(): void {
    this.playbackState.totalElapsedBeforePause = 0;
  }

  // Reset methods
  resetAll(): void {
    this.state = this.createInitialState();
    this.playbackState = this.createInitialPlaybackState();
    this.chartState = this.createInitialChartState();
  }

  resetTrades(): void {
    this.state.trades = [];
    this.state.positions = [];
    this.state.balance = this.state.currentOptions?.initialBalance || 0;
    this.state.btcBalance = 0;
    this.chartState.markers = [];
  }

  stop(): void {
    this.state.isRunning = false;
    if (this.state.animationFrameId) {
      cancelAnimationFrame(this.state.animationFrameId);
      this.state.animationFrameId = null;
    }
  }

  // Helper for conditional logging
  log(...args: any[]): void {
    if (this.debug) {
    }
  }

  // Status checks
  isRunning(): boolean {
    return this.state.isRunning;
  }

  isPaused(): boolean {
    return this.playbackState.isPaused;
  }

  getPlaybackSpeed(): number {
    return this.playbackState.playbackSpeed;
  }

  getCurrentProgress(): number {
    return this.state.candles.length > 0 ? this.state.currentCandleIndex / this.state.candles.length : 0;
  }

  // Constants accessors
  getBaseDuration(): number {
    return this.BASE_SIMULATION_DURATION;
  }

  getTimeMultiplier(): number {
    return this.TIME_MULTIPLIER;
  }
}