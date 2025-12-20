<script lang="ts">
  export let transactions: any[];
  export let transactionPage: number;
  export let transactionsPerPage: number;

  // Format currency
  function formatCurrency(value: number, currency: string = 'USD'): string {
    if (currency === 'BTC') {
      return `${value.toFixed(6)} BTC`;
    }
    return `$${value.toFixed(2)}`;
  }

  // Format timestamp
  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
  }

  // Pagination
  $: paginatedTransactions = transactions.slice(
    (transactionPage - 1) * transactionsPerPage,
    transactionPage * transactionsPerPage
  );

  $: totalTransactionPages = Math.ceil(transactions.length / transactionsPerPage);

  function previousPage() {
    transactionPage = Math.max(1, transactionPage - 1);
  }

  function nextPage() {
    transactionPage = Math.min(totalTransactionPages, transactionPage + 1);
  }
</script>

<div class="history-container">
  <table class="transactions-table">
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Amount</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      {#each paginatedTransactions as tx}
        <tr>
          <td>{formatDate(tx.timestamp)}</td>
          <td class="tx-type {tx.type}">{tx.type}</td>
          <td>{formatCurrency(tx.amount, tx.currency)}</td>
          <td class="tx-status">{tx.status}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  
  {#if totalTransactionPages > 1}
    <div class="pagination">
      <button 
        on:click={previousPage}
        disabled={transactionPage === 1}
      >
        Previous
      </button>
      
      <span class="page-info">
        Page {transactionPage} of {totalTransactionPages}
      </span>
      
      <button 
        on:click={nextPage}
        disabled={transactionPage === totalTransactionPages}
      >
        Next
      </button>
    </div>
  {/if}
</div>

<style>
  .history-container {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 20px;
  }

  .transactions-table {
    width: 100%;
    border-collapse: collapse;
  }

  .transactions-table th {
    text-align: left;
    padding: 12px;
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
    color: #a78bfa;
    font-size: 12px;
    text-transform: uppercase;
  }

  .transactions-table td {
    padding: 12px;
    border-bottom: 1px solid rgba(74, 0, 224, 0.1);
    color: #9ca3af;
    font-size: 14px;
  }

  .tx-type {
    text-transform: capitalize;
  }

  .tx-type.deposit {
    color: #22c55e;
  }

  .tx-type.withdraw {
    color: #ef4444;
  }

  .tx-type.trade {
    color: #3b82f6;
  }

  .tx-type.compound {
    color: #fbbf24;
  }

  .tx-status {
    font-size: 12px;
    text-transform: uppercase;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 20px;
    margin-top: 20px;
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