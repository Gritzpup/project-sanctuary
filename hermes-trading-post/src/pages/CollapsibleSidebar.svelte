<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let sidebarCollapsed = false;
  export let activeSection = 'dashboard';
  
  const dispatch = createEventDispatcher();
  
  function toggle() {
    dispatch('toggle');
  }
  
  function navigate(section: string) {
    activeSection = section;
    dispatch('navigate', { section });
  }
  
  const menuItems = [
    { icon: '📊', label: 'Dashboard', section: 'dashboard' },
    { icon: '💼', label: 'Portfolio', section: 'portfolio' },
    { icon: '📈', label: 'Live Trading', section: 'trading' },
    { icon: '📝', label: 'Paper Trading', section: 'paper-trading' },
    { icon: '📉', label: 'Backtesting', section: 'backtesting' },
    { icon: '🏦', label: 'Vault', section: 'vault' },
    { icon: '📰', label: 'News', section: 'news' },
  ];
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
        on:click={() => navigate(item.section)}
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
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    width: 250px;
    background: #0f0f0f;
    border-right: 1px solid rgba(74, 0, 224, 0.3);
    display: flex;
    flex-direction: column;
    transition: width 0.3s ease;
    z-index: 100;
  }
  
  .sidebar.collapsed {
    width: 80px;
  }
  
  .sidebar-header {
    padding: 20px;
    border-bottom: 1px solid rgba(74, 0, 224, 0.2);
  }
  
  .sidebar-title {
    font-size: 18px;
    color: #a78bfa;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
  }
  
  .sidebar-nav {
    flex: 1;
    padding: 20px 0;
  }
  
  .nav-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 12px 20px;
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 14px;
  }
  
  .nav-item:hover {
    background: rgba(74, 0, 224, 0.1);
    color: #d1d4dc;
  }
  
  .nav-item.active {
    background: rgba(74, 0, 224, 0.2);
    color: #a78bfa;
    border-left: 3px solid #a78bfa;
  }
  
  .sidebar.collapsed .nav-item.active {
    border-left: none;
    border-bottom: 2px solid #a78bfa;
  }
  
  .nav-icon {
    font-size: 20px;
    width: 24px;
    text-align: center;
  }
  
  .nav-label {
    white-space: nowrap;
  }
  
  .toggle-btn {
    width: 40px;
    height: 40px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    color: #a78bfa;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  
  .toggle-btn:hover {
    background: rgba(74, 0, 224, 0.3);
  }
  
  .sidebar-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    border-top: 1px solid rgba(74, 0, 224, 0.2);
    position: relative;
    gap: 10px;
  }
  
  .settings-btn {
    width: 40px;
    height: 40px;
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: all 0.2s;
    font-size: 20px;
  }
  
  .settings-btn:hover {
    background: rgba(74, 0, 224, 0.1);
    color: #d1d4dc;
  }
  
  .sidebar.collapsed .sidebar-footer {
    justify-content: center;
    align-items: center;
    flex-direction: column;
    gap: 15px;
    padding: 15px;
  }
  
  .sidebar.collapsed .settings-btn {
    position: relative;
    z-index: 1;
  }
  
  .sidebar.collapsed .toggle-btn {
    position: relative;
  }
  
  .sidebar.collapsed .nav-item {
    justify-content: center;
    padding: 12px 0;
  }
  
  .sidebar.collapsed .nav-icon {
    margin: 0;
  }
  
  .sidebar.collapsed .sidebar-header {
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .sidebar.collapsed .sidebar-title {
    text-align: center;
  }
</style>