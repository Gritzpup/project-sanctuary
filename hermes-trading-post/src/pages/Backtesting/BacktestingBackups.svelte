<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let savedBackups: Array<{
    key: string;
    name: string;
    description: string;
    strategyType: string;
    savedDate: number;
    parameters: any;
    startBalance?: number;
    makerFeePercent?: number;
    takerFeePercent?: number;
    feeRebatePercent?: number;
  }> = [];
  
  const dispatch = createEventDispatcher();
  
  let selectedBackupKey = '';
  let editingBackupKey = '';
  let showBackupDialog = false;
  let backupName = '';
  let backupDescription = '';
  
  function saveCurrentStrategy() {
    dispatch('saveCurrentStrategy');
  }
  
  function loadSavedBackups() {
    dispatch('loadSavedBackups');
  }
  
  function loadBackup(key: string) {
    dispatch('loadBackup', { key });
  }
  
  function deleteBackup(key: string) {
    dispatch('deleteBackup', { key });
  }
  
  function renameBackup(key: string, newName: string) {
    dispatch('renameBackup', { key, newName });
    editingBackupKey = '';
  }
</script>

<div class="backups-section">
  <div class="backups-header">
    <h3>Saved Strategy Configurations</h3>
    <div class="backup-buttons">
      <button class="btn-secondary" on:click={() => { 
        saveCurrentStrategy(); 
        loadSavedBackups(); 
      }} title="Quick save with auto-generated name">
        Quick Save
      </button>
      <button class="btn-primary" on:click={() => { showBackupDialog = true; }}>
        Save with Name
      </button>
    </div>
  </div>
  
  {#if savedBackups.length === 0}
    <div class="empty-state">
      <p>No saved configurations yet</p>
      <p class="hint">Save your current configuration to create a backup</p>
    </div>
  {:else}
    <div class="backups-list">
      {#each savedBackups as backup}
        <div class="backup-item" class:selected={selectedBackupKey === backup.key}>
          <div class="backup-info">
            {#if editingBackupKey === backup.key}
              <input 
                type="text" 
                value={backup.name}
                on:blur={(e) => renameBackup(backup.key, e.currentTarget.value)}
                on:keydown={(e) => {
                  if (e.key === 'Enter') {
                    renameBackup(backup.key, e.currentTarget.value);
                  } else if (e.key === 'Escape') {
                    editingBackupKey = '';
                  }
                }}
                autofocus
              />
            {:else}
              <h4>{backup.name}</h4>
            {/if}
            <p class="backup-meta">
              {backup.strategyType} • {new Date(backup.savedDate).toLocaleString()}
            </p>
            {#if backup.description}
              <p class="backup-description">{backup.description}</p>
            {/if}
          </div>
          <div class="backup-actions">
            <button class="icon-btn" on:click={() => loadBackup(backup.key)} title="Load this configuration">
              📥
            </button>
            <button class="icon-btn" on:click={() => { editingBackupKey = backup.key; }} title="Rename">
              ✏️
            </button>
            <button class="icon-btn delete" on:click={() => deleteBackup(backup.key)} title="Delete">
              🗑️
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showBackupDialog}
  <div class="modal-overlay" on:click={() => showBackupDialog = false}>
    <div class="modal-content" on:click|stopPropagation>
      <h3>Save Configuration Backup</h3>
      <input 
        type="text" 
        placeholder="Backup name (optional - timestamp will be added)" 
        bind:value={backupName}
        autofocus
      />
      <textarea 
        placeholder="Description (optional)" 
        bind:value={backupDescription}
        rows="3"
      />
      <div class="modal-actions">
        <button class="btn-secondary" on:click={() => showBackupDialog = false}>
          Cancel
        </button>
        <button 
          class="btn-primary" 
          on:click={() => {
            dispatch('saveStrategyConfig', { 
              name: backupName, 
              description: backupDescription 
            });
            showBackupDialog = false;
            backupName = '';
            backupDescription = '';
            loadSavedBackups();
          }}
        >
          Save Backup
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backups-section {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  
  .backups-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  
  .backups-header h3 {
    margin: 0;
    color: #a78bfa;
    font-size: 16px;
  }
  
  .backup-buttons {
    display: flex;
    gap: 10px;
  }
  
  .btn-primary,
  .btn-secondary {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid;
  }
  
  .btn-primary {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.4);
    color: #a78bfa;
  }
  
  .btn-primary:hover {
    background: rgba(74, 0, 224, 0.3);
    border-color: rgba(74, 0, 224, 0.6);
  }
  
  .btn-secondary {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
    color: #d1d4dc;
  }
  
  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
  }
  
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: #888;
  }
  
  .empty-state p {
    margin: 5px 0;
  }
  
  .empty-state .hint {
    font-size: 13px;
    color: #666;
  }
  
  .backups-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
  }
  
  .backup-item {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 8px;
    padding: 15px;
    display: flex;
    justify-content: space-between;
    align-items: start;
    transition: all 0.2s;
  }
  
  .backup-item:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(74, 0, 224, 0.3);
  }
  
  .backup-item.selected {
    background: rgba(74, 0, 224, 0.1);
    border-color: rgba(74, 0, 224, 0.4);
  }
  
  .backup-info {
    flex: 1;
  }
  
  .backup-info h4 {
    margin: 0 0 5px 0;
    color: #d1d4dc;
    font-size: 14px;
  }
  
  .backup-info input {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 4px;
    color: #d1d4dc;
    padding: 4px 8px;
    font-size: 14px;
    font-weight: 600;
    width: 100%;
  }
  
  .backup-meta {
    font-size: 12px;
    color: #888;
    margin: 0 0 5px 0;
  }
  
  .backup-description {
    font-size: 12px;
    color: #a0a0a0;
    margin: 0;
    font-style: italic;
  }
  
  .backup-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }
  
  .icon-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s;
  }
  
  .icon-btn:hover {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.5);
  }
  
  .icon-btn.delete:hover {
    background: rgba(239, 83, 80, 0.2);
    border-color: rgba(239, 83, 80, 0.5);
  }
  
  /* Modal styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .modal-content {
    background: #1a1a1a;
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 20px;
    width: 90%;
    max-width: 500px;
  }
  
  .modal-content h3 {
    margin: 0 0 20px 0;
    color: #a78bfa;
  }
  
  .modal-content input,
  .modal-content textarea {
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #d1d4dc;
    padding: 10px;
    font-size: 14px;
    margin-bottom: 15px;
  }
  
  .modal-content textarea {
    resize: vertical;
    font-family: inherit;
  }
  
  .modal-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }
  
  /* Scrollbar styling */
  .backups-list::-webkit-scrollbar {
    width: 8px;
  }
  
  .backups-list::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }
  
  .backups-list::-webkit-scrollbar-thumb {
    background: rgba(167, 139, 250, 0.3);
    border-radius: 4px;
  }
  
  .backups-list::-webkit-scrollbar-thumb:hover {
    background: rgba(167, 139, 250, 0.5);
  }
</style>