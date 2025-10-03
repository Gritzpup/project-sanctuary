<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { navigate as navigateTo } from 'svelte-routing';
  import { onMount } from 'svelte';
  
  export let sidebarCollapsed = false;
  export let activeSection = 'dashboard';
  export let currentPrice: number = 0;
  
  let mobileMenuOpen = false;
  
  const dispatch = createEventDispatcher();
  
  function toggle() {
    dispatch('toggle');
  }

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
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

<!-- Mobile Header -->
<header class="mobile-header">
  <div class="mobile-header-content">
    <div class="mobile-title-section">
      <h2 class="mobile-title">Hermes Trading</h2>
      {#if currentPrice > 0}
        <div class="mobile-price">BTC ${currentPrice.toLocaleString()}</div>
      {/if}
    </div>
    <button class="hamburger-btn" on:click={toggleMobileMenu} aria-label="Toggle navigation menu">
      <span class="hamburger-line"></span>
      <span class="hamburger-line"></span>
      <span class="hamburger-line"></span>
    </button>
  </div>
  
  <!-- Mobile Menu Overlay -->
  {#if mobileMenuOpen}
    <div 
      class="mobile-menu-overlay" 
      role="button" 
      tabindex="0"
      aria-label="Close navigation menu"
      on:click={toggleMobileMenu}
      on:keydown={(e) => e.key === 'Enter' || e.key === ' ' ? toggleMobileMenu() : null}
    ></div>
    <nav class="mobile-menu">
      {#each menuItems as item}
        <button 
          class="mobile-nav-item" 
          class:active={activeSection === item.section}
          on:click={() => { navigate(item.path, item.section); toggleMobileMenu(); }}
        >
          <span class="nav-icon">{item.icon}</span>
          <span class="nav-label">{item.label}</span>
        </button>
      {/each}
    </nav>
  {/if}
</header>

<!-- Desktop Sidebar -->
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

<style>
  /* All sidebar styles are now centralized in sidebar.css */
  /* Only component-specific mobile overrides remain here */
  
  .mobile-header {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: var(--z-overlay);
    background: var(--bg-main-alpha);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border-primary);
  }

  .mobile-header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-lg) var(--space-xl);
  }

  .mobile-title {
    color: var(--text-accent);
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    margin: 0;
  }

  .mobile-price {
    color: var(--text-accent);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    opacity: 0.9;
  }

  .hamburger-btn {
    background: none;
    border: none;
    padding: var(--space-sm);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .hamburger-line {
    width: 24px;
    height: 3px;
    background: var(--text-accent);
    border-radius: var(--radius-sm);
    transition: all var(--transition-normal);
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .mobile-header {
      display: block;
    }

    .sidebar {
      display: none;
    }
  }
</style>

