<script lang="ts">
  import PaperTradingContainer from './PaperTradingContainer/PaperTradingContainer.svelte';
  
  export let sidebarCollapsed = false;
</script>

<PaperTradingContainer {sidebarCollapsed} on:toggle on:navigate />