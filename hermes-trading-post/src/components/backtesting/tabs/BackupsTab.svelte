<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export const savedBackups: Array<any> = [];
  
  const dispatch = createEventDispatcher();
</script>

<div class="backups-content">
  <slot />
</div>