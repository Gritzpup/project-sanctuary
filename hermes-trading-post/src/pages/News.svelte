<script lang="ts">
  import News from './News/News.svelte';
  
  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let sidebarCollapsed = false;
</script>

<News {currentPrice} {connectionStatus} {sidebarCollapsed} on:toggle on:navigate />