import { writable } from 'svelte/store';

type Section = 'dashboard' | 'paper-trading' | 'backtesting' | 'trading' | 'vault' | 'news';

// Create a simple navigation store without localStorage
function createNavigationStore() {
  const { subscribe, set, update } = writable<Section>('dashboard');

  return {
    subscribe,
    
    // Navigate to a section
    navigate: (section: Section) => {
      console.log('Navigation: Navigating to section:', section);
      set(section);
    }
  };
}

export const navigationStore = createNavigationStore();