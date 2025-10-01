<script lang="ts">
  import Dashboard from './Dashboard/Dashboard.svelte';
  
  export let sidebarCollapsed = false;
</script>

<Dashboard {sidebarCollapsed} on:toggle on:navigate />