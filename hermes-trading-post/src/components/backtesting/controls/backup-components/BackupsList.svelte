<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { BackupData } from '../BacktestingControlsTypes';
  
  export let savedBackups: BackupData[] = [];
  
  const dispatch = createEventDispatcher<{
    loadBackup: { backup: BackupData };
    editBackup: { backupKey: string };
    deleteBackup: { backupKey: string };
    exportBackup: { backup: BackupData };
  }>();

  function handleLoadBackup(backup: BackupData) {
    if (confirm(`Load backup "${backup.name}"? This will overwrite your current settings.`)) {
      dispatch('loadBackup', { backup });
    }
  }

  function handleDeleteBackup(backupKey: string) {
    const backup = savedBackups.find(b => b.key === backupKey);
    if (backup && confirm(`Delete backup "${backup.name}"?`)) {
      dispatch('deleteBackup', { backupKey });
    }
  }

  function handleExportBackup(backup: BackupData) {
    dispatch('exportBackup', { backup });
  }

  function handleEditBackup(backupKey: string) {
    dispatch('editBackup', { backupKey });
  }

  function formatDate(timestamp: string): string {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<div class="backups-list">
  <h3>Saved Backups ({savedBackups.length})</h3>
  
  {#if savedBackups.length === 0}
    <div class="empty-state">
      <p>No backups saved yet</p>
      <p class="hint">Save your current configuration to create backups</p>
    </div>
  {:else}
    <div class="backups-grid">
      {#each savedBackups as backup (backup.key)}
        <div class="backup-card">
          <div class="backup-header">
            <h4 class="backup-name" title={backup.name}>{backup.name}</h4>
            <div class="backup-actions">
              <button
                class="btn-icon"
                on:click={() => handleLoadBackup(backup)}
                title="Load backup"
                aria-label="Load backup {backup.name}"
              >
                📥
              </button>
              <button
                class="btn-icon"
                on:click={() => handleEditBackup(backup.key)}
                title="Edit backup"
                aria-label="Edit backup {backup.name}"
              >
                ✏️
              </button>
              <button
                class="btn-icon"
                on:click={() => handleExportBackup(backup)}
                title="Export backup"
                aria-label="Export backup {backup.name}"
              >
                📤
              </button>
              <button
                class="btn-icon btn-danger"
                on:click={() => handleDeleteBackup(backup.key)}
                title="Delete backup"
                aria-label="Delete backup {backup.name}"
              >
                🗑️
              </button>
            </div>
          </div>
          
          {#if backup.description}
            <p class="backup-description">{backup.description}</p>
          {/if}
          
          <div class="backup-meta">
            <span class="backup-date">{formatDate(backup.timestamp)}</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .backups-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  h3 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 1.1rem;
    font-weight: 600;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--color-text-secondary);
  }

  .empty-state p {
    margin: 0.5rem 0;
  }

  .hint {
    font-size: 0.9rem;
    opacity: 0.7;
  }

  .backups-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }

  .backup-card {
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 1rem;
    transition: all 0.2s ease;
  }

  .backup-card:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .backup-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .backup-name {
    margin: 0;
    font-size: 1rem;
    font-weight: 500;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .backup-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .btn-icon {
    background: none;
    border: none;
    padding: 0.25rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.9rem;
    transition: background-color 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
  }

  .btn-icon:hover {
    background: var(--color-surface-hover);
  }

  .btn-icon.btn-danger:hover {
    background: var(--color-error);
    color: white;
  }

  .backup-description {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  .backup-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--color-border);
  }

  .backup-date {
    font-size: 0.8rem;
    color: var(--color-text-tertiary);
  }
</style>