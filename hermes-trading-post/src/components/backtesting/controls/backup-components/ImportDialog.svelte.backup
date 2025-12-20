<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { BackupData } from '../BacktestingControlsTypes';
  import { BackupDataValidator } from '../../../../utils/validators/BackupDataValidator';
  import { BackupFileHandler } from '../../../../services/backtesting/BackupFileHandler';
  import { BackupDataProcessor } from '../../../../services/backtesting/BackupDataProcessor';

  export let show = false;
  export let importJsonText = '';

  const dispatch = createEventDispatcher<{
    import: { backupData: BackupData };
    close: void;
  }>();

  let isValidJson = false;
  let validationError = '';

  // Reactive validation whenever text changes
  $: {
    const result = BackupDataValidator.validateJson(importJsonText);
    isValidJson = result.isValid;
    validationError = result.errors[0] || '';
  }

  /**
   * Close the import dialog
   */
  function handleClose() {
    dispatch('close');
  }

  /**
   * Handle file upload event
   * Delegates to BackupFileHandler service
   */
  async function handleFileUpload(event: Event) {
    try {
      importJsonText = await BackupFileHandler.handleFileUpload(event);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'File upload failed';
      alert(message);
    }
  }

  /**
   * Handle paste event from clipboard
   */
  function handlePaste(event: ClipboardEvent) {
    const pastedText = event.clipboardData?.getData('text');
    if (pastedText) {
      importJsonText = pastedText;
    }
  }

  /**
   * Handle keyboard events (Escape to close)
   */
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }

  /**
   * Handle import button click
   * Delegates to BackupDataProcessor service
   */
  function handleImport() {
    if (!isValidJson) return;

    try {
      const backupData = BackupDataProcessor.processImportData(importJsonText);
      dispatch('import', { backupData });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error during import';
      alert('Failed to import backup: ' + message);
    }
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click={handleClose}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="modal-content" on:click|stopPropagation on:keydown={handleKeydown}>
      <div class="modal-header">
        <h3>Import Backup</h3>
        <button
          class="btn-close"
          on:click={handleClose}
          aria-label="Close import dialog"
        >
          ✕
        </button>
      </div>

      <div class="import-content">
        <div class="import-options">
          <div class="option-group">
            <h4>Upload JSON File</h4>
            <p class="option-description">Select a backup JSON file from your computer</p>
            <input
              type="file"
              accept=".json,application/json"
              on:change={handleFileUpload}
              class="file-input"
              id="backup-file"
            />
            <label for="backup-file" class="file-label">
              📁 Choose File
            </label>
          </div>

          <div class="option-divider">
            <span>or</span>
          </div>

          <div class="option-group">
            <h4>Paste JSON Content</h4>
            <p class="option-description">Copy and paste the backup JSON content</p>
            <textarea
              bind:value={importJsonText}
              class="json-textarea"
              placeholder="Paste your backup JSON here..."
              rows="10"
              on:paste={handlePaste}
              aria-describedby="json-validation"
            ></textarea>

            <div id="json-validation" class="validation-feedback">
              {#if importJsonText.trim()}
                {#if isValidJson}
                  <div class="validation-success">
                    ✓ Valid backup JSON format
                  </div>
                {:else}
                  <div class="validation-error">
                    ⚠️ {validationError}
                  </div>
                {/if}
              {/if}
            </div>
          </div>
        </div>

        <div class="import-actions">
          <button
            type="button"
            class="btn btn-secondary"
            on:click={handleClose}
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled={!isValidJson}
            on:click={handleImport}
          >
            Import Backup
          </button>
        </div>

        <div class="import-help">
          <div class="help-section">
            <h5>Expected JSON Format</h5>
            <pre class="json-example">{JSON.stringify({
              name: "My Backup",
              description: "Optional description",
              timestamp: "2024-01-01T00:00:00.000Z",
              config: {}
            }, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: modalEnter 0.2s ease-out;
  }

  @keyframes modalEnter {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: var(--radius-sm);
    line-height: 1;
    transition: all 0.2s ease;
  }

  .btn-close:hover {
    background: var(--color-surface-hover);
    color: var(--color-text-primary);
  }

  .import-content {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .import-options {
    margin-bottom: 2rem;
  }

  .option-group {
    margin-bottom: 1.5rem;
  }

  .option-group h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .option-description {
    margin: 0 0 1rem 0;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
  }

  .file-input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .file-label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--color-surface-elevated);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.95rem;
  }

  .file-label:hover {
    background: var(--color-surface-hover);
    border-color: var(--color-primary);
  }

  .option-divider {
    text-align: center;
    margin: 2rem 0;
    position: relative;
    color: var(--color-text-secondary);
  }

  .option-divider::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--color-border);
    z-index: 0;
  }

  .option-divider span {
    background: var(--color-surface);
    padding: 0 1rem;
    position: relative;
    z-index: 1;
  }

  .json-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text-primary);
    font-size: 0.9rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    line-height: 1.4;
    resize: vertical;
    min-height: 200px;
    transition: border-color 0.2s ease;
  }

  .json-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .validation-feedback {
    margin-top: 0.5rem;
    min-height: 1.5rem;
  }

  .validation-success {
    color: var(--color-success);
    font-size: 0.9rem;
    font-weight: 500;
  }

  .validation-error {
    color: var(--color-error);
    font-size: 0.9rem;
    font-weight: 500;
  }

  .import-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-bottom: 1.5rem;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: 2px solid transparent;
    border-radius: var(--radius-md);
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--color-surface-elevated);
    color: var(--color-text-primary);
    border-color: var(--color-border);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--color-surface-hover);
    border-color: var(--color-border-hover);
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
  }

  .import-help {
    border-top: 1px solid var(--color-border);
    padding-top: 1.5rem;
  }

  .help-section h5 {
    margin: 0 0 0.75rem 0;
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .json-example {
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 1rem;
    font-size: 0.8rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    color: var(--color-text-secondary);
    overflow-x: auto;
    margin: 0;
  }
</style>
