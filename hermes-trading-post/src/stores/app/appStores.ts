/**
 * @file appStores.ts
 * @description Unified application stores using new factory pattern
 * Part of Phase 18: State Management Refactoring
 * 🚀 Consolidates global app state with persistence and type safety
 */

import { createBaseStore } from '../factory/createBaseStore';
import { storeManager } from '../manager/StoreManager';

// ==================== THEME STORE ====================
export interface ThemeState {
  mode: 'light' | 'dark';
  accent: string;
  fontSize: 'small' | 'normal' | 'large';
}

export const themeStore = createBaseStore<ThemeState>({
  initial: {
    mode: 'dark',
    accent: 'blue',
    fontSize: 'normal'
  },
  persist: {
    key: 'theme-preferences',
    storage: 'localStorage'
  },
  validate: (v) =>
    typeof v === 'object' &&
    v.mode in { light: 1, dark: 1 } &&
    typeof v.accent === 'string' &&
    v.fontSize in { small: 1, normal: 1, large: 1 }
});

// ==================== SIDEBAR STORE ====================
export interface SidebarState {
  collapsed: boolean;
  width: number;
}

export const sidebarStore = createBaseStore<SidebarState>({
  initial: {
    collapsed: false,
    width: 280
  },
  persist: {
    key: 'sidebar-preferences',
    storage: 'localStorage'
  },
  validate: (v) =>
    typeof v === 'object' &&
    typeof v.collapsed === 'boolean' &&
    typeof v.width === 'number'
});

// ==================== NAVIGATION STORE ====================
export interface NavigationState {
  currentPage: string;
  previousPage: string | null;
  history: string[];
}

export const navigationStore = createBaseStore<NavigationState>({
  initial: {
    currentPage: '/dashboard',
    previousPage: null,
    history: ['/dashboard']
  },
  validate: (v) =>
    typeof v === 'object' &&
    typeof v.currentPage === 'string' &&
    Array.isArray(v.history)
});

// ==================== USER PREFERENCES STORE ====================
export interface UserPreferencesState {
  chartGranularity: string;
  chartHeight: number;
  orderbookColumns: string[];
  enableNotifications: boolean;
  enableSoundAlerts: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
}

export const userPreferencesStore = createBaseStore<UserPreferencesState>({
  initial: {
    chartGranularity: '1m',
    chartHeight: 400,
    orderbookColumns: ['price', 'size', 'side'],
    enableNotifications: true,
    enableSoundAlerts: false,
    autoRefresh: true,
    refreshInterval: 5000
  },
  persist: {
    key: 'user-preferences',
    storage: 'localStorage'
  },
  validate: (v) =>
    typeof v === 'object' &&
    typeof v.chartGranularity === 'string' &&
    typeof v.chartHeight === 'number' &&
    Array.isArray(v.orderbookColumns) &&
    typeof v.enableNotifications === 'boolean'
});

// ==================== NOTIFICATION STORE ====================
export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: number;
  autoClose?: boolean;
  closeDuration?: number;
}

export interface NotificationState {
  notifications: Notification[];
  maxNotifications: number;
}

export const notificationStore = createBaseStore<NotificationState>({
  initial: {
    notifications: [],
    maxNotifications: 5
  },
  validate: (v) =>
    typeof v === 'object' &&
    Array.isArray(v.notifications) &&
    typeof v.maxNotifications === 'number'
});

// ==================== TRADING STATE STORE ====================
export interface TradingState {
  isActive: boolean;
  selectedPair: string;
  selectedStrategy: string;
  isBacktesting: boolean;
  backtestProgress: number;
}

export const tradingStateStore = createBaseStore<TradingState>({
  initial: {
    isActive: false,
    selectedPair: 'BTC-USD',
    selectedStrategy: 'paper-trading-1',
    isBacktesting: false,
    backtestProgress: 0
  },
  persist: {
    key: 'trading-state',
    storage: 'localStorage'
  },
  validate: (v) =>
    typeof v === 'object' &&
    typeof v.isActive === 'boolean' &&
    typeof v.selectedPair === 'string'
});

// ==================== STORE REGISTRATION ====================
/**
 * Register all app stores with the store manager
 * This should be called during app initialization
 */
export function registerAppStores(): void {
  // Theme store (no dependencies)
  storeManager.registerStore('themeStore', themeStore, {
    debug: false
  });

  // Sidebar store (no dependencies)
  storeManager.registerStore('sidebarStore', sidebarStore, {
    debug: false
  });

  // Navigation store (no dependencies)
  storeManager.registerStore('navigationStore', navigationStore, {
    debug: false
  });

  // User preferences store (no dependencies)
  storeManager.registerStore('userPreferencesStore', userPreferencesStore, {
    debug: false
  });

  // Notification store (no dependencies)
  storeManager.registerStore('notificationStore', notificationStore, {
    debug: false
  });

  // Trading state store (depends on userPreferencesStore for initial config)
  storeManager.registerStore('tradingStateStore', tradingStateStore, {
    debug: false,
    dependencies: ['userPreferencesStore']
  });
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Add notification to store
 */
export function addNotification(
  type: 'info' | 'warning' | 'error' | 'success',
  title: string,
  message: string,
  autoClose = true
): void {
  const notification: Notification = {
    id: `notif-${Date.now()}`,
    type,
    title,
    message,
    timestamp: Date.now(),
    autoClose,
    closeDuration: autoClose ? 5000 : undefined
  };

  notificationStore.update((state) => ({
    ...state,
    notifications: [
      ...state.notifications.slice(-(state.maxNotifications - 1)),
      notification
    ]
  }));
}

/**
 * Remove notification by id
 */
export function removeNotification(id: string): void {
  notificationStore.update((state) => ({
    ...state,
    notifications: state.notifications.filter((n) => n.id !== id)
  }));
}

/**
 * Navigate to page
 */
export function navigateToPage(page: string): void {
  navigationStore.update((state) => ({
    previousPage: state.currentPage,
    currentPage: page,
    history: [...state.history, page].slice(-50) // Keep last 50 pages
  }));
}

/**
 * Update user preference
 */
export function updateUserPreference<K extends keyof UserPreferencesState>(
  key: K,
  value: UserPreferencesState[K]
): void {
  userPreferencesStore.update((state) => ({
    ...state,
    [key]: value
  }));
}

/**
 * Toggle sidebar
 */
export function toggleSidebar(): void {
  sidebarStore.update((state) => ({
    ...state,
    collapsed: !state.collapsed
  }));
}

/**
 * Set theme mode
 */
export function setThemeMode(mode: 'light' | 'dark'): void {
  themeStore.update((state) => ({
    ...state,
    mode
  }));
}
