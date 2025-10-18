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
        <div class="mobile-price">${currentPrice.toFixed(2)}</div>
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
    <div class="sidebar-logo">
      <img src="/icons/favpng_cd26640183daf946992926418bba7286.png" alt="Hermes Trading Logo" class="logo-image" />
      {#if !sidebarCollapsed}
        <span class="sidebar-title">Hermes Trading</span>
      {/if}
    </div>
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
  /* Desktop Sidebar Styles - Component Scoped */
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    width: 200px;
    background: linear-gradient(to right, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.6));
    border-right: 1px solid var(--border-primary);
    display: flex;
    flex-direction: column;
    transition: width var(--transition-slow);
    z-index: var(--z-modal);
  }

  .sidebar.collapsed {
    width: 60px;
  }

  .sidebar-header {
    padding: var(--space-xl);
    border-bottom: 1px solid var(--border-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sidebar-logo {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    width: 100%;
  }

  .logo-image {
    width: 40px;
    height: 40px;
    filter: brightness(0) invert(1);
    flex-shrink: 0;
  }

  .sidebar-title {
    font-size: var(--font-size-xl);
    color: var(--text-accent);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    font-weight: var(--font-weight-semibold);
    color: white;
  }

  .sidebar-nav {
    flex: 1;
    padding: var(--space-xl) 0;
  }

  .nav-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-xl);
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-normal);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
  }

  .nav-item:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .nav-item.active {
    background: var(--bg-primary);
    color: var(--text-accent);
    border-left: 3px solid var(--color-primary);
  }

  .sidebar.collapsed .nav-item.active {
    border-left: none;
    border-bottom: 2px solid var(--color-primary);
  }

  .nav-icon {
    font-size: var(--font-size-lg);
    width: 24px;
    text-align: center;
  }

  .nav-label {
    white-space: nowrap;
  }

  .sidebar-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-xl);
    border-top: 1px solid var(--border-secondary);
    gap: var(--space-sm);
  }

  .settings-btn {
    width: 40px;
    height: 40px;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-lg);
    transition: all var(--transition-normal);
    font-size: var(--font-size-lg);
  }

  .settings-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .toggle-btn {
    width: 40px;
    height: 40px;
    background: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    color: var(--text-accent);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-normal);
    font-size: 24px;
  }

  .toggle-btn:hover {
    background: var(--bg-primary-hover);
  }

  /* Collapsed Sidebar Styles */
  .sidebar.collapsed .sidebar-footer {
    justify-content: center;
    align-items: center;
    flex-direction: column;
    gap: var(--space-md);
    padding: var(--space-md);
  }

  .sidebar.collapsed .nav-item {
    justify-content: center;
    padding: var(--space-md) 0;
  }

  .sidebar.collapsed .nav-icon {
    margin: 0;
  }

  .sidebar.collapsed .sidebar-header {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .sidebar.collapsed .sidebar-logo {
    justify-content: center;
  }

  .sidebar.collapsed .sidebar-title {
    text-align: center;
    display: none;
  }

  /* Mobile Header Styles */
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

  .mobile-menu-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: var(--z-dropdown);
  }

  .mobile-menu {
    position: fixed;
    top: 60px;
    left: 0;
    right: 0;
    background: var(--bg-main);
    border-bottom: 1px solid var(--border-primary);
    z-index: var(--z-modal);
    padding: var(--space-lg);
  }

  .mobile-nav-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md);
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-normal);
    font-size: var(--font-size-sm);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-xs);
  }

  .mobile-nav-item:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .mobile-nav-item.active {
    background: var(--bg-primary);
    color: var(--text-accent);
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

