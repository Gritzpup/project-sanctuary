<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { BackupData } from './BacktestingControlsTypes';
  
  const dispatch = createEventDispatcher();
  
  let backupName = '';
  let backupDescription = '';
  let showImportDialog = false;
  let importJsonText = '';
  let savedBackups: BackupData[] = [];
  let selectedBackupKey = '';
  let showBackupDialog = false;
  let editingBackupKey = '';

  function loadSavedBackups() {
    try {
      const saved = localStorage.getItem('backtesting-backups');
      if (saved) {
        savedBackups = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load saved backups:', error);
      savedBackups = [];
    }
  }

  function saveBackup() {
    if (!backupName.trim()) {
      alert('Please enter a backup name');
      return;
    }

    const backupData: BackupData = {
      key: Date.now().toString(),
      name: backupName.trim(),
      description: backupDescription.trim(),
      timestamp: new Date().toISOString(),
      config: {} // This would be populated with current configuration
    };

    dispatch('saveBackup', { backupData });
    resetBackupForm();
  }

  function loadBackup(backup: BackupData) {
    if (confirm(`Load backup "${backup.name}"? This will overwrite your current settings.`)) {
      dispatch('loadBackup', { backup });
    }
  }

  function deleteBackup(backupKey: string) {
    const backup = savedBackups.find(b => b.key === backupKey);
    if (backup && confirm(`Delete backup "${backup.name}"?`)) {
      dispatch('deleteBackup', { backupKey });
      loadSavedBackups();
    }
  }

  function editBackup(backupKey: string) {
    const backup = savedBackups.find(b => b.key === backupKey);
    if (backup) {
      editingBackupKey = backupKey;
      backupName = backup.name;
      backupDescription = backup.description;
      showBackupDialog = true;
    }
  }

  function updateBackup() {
    if (!backupName.trim()) {
      alert('Please enter a backup name');
      return;
    }

    const updatedData = {
      name: backupName.trim(),
      description: backupDescription.trim()
    };

    dispatch('updateBackup', { backupKey: editingBackupKey, updatedData });
    closeBackupDialog();
    loadSavedBackups();
  }

  function exportBackup(backup: BackupData) {
    const exportData = JSON.stringify(backup, null, 2);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-${backup.name}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importBackup() {
    if (!importJsonText.trim()) {
      alert('Please paste the backup JSON data');
      return;
    }

    try {
      const backupData = JSON.parse(importJsonText);
      dispatch('importBackup', { backupData });
      closeImportDialog();
      loadSavedBackups();
    } catch (error) {
      alert('Invalid JSON format. Please check your backup data.');
    }
  }

  function resetBackupForm() {
    backupName = '';
    backupDescription = '';
  }

  function closeBackupDialog() {
    showBackupDialog = false;
    resetBackupForm();
    editingBackupKey = '';
  }

  function closeImportDialog() {
    showImportDialog = false;
    importJsonText = '';
  }

  // Load backups when component mounts
  $: loadSavedBackups();
</script>

<div class="backups-section">
  <!-- Create New Backup -->
  <div class="backup-form">
    <h4>Create New Backup</h4>
    
    <div class="form-group">
      <label for="backup-name">Backup Name:</label>
      <input 
        id="backup-name"
        class="input-base"
        type="text"
        bind:value={backupName}
        placeholder="Enter backup name"
      />
    </div>

    <div class="form-group">
      <label for="backup-description">Description (optional):</label>
      <textarea 
        id="backup-description"
        class="textarea-base"
        bind:value={backupDescription}
        placeholder="Enter backup description"
        rows="3"
      ></textarea>
    </div>

    <button class="btn-base btn-primary" on:click={saveBackup}>
      Save Current Configuration
    </button>
  </div>

  <!-- Import/Export Actions -->
  <div class="import-export-actions">
    <button class="btn-base btn-sm" on:click={() => showImportDialog = true}>
      Import Backup
    </button>
  </div>

  <!-- Saved Backups List -->
  {#if savedBackups.length > 0}
    <div class="saved-backups">
      <h4>Saved Backups ({savedBackups.length})</h4>
      
      {#each savedBackups as backup}
        <div class="backup-item">
          <div class="backup-info">
            <div class="backup-header">
              <strong>{backup.name}</strong>
              <span class="backup-date">
                {new Date(backup.timestamp).toLocaleDateString()}
              </span>
            </div>
            {#if backup.description}
              <p class="backup-description">{backup.description}</p>
            {/if}
          </div>
          
          <div class="backup-actions">
            <button class="btn-base btn-xs" on:click={() => loadBackup(backup)}>
              Load
            </button>
            <button class="btn-base btn-xs" on:click={() => editBackup(backup.key)}>
              Edit
            </button>
            <button class="btn-base btn-xs" on:click={() => exportBackup(backup)}>
              Export
            </button>
            <button class="btn-base btn-xs btn-danger" on:click={() => deleteBackup(backup.key)}>
              Delete
            </button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="no-backups">
      <p>No saved backups yet. Create your first backup above.</p>
    </div>
  {/if}
</div>

<!-- Import Dialog -->
{#if showImportDialog}
  <div class="import-dialog-overlay" on:click={closeImportDialog} role="button" tabindex="0" aria-label="Close dialog">
    <div class="import-dialog-modal" on:click|stopPropagation role="dialog" aria-labelledby="import-dialog-title">
      <div class="modal-header">
        <h3 id="import-dialog-title">Import Backup</h3>
        <button class="btn-base btn-sm" on:click={closeImportDialog}>✕</button>
      </div>

      <div class="modal-content">
        <div class="form-group">
          <label for="import-json">Paste backup JSON data:</label>
          <textarea 
            id="import-json"
            class="textarea-base"
            bind:value={importJsonText}
            placeholder="Paste your backup JSON data here..."
            rows="15"
          ></textarea>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-base btn-secondary" on:click={closeImportDialog}>
          Cancel
        </button>
        <button 
          class="btn-base btn-primary" 
          on:click={importBackup}
          disabled={!importJsonText.trim()}
        >
          Import Backup
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Backup Dialog -->
{#if showBackupDialog}
  <div class="import-dialog-overlay" on:click={closeBackupDialog} role="button" tabindex="0" aria-label="Close dialog">
    <div class="import-dialog-modal" on:click|stopPropagation role="dialog" aria-labelledby="edit-backup-title">
      <div class="modal-header">
        <h3 id="edit-backup-title">Edit Backup</h3>
        <button class="btn-base btn-sm" on:click={closeBackupDialog}>✕</button>
      </div>

      <div class="modal-content">
        <div class="form-group">
          <label for="edit-backup-name">Backup Name:</label>
          <input 
            id="edit-backup-name"
            class="input-base"
            type="text"
            bind:value={backupName}
            placeholder="Enter backup name"
          />
        </div>

        <div class="form-group">
          <label for="edit-backup-description">Description:</label>
          <textarea 
            id="edit-backup-description"
            class="textarea-base"
            bind:value={backupDescription}
            placeholder="Enter backup description"
            rows="5"
          ></textarea>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-base btn-secondary" on:click={closeBackupDialog}>
          Cancel
        </button>
        <button 
          class="btn-base btn-primary" 
          on:click={updateBackup}
          disabled={!backupName.trim()}
        >
          Update Backup
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backups-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .backup-form {
    border: 1px solid var(--border-primary);
    border-radius: 4px;
    padding: var(--space-md);
    background: var(--surface-elevated);
  }

  .backup-form h4 {
    margin: 0 0 var(--space-sm) 0;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    margin-bottom: var(--space-md);
  }

  .import-export-actions {
    display: flex;
    gap: var(--space-sm);
  }

  .saved-backups {
    border: 1px solid var(--border-primary);
    border-radius: 4px;
    padding: var(--space-md);
    background: var(--surface-elevated);
  }

  .saved-backups h4 {
    margin: 0 0 var(--space-sm) 0;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .backup-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: var(--space-sm);
    border: 1px solid var(--border-secondary);
    border-radius: 4px;
    margin-bottom: var(--space-sm);
  }

  .backup-item:last-child {
    margin-bottom: 0;
  }

  .backup-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .backup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .backup-date {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }

  .backup-description {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .backup-actions {
    display: flex;
    gap: var(--space-xs);
    flex-shrink: 0;
  }

  .no-backups {
    text-align: center;
    padding: var(--space-xl);
    color: var(--text-secondary);
    font-style: italic;
  }

  /* Modal Styles */
  .import-dialog-overlay {
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
    padding: var(--space-md);
  }

  .import-dialog-modal {
    background: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow: auto;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md);
    border-bottom: 1px solid var(--border-primary);
  }

  .modal-header h3 {
    margin: 0;
    color: var(--text-primary);
  }

  .modal-content {
    padding: var(--space-md);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    padding: var(--space-md);
    border-top: 1px solid var(--border-primary);
  }

  .btn-danger {
    background: var(--error-bg);
    color: var(--error-text);
    border-color: var(--error-border);
  }

  .btn-danger:hover {
    background: var(--error-bg-hover);
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .backup-item {
      flex-direction: column;
      gap: var(--space-sm);
    }
    
    .backup-header {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-xs);
    }
    
    .backup-actions {
      justify-content: stretch;
      flex-wrap: wrap;
    }
    
    .import-export-actions {
      flex-direction: column;
    }
    
    .import-dialog-overlay {
      padding: var(--space-xs);
    }
    
    .modal-actions {
      flex-direction: column;
    }
  }
</style>