import { writable } from 'svelte/store';

type Section = 'dashboard' | 'paper-trading' | 'backtesting' | 'trading' | 'vault' | 'news';

// Create a custom store that syncs with localStorage
function createNavigationStore() {
  // Initialize with the value from localStorage if available
  const initialValue = typeof window !== 'undefined' 
    ? (localStorage.getItem('currentSection') as Section) || 'dashboard'
    : 'dashboard';
  
  const { subscribe, set, update } = writable<Section>(initialValue);

  return {
    subscribe,
    
    // Navigate to a section and save to localStorage
    navigate: (section: Section) => {
      set(section);
      if (typeof window !== 'undefined') {
        localStorage.setItem('currentSection', section);
        console.log('Navigation: Saved current section:', section);
      }
    }
  };
}

export const navigationStore = createNavigationStore();