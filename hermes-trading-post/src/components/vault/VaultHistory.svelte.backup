<script lang="ts">
  export let transactions: any[] = [];
  export let transactionPage: number = 1;
  export let transactionsPerPage: number = 20;
  
  $: paginatedTransactions = transactions.slice(
    (transactionPage - 1) * transactionsPerPage,
    transactionPage * transactionsPerPage
  );
  
  $: totalPages = Math.ceil(transactions.length / transactionsPerPage);
  
  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }
  
  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }
  
  function getTransactionTypeClass(type: string): string {
    switch(type) {
      case 'deposit': return 'deposit';
      case 'withdraw': return 'withdraw';
      case 'compound': return 'compound';
      case 'trade': return 'trade';
      default: return '';
    }
  }
  
  function nextPage() {
    if (transactionPage < totalPages) {
      transactionPage++;
    }
  }
  
  function prevPage() {
    if (transactionPage > 1) {
      transactionPage--;
    }
  }
</script>

<div class="history-container">
  {#if transactions.length === 0}
    <div class="no-transactions">
      <p>No transaction history available</p>
      <p class="hint">Transactions will appear here as you trade</p>
    </div>
  {:else}
    <div class="transactions-table">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Asset</th>
            <th>Amount</th>
            <th>Value</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {#each paginatedTransactions as tx}
            <tr>
              <td>{formatDate(tx.timestamp)}</td>
              <td>
                <span class="tx-type {getTransactionTypeClass(tx.type)}">
                  {tx.type}
                </span>
              </td>
              <td>{tx.asset}</td>
              <td class="amount">
                {tx.amount.toFixed(6)}
              </td>
              <td class="value">{formatCurrency(tx.value)}</td>
              <td class="description">{tx.description}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    
    {#if totalPages > 1}
      <div class="pagination">
        <button 
          class="page-btn" 
          on:click={prevPage}
          disabled={transactionPage === 1}
        >
          Previous
        </button>
        
        <span class="page-info">
          Page {transactionPage} of {totalPages}
        </span>
        
        <button 
          class="page-btn" 
          on:click={nextPage}
          disabled={transactionPage === totalPages}
        >
          Next
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .history-container {
    padding: 20px 0;
  }

  .no-transactions {
    text-align: center;
    padding: 60px 20px;
    color: #758696;
  }

  .no-transactions p {
    margin: 0 0 10px 0;
    font-size: 18px;
  }

  .no-transactions .hint {
    font-size: 14px;
    opacity: 0.7;
  }

  .transactions-table {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    overflow: hidden;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  thead {
    background: rgba(74, 0, 224, 0.1);
  }

  th {
    padding: 15px;
    text-align: left;
    color: #a78bfa;
    font-weight: 600;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  tbody tr {
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  tbody tr:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  td {
    padding: 15px;
    color: #d1d4dc;
    font-size: 14px;
  }

  .tx-type {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    text-transform: uppercase;
    font-weight: 600;
  }

  .tx-type.deposit {
    background: rgba(38, 166, 154, 0.2);
    color: #26a69a;
  }

  .tx-type.withdraw {
    background: rgba(239, 83, 80, 0.2);
    color: #ef5350;
  }

  .tx-type.compound {
    background: rgba(167, 139, 250, 0.2);
    color: #a78bfa;
  }

  .tx-type.trade {
    background: rgba(255, 169, 77, 0.2);
    color: #ffa94d;
  }

  .amount {
    font-family: 'Courier New', monospace;
  }

  .value {
    font-weight: 600;
    color: #26a69a;
  }

  .description {
    color: #758696;
    font-size: 13px;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 20px;
    margin-top: 20px;
  }

  .page-btn {
    padding: 8px 16px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.4);
    border-radius: 6px;
    color: #a78bfa;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .page-btn:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.3);
    border-color: #4a00e0;
  }

  .page-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-info {
    color: #758696;
    font-size: 14px;
  }
</style>