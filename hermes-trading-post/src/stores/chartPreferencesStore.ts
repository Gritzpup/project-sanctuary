/**
 * @file chartPreferencesStore.ts
 * @description Persists chart preferences like timeframe and granularity per section
 */

import { writable } from 'svelte/store';

interface ChartPreferences {
  granularity: string;
  period: string;
}

interface SectionPreferences {
  [section: string]: ChartPreferences;
}

const STORAGE_KEY = 'hermes-chart-preferences';

// Default preferences for each section
const defaultPreferences: SectionPreferences = {
  'paper-trading': { granularity: '1m', period: '1H' },
  'backtesting': { granularity: '5m', period: '1D' },
  'trading': { granularity: '1m', period: '1H' },
  'dashboard': { granularity: '5m', period: '1D' }
};

function createChartPreferencesStore() {
  // Load saved preferences from localStorage
  let savedPreferences: SectionPreferences = defaultPreferences;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      savedPreferences = { ...defaultPreferences, ...JSON.parse(saved) };
    }
  } catch (e) {
  }

  const { subscribe, update } = writable<SectionPreferences>(savedPreferences);

  // Save to localStorage whenever preferences change
  const saveToStorage = (prefs: SectionPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
    }
  };

  return {
    subscribe,
    
    // Set preferences for a specific section
    setPreferences: (section: string, granularity: string, period: string) => {
      update(prefs => {
        const updated = {
          ...prefs,
          [section]: { granularity, period }
        };
        saveToStorage(updated);
        return updated;
      });
    },
    
    // Get preferences for a specific section
    getPreferences: (section: string): ChartPreferences => {
      let current: SectionPreferences = savedPreferences;
      const unsubscribe = subscribe(value => { current = value; });
      unsubscribe();
      return current[section] || defaultPreferences[section] || { granularity: '1m', period: '1H' };
    }
  };
}

export const chartPreferencesStore = createChartPreferencesStore();