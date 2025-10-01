<script lang="ts">
  import Backtesting from './Backtesting/Backtesting.svelte';
  
  export let sidebarCollapsed = false;
</script>

<Backtesting {sidebarCollapsed} on:toggle on:navigate />