<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { navigate as navigateTo } from 'svelte-routing';
  import { onMount } from 'svelte';
  
  export let sidebarCollapsed = false;
  export let activeSection = 'dashboard';
  
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
    <h2 class="mobile-title">Hermes Trading</h2>
    <button class="hamburger-btn" on:click={toggleMobileMenu}>
      <span class="hamburger-line"></span>
      <span class="hamburger-line"></span>
      <span class="hamburger-line"></span>
    </button>
  </div>
  
  <!-- Mobile Menu Overlay -->
  {#if mobileMenuOpen}
    <div class="mobile-menu-overlay" on:click={toggleMobileMenu}></div>
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
  /* Mobile Header */
  .mobile-header {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000; /* High z-index to stay above all other content */
    background: rgba(10, 10, 10, 0.95);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
  }

  .mobile-header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
  }

  .mobile-title {
    color: #a78bfa;
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }

  .hamburger-btn {
    background: none;
    border: none;
    padding: 8px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .hamburger-line {
    width: 24px;
    height: 3px;
    background: #a78bfa;
    border-radius: 2px;
    transition: all 0.3s ease;
  }

  .mobile-menu-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
  }

  .mobile-menu {
    position: fixed;
    top: 60px;
    right: 0;
    width: 280px;
    height: calc(100vh - 60px);
    background: rgba(10, 10, 10, 0.98);
    backdrop-filter: blur(10px);
    border-left: 1px solid rgba(74, 0, 224, 0.3);
    z-index: 1001;
    padding: 20px 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mobile-nav-item {
    background: none;
    border: none;
    color: #d1d4dc;
    padding: 15px 20px;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 16px;
    border-left: 3px solid transparent;
    transition: all 0.2s ease;
  }

  .mobile-nav-item:hover {
    background: rgba(74, 0, 224, 0.1);
    border-left-color: rgba(74, 0, 224, 0.5);
  }

  .mobile-nav-item.active {
    background: rgba(74, 0, 224, 0.2);
    border-left-color: #a78bfa;
    color: #a78bfa;
  }

  /* Desktop Sidebar */
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    width: 250px;
    background: rgba(10, 10, 10, 0.95);
    border-right: 1px solid rgba(74, 0, 224, 0.3);
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
    z-index: 100;
  }

  .sidebar.collapsed {
    width: 80px;
  }

  .sidebar-header {
    padding: 20px;
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
  }

  .sidebar-title {
    color: #a78bfa;
    font-size: 20px;
    font-weight: 600;
    margin: 0;
  }

  .sidebar-nav {
    flex: 1;
    padding: 20px 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .nav-item {
    background: none;
    border: none;
    color: #d1d4dc;
    padding: 12px 20px;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    border-left: 3px solid transparent;
    transition: all 0.2s ease;
  }

  .nav-item:hover {
    background: rgba(74, 0, 224, 0.1);
    border-left-color: rgba(74, 0, 224, 0.5);
  }

  .nav-item.active {
    background: rgba(74, 0, 224, 0.2);
    border-left-color: #a78bfa;
    color: #a78bfa;
  }

  .nav-icon {
    font-size: 18px;
    width: 24px;
    text-align: center;
  }

  .nav-label {
    font-size: 14px;
    font-weight: 500;
  }

  .sidebar-footer {
    padding: 20px;
    border-top: 1px solid rgba(74, 0, 224, 0.3);
    display: flex;
    gap: 10px;
    justify-content: space-between;
  }

  .settings-btn,
  .toggle-btn {
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #a78bfa;
    padding: 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .settings-btn:hover,
  .toggle-btn:hover {
    background: rgba(74, 0, 224, 0.3);
    border-color: rgba(74, 0, 224, 0.5);
  }

  .toggle-icon {
    font-size: 16px;
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

