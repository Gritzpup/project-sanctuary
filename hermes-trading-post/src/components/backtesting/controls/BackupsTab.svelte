<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { BackupData } from './BacktestingControlsTypes';
  import BackupsList from './backup-components/BackupsList.svelte';
  import BackupForm from './backup-components/BackupForm.svelte';
  import ImportDialog from './backup-components/ImportDialog.svelte';
  
  const dispatch = createEventDispatcher();
  
  // State
  let savedBackups: BackupData[] = [];
  let showBackupDialog = false;
  let showImportDialog = false;
  let backupName = '';
  let backupDescription = '';
  let editingBackupKey = '';
  let importJsonText = '';

  // Computed
  $: isEditing = !!editingBackupKey;
  
  onMount(() => {
    loadSavedBackups();
  });

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

  function saveBackupsToStorage() {
    try {
      localStorage.setItem('backtesting-backups', JSON.stringify(savedBackups));
    } catch (error) {
      console.error('Failed to save backups:', error);
    }
  }

  // Dialog controls
  function openNewBackupDialog() {
    resetBackupForm();
    showBackupDialog = true;
  }

  function openImportDialog() {
    resetImportForm();
    showImportDialog = true;
  }

  function closeBackupDialog() {
    showBackupDialog = false;
    resetBackupForm();
  }

  function closeImportDialog() {
    showImportDialog = false;
    resetImportForm();
  }

  function resetBackupForm() {
    backupName = '';
    backupDescription = '';
    editingBackupKey = '';
  }

  function resetImportForm() {
    importJsonText = '';
  }

  // Backup operations
  function handleSaveBackup() {
    const backupData: BackupData = {
      key: Date.now().toString(),
      name: backupName.trim(),
      description: backupDescription.trim(),
      timestamp: new Date().toISOString(),
      config: {} // This would be populated with current configuration
    };

    dispatch('saveBackup', { backupData });
    savedBackups = [...savedBackups, backupData];
    saveBackupsToStorage();
    closeBackupDialog();
  }

  function handleUpdateBackup() {
    const updatedData = {
      name: backupName.trim(),
      description: backupDescription.trim()
    };

    dispatch('updateBackup', { backupKey: editingBackupKey, updatedData });
    
    savedBackups = savedBackups.map(backup => 
      backup.key === editingBackupKey 
        ? { ...backup, ...updatedData }
        : backup
    );
    
    saveBackupsToStorage();
    closeBackupDialog();
  }

  function handleLoadBackup(event: CustomEvent<{ backup: BackupData }>) {
    dispatch('loadBackup', event.detail);
  }

  function handleEditBackup(event: CustomEvent<{ backupKey: string }>) {
    const backup = savedBackups.find(b => b.key === event.detail.backupKey);
    if (backup) {
      editingBackupKey = event.detail.backupKey;
      backupName = backup.name;
      backupDescription = backup.description;
      showBackupDialog = true;
    }
  }

  function handleDeleteBackup(event: CustomEvent<{ backupKey: string }>) {
    const { backupKey } = event.detail;
    
    dispatch('deleteBackup', { backupKey });
    savedBackups = savedBackups.filter(backup => backup.key !== backupKey);
    saveBackupsToStorage();
  }

  function handleExportBackup(event: CustomEvent<{ backup: BackupData }>) {
    const { backup } = event.detail;
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

  function handleImportBackup(event: CustomEvent<{ backupData: BackupData }>) {
    const { backupData } = event.detail;
    
    dispatch('importBackup', { backupData });
    savedBackups = [...savedBackups, backupData];
    saveBackupsToStorage();
    closeImportDialog();
  }
</script>

<div class="backups-tab">
  <div class="tab-header">
    <div class="header-content">
      <h2>Backup Management</h2>
      <p class="tab-description">
        Save, load, and manage your backtesting configurations
      </p>
    </div>
    
    <div class="header-actions">
      <button 
        class="btn btn-secondary btn-sm"
        on:click={openImportDialog}
        aria-label="Import backup from file or JSON"
      >
        📥 Import
      </button>
      <button 
        class="btn btn-primary btn-sm"
        on:click={openNewBackupDialog}
        aria-label="Save current configuration as backup"
      >
        💾 Save Backup
      </button>
    </div>
  </div>

  <div class="tab-content">
    <BackupsList
      {savedBackups}
      on:loadBackup={handleLoadBackup}
      on:editBackup={handleEditBackup}
      on:deleteBackup={handleDeleteBackup}
      on:exportBackup={handleExportBackup}
    />
  </div>

  <!-- Backup Form Dialog -->
  <BackupForm
    bind:show={showBackupDialog}
    bind:backupName
    bind:backupDescription
    {isEditing}
    on:save={handleSaveBackup}
    on:update={handleUpdateBackup}
    on:close={closeBackupDialog}
  />

  <!-- Import Dialog -->
  <ImportDialog
    bind:show={showImportDialog}
    bind:importJsonText
    on:import={handleImportBackup}
    on:close={closeImportDialog}
  />
</div>

<style>
  .backups-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 400px;
  }

  .tab-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--color-border);
  }

  .header-content h2 {
    margin: 0 0 0.25rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .tab-description {
    margin: 0;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
  }

  .btn {
    padding: 0.5rem 1rem;
    border: 2px solid transparent;
    border-radius: var(--radius-md);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    white-space: nowrap;
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.85rem;
  }

  .btn-secondary {
    background: var(--color-surface-elevated);
    color: var(--color-text-primary);
    border-color: var(--color-border);
  }

  .btn-secondary:hover {
    background: var(--color-surface-hover);
    border-color: var(--color-border-hover);
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
  }

  @media (max-width: 768px) {
    .tab-header {
      flex-direction: column;
      align-items: stretch;
    }

    .header-actions {
      justify-content: flex-end;
    }
  }
</style>