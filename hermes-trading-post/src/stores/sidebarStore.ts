import { writable } from 'svelte/store';

// Create a simple sidebar store without localStorage
function createSidebarStore() {
  const { subscribe, set, update } = writable(false);

  return {
    subscribe,
    
    // Toggle the sidebar
    toggle: () => {
      update(collapsed => {
        const newState = !collapsed;
        console.log('Sidebar toggled, new state:', newState);
        return newState;
      });
    }
  };
}

export const sidebarStore = createSidebarStore();