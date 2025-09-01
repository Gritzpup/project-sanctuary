<script lang="ts">
  export let selectedStrategyType: string = '';
  export let strategySourceCode: string = '';
</script>

<div class="code-editor-section">
  <div class="code-header">
    <h3>{selectedStrategyType}.ts</h3>
    <div class="code-info">
      Read-only view of the strategy implementation
    </div>
  </div>
  <div class="code-editor">
    <pre><code>{strategySourceCode || 'Loading strategy source code...'}</code></pre>
  </div>
</div>