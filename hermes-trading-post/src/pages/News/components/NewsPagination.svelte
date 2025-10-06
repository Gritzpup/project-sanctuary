<script lang="ts">
  export let currentPage: number;
  export let totalPages: number;

  function previousPage() {
    currentPage = Math.max(1, currentPage - 1);
  }

  function nextPage() {
    currentPage = Math.min(totalPages, currentPage + 1);
  }
</script>

{#if totalPages > 1}
  <div class="pagination">
    <button 
      class="btn-base btn-md btn-secondary"
      on:click={previousPage} 
      disabled={currentPage === 1}
    >
      Previous
    </button>
    
    <span class="page-info">
      Page {currentPage} of {totalPages}
    </span>
    
    <button 
      class="btn-base btn-md btn-secondary"
      on:click={nextPage} 
      disabled={currentPage === totalPages}
    >
      Next
    </button>
  </div>
{/if}

<style>
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--space-xl);
    margin-top: var(--space-xxl);
    padding: var(--space-xl);
  }

  .pagination .btn-base {
    min-width: 80px;
  }

  .pagination .btn-base:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .page-info {
    color: var(--text-accent);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    font-family: var(--font-family-mono, 'Courier New', monospace);
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .pagination {
      gap: var(--space-md);
      padding: var(--space-lg);
    }
    
    .pagination button {
      min-width: 70px;
      font-size: var(--font-size-xs);
    }
    
    .page-info {
      font-size: var(--font-size-xs);
    }
  }
</style>