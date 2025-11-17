/**
 * @file navigationStore.ts
 * @description Manages app navigation state between sections
 */
import { writable } from 'svelte/store';

type Section = 'dashboard' | 'paper-trading' | 'backtesting' | 'trading' | 'vault' | 'news';

// LocalStorage key for persisting navigation state
const STORAGE_KEY = 'hermes-navigation-section';

// Create navigation store with localStorage persistence
function createNavigationStore() {
  // Load saved section from localStorage or default to dashboard
  const savedSection = localStorage.getItem(STORAGE_KEY) as Section;
  const validSections: Section[] = ['dashboard', 'paper-trading', 'backtesting', 'trading', 'vault', 'news'];
  const initialSection = savedSection && validSections.includes(savedSection) ? savedSection : 'dashboard';
  
  const { subscribe, set, update } = writable<Section>(initialSection);

  return {
    subscribe,
    
    // Navigate to a section and save to localStorage
    navigate: (section: Section) => {
      set(section);
      // Save to localStorage for persistence
      try {
        localStorage.setItem(STORAGE_KEY, section);
      } catch (e) {
      }
    }
  };
}

export const navigationStore = createNavigationStore();