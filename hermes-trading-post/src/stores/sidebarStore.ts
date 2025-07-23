import { writable } from 'svelte/store';

// Create a custom store that syncs with localStorage
function createSidebarStore() {
  // Initialize with false, will be updated from localStorage if available
  const { subscribe, set, update } = writable(false);

  return {
    subscribe,
    
    // Initialize from localStorage
    init: () => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('sidebarCollapsed');
        if (saved !== null) {
          set(saved === 'true');
          console.log('Sidebar store initialized from localStorage:', saved === 'true');
        }
      }
    },
    
    // Toggle the sidebar and save to localStorage
    toggle: () => {
      update(collapsed => {
        const newState = !collapsed;
        if (typeof window !== 'undefined') {
          localStorage.setItem('sidebarCollapsed', newState.toString());
          console.log('Sidebar toggled, new state:', newState);
        }
        return newState;
      });
    }
  };
}

export const sidebarStore = createSidebarStore();