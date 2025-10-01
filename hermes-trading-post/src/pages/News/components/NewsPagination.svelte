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
      on:click={previousPage} 
      disabled={currentPage === 1}
    >
      Previous
    </button>
    
    <span class="page-info">
      Page {currentPage} of {totalPages}
    </span>
    
    <button 
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
    gap: 20px;
    margin-top: 30px;
    padding: 20px;
  }

  .pagination button {
    padding: 8px 16px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.4);
    border-radius: 4px;
    color: #a78bfa;
    cursor: pointer;
    transition: all 0.2s;
  }

  .pagination button:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.3);
    border-color: rgba(74, 0, 224, 0.6);
  }

  .pagination button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .page-info {
    color: #9ca3af;
    font-size: 14px;
  }
</style>