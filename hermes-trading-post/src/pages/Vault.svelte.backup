<script lang="ts">
  import Vault from './Vault/Vault.svelte';
  
  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let sidebarCollapsed = false;
</script>

<Vault {currentPrice} {connectionStatus} {sidebarCollapsed} on:toggle on:navigate />