<script lang="ts">
  export let startBalance: number = 1000;
</script>

<div class="balance-configuration">
  <label>
    Starting Balance
    <input 
      type="number" 
      bind:value={startBalance}
      min="100" 
      step="100" 
    />
    <span class="input-hint">$1000+ recommended for micro-scalping profitability</span>
  </label>
</div>

<style>
  .balance-configuration {
    margin-bottom: 20px;
  }
  
  label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
    color: #d1d4dc;
  }
  
  input[type="number"] {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #d1d4dc;
    padding: 10px 12px;
    font-size: 14px;
    transition: all 0.2s;
  }
  
  input[type="number"]:focus {
    outline: none;
    border-color: rgba(74, 0, 224, 0.6);
    background: rgba(255, 255, 255, 0.08);
  }
  
  .input-hint {
    font-size: 11px;
    color: #888;
    font-style: italic;
  }
</style>