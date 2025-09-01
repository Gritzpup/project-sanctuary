<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { navigate as navigateTo } from 'svelte-routing';
  import { onMount } from 'svelte';
  
  export let sidebarCollapsed = false;
  export let activeSection = 'dashboard';
  
  const dispatch = createEventDispatcher();
  
  function toggle() {
    dispatch('toggle');
  }
  
  function navigate(path: string, section: string) {
    activeSection = section;
    navigateTo(path);
    dispatch('navigate', { section });
  }
  
  const menuItems = [
    { icon: '📊', label: 'Dashboard', section: 'dashboard', path: '/dashboard' },
    { icon: '💼', label: 'Portfolio', section: 'portfolio', path: '/portfolio' },
    { icon: '📈', label: 'Live Trading', section: 'trading', path: '/trading' },
    { icon: '📝', label: 'Paper Trading', section: 'paper-trading', path: '/paper-trading' },
    { icon: '📉', label: 'Backtesting', section: 'backtesting', path: '/backtesting' },
    { icon: '🏦', label: 'Vault', section: 'vault', path: '/vault' },
    { icon: '📰', label: 'News', section: 'news', path: '/news' },
  ];
  
  onMount(() => {
    // Set active section based on current path
    const path = window.location.pathname;
    const item = menuItems.find(item => item.path === path);
    if (item) {
      activeSection = item.section;
    } else if (path === '/') {
      activeSection = 'dashboard';
    }
  });
</script>

<aside class="sidebar" class:collapsed={sidebarCollapsed}>
  <div class="sidebar-header">
    <h2 class="sidebar-title">{sidebarCollapsed ? 'HT' : 'Hermes Trading'}</h2>
  </div>
  
  <nav class="sidebar-nav">
    {#each menuItems as item}
      <button 
        class="nav-item" 
        class:active={activeSection === item.section}
        on:click={() => navigate(item.path, item.section)}
      >
        <span class="nav-icon">{item.icon}</span>
        {#if !sidebarCollapsed}
          <span class="nav-label">{item.label}</span>
        {/if}
      </button>
    {/each}
  </nav>
  
  <div class="sidebar-footer">
    <button class="settings-btn">
      <span class="nav-icon">⚙️</span>
    </button>
    
    <button class="toggle-btn" on:click={toggle}>
      <span class="toggle-icon">{sidebarCollapsed ? '→' : '←'}</span>
    </button>
  </div>
</aside>

