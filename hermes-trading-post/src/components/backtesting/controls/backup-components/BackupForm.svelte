<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
  export let backupName = '';
  export let backupDescription = '';
  export let isEditing = false;
  export let title = isEditing ? 'Edit Backup' : 'Save New Backup';
  
  const dispatch = createEventDispatcher<{
    save: void;
    update: void;
    close: void;
  }>();

  function handleSubmit() {
    if (!backupName.trim()) {
      alert('Please enter a backup name');
      return;
    }
    
    if (isEditing) {
      dispatch('update');
    } else {
      dispatch('save');
    }
  }

  function handleClose() {
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    } else if (event.key === 'Enter' && event.ctrlKey) {
      handleSubmit();
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
        <h3>{title}</h3>
        <button 
          class="btn-close" 
          on:click={handleClose}
          aria-label="Close dialog"
        >
          ✕
        </button>
      </div>
      
      <form class="backup-form" on:submit|preventDefault={handleSubmit}>
        <div class="form-group">
          <label for="backup-name" class="form-label">
            Backup Name *
          </label>
          <input
            id="backup-name"
            type="text"
            bind:value={backupName}
            class="form-input"
            placeholder="Enter backup name"
            required
            aria-describedby="backup-name-hint"
          />
          <div id="backup-name-hint" class="form-hint">
            Choose a descriptive name for your backup
          </div>
        </div>
        
        <div class="form-group">
          <label for="backup-description" class="form-label">
            Description
          </label>
          <textarea
            id="backup-description"
            bind:value={backupDescription}
            class="form-textarea"
            placeholder="Optional description"
            rows="3"
            aria-describedby="backup-description-hint"
          ></textarea>
          <div id="backup-description-hint" class="form-hint">
            Add a description to help identify this backup later
          </div>
        </div>
        
        <div class="form-actions">
          <button 
            type="button" 
            class="btn btn-secondary" 
            on:click={handleClose}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            class="btn btn-primary"
            disabled={!backupName.trim()}
          >
            {isEditing ? 'Update' : 'Save'} Backup
          </button>
        </div>
        
        <div class="form-help">
          <p class="keyboard-hint">
            💡 <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to save, <kbd>Esc</kbd> to close
          </p>
        </div>
      </form>
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
    max-width: 500px;
    max-height: 90vh;
    overflow: hidden;
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
    padding: 1.5rem 1.5rem 0 1.5rem;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 1rem;
    margin-bottom: 1.5rem;
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

  .backup-form {
    padding: 0 1.5rem 1.5rem 1.5rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text-primary);
    font-size: 0.95rem;
    transition: border-color 0.2s ease;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .form-textarea {
    resize: vertical;
    min-height: 80px;
    font-family: inherit;
  }

  .form-hint {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
  }

  .form-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 2rem;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: 2px solid transparent;
    border-radius: var(--radius-md);
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
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

  .form-help {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
  }

  .keyboard-hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-text-tertiary);
    text-align: center;
  }

  kbd {
    background: var(--color-surface-elevated);
    padding: 0.2rem 0.4rem;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    border: 1px solid var(--color-border);
  }
</style>