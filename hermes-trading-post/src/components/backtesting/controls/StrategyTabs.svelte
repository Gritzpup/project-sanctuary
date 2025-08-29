<script lang="ts">
  export let activeTab: 'config' | 'code' | 'backups' = 'config';
  
  function setTab(tab: 'config' | 'code' | 'backups') {
    activeTab = tab;
  }
</script>

<div class="tabs">
  <button class="tab" class:active={activeTab === 'config'} on:click={() => setTab('config')}>
    Config
  </button>
  <button class="tab" class:active={activeTab === 'code'} on:click={() => setTab('code')}>
    Source Code
  </button>
  <button class="tab" class:active={activeTab === 'backups'} on:click={() => setTab('backups')}>
    Backups
  </button>
</div>