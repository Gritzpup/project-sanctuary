<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let sidebarCollapsed = false;
  
  const dispatch = createEventDispatcher();
  
  function toggle() {
    dispatch('toggle');
  }
  
  const menuItems = [
    { icon: '📊', label: 'Dashboard', active: true },
    { icon: '💼', label: 'Portfolio', active: false },
    { icon: '📈', label: 'Trading', active: false },
    { icon: '📰', label: 'News', active: false },
    { icon: '⚙️', label: 'Settings', active: false },
  ];
</script>

<aside class="sidebar" class:collapsed={sidebarCollapsed}>
  <div class="sidebar-header">
    <h2 class="sidebar-title">{sidebarCollapsed ? 'HT' : 'Hermes Trading'}</h2>
  </div>
  
  <nav class="sidebar-nav">
    {#each menuItems as item}
      <button class="nav-item" class:active={item.active}>
        <span class="nav-icon">{item.icon}</span>
        {#if !sidebarCollapsed}
          <span class="nav-label">{item.label}</span>
        {/if}
      </button>
    {/each}
  </nav>
  
  <button class="toggle-btn" on:click={toggle}>
    <span class="toggle-icon">{sidebarCollapsed ? '→' : '←'}</span>
  </button>
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
  
  .nav-icon {
    font-size: 20px;
    width: 24px;
    text-align: center;
  }
  
  .nav-label {
    white-space: nowrap;
  }
  
  .toggle-btn {
    position: absolute;
    bottom: 20px;
    right: 20px;
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
  
  .collapsed .toggle-btn {
    right: 20px;
  }
</style>