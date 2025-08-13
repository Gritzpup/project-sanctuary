/**
 * @file sidebarStore.ts
 * @description Controls sidebar visibility and collapse state with persistence
 */
import { writable } from 'svelte/store';

const STORAGE_KEY = 'sidebarCollapsed';

// Create a sidebar store with localStorage persistence
function createSidebarStore() {
  // Load initial state from localStorage
  let initialState = false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      initialState = JSON.parse(saved);
      // console.log('Sidebar state loaded from localStorage:', initialState);
    }
  } catch (error) {
    console.error('Failed to load sidebar state from localStorage:', error);
  }
  
  const { subscribe, set, update } = writable(initialState);

  return {
    subscribe,
    
    // Toggle the sidebar
    toggle: () => {
      update(collapsed => {
        const newState = !collapsed;
        // console.log('Sidebar toggled, new state:', newState);
        
        // Save to localStorage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        } catch (error) {
          console.error('Failed to save sidebar state to localStorage:', error);
        }
        
        return newState;
      });
    },
    
    // Explicitly set the state (useful for initialization)
    set: (value: boolean) => {
      set(value);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch (error) {
        console.error('Failed to save sidebar state to localStorage:', error);
      }
    }
  };
}

export const sidebarStore = createSidebarStore();