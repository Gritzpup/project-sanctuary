import { writable } from 'svelte/store';

// Create a custom store that syncs with localStorage
function createSidebarStore() {
  // Initialize with the value from localStorage if available
  const initialValue = typeof window !== 'undefined' 
    ? localStorage.getItem('sidebarCollapsed') === 'true'
    : false;
  
  const { subscribe, set, update } = writable(initialValue);

  return {
    subscribe,
    
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