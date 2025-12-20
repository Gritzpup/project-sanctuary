<script lang="ts">
  export let makerFeePercent: number = 0.35;
  export let takerFeePercent: number = 0.75;
  export let feeRebatePercent: number = 25;
</script>

<div class="fee-configuration">
  <h4>Fee Structure</h4>
  <div class="fee-grid">
    <label>
      Maker Fee (%)
      <input 
        type="number" 
        bind:value={makerFeePercent}
        min="0" 
        max="2" 
        step="0.05" 
      />
    </label>
    
    <label>
      Taker Fee (%)
      <input 
        type="number" 
        bind:value={takerFeePercent}
        min="0" 
        max="2" 
        step="0.05" 
      />
    </label>
    
    <label>
      Fee Rebate (%)
      <input 
        type="number" 
        bind:value={feeRebatePercent}
        min="0" 
        max="100" 
        step="5" 
      />
    </label>
  </div>
</div>

<style>
  .fee-configuration {
    margin-bottom: 20px;
  }
  
  h4 {
    color: #a78bfa;
    margin-bottom: 15px;
    font-size: 14px;
  }
  
  .fee-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 15px;
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
</style>