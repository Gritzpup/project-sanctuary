<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  // Props
  export let selectedGranularity: string;
  export let selectedPeriod: string;
  export let isRunning: boolean = false;
  export let isPaperTestRunning: boolean = false;
  export let paperTestPlaybackSpeed: number = 1;
  export let showSpeedDropdown: boolean = false;
  export let selectedTestDate: Date | null = null;
  export let paperTestIsPaused: boolean = false;
  export let granularityOnly: boolean = false;
  export let periodOnly: boolean = false;

  const dispatch = createEventDispatcher();

  // Valid granularities for each period
  const validGranularities: Record<string, string[]> = {
    '1H': ['1m', '5m', '15m'],
    '4H': ['5m', '15m', '1h'],
    '5D': ['15m', '1h'],
    '1M': ['1h', '6h'],
    '3M': ['1h', '6h', '1D'],
    '6M': ['6h', '1D'],
    '1Y': ['6h', '1D'],
    '5Y': ['1D']
  };

  function isGranularityValid(granularity: string, period: string): boolean {
    return validGranularities[period]?.includes(granularity) || false;
  }

  function selectGranularity(granularity: string) {
    if (isGranularityValid(granularity, selectedPeriod)) {
      dispatch('granularityChange', { granularity });
    }
  }

  function selectPeriod(period: string) {
    let newGranularity = selectedGranularity;
    
    if (!isGranularityValid(selectedGranularity, period)) {
      const validOptions = validGranularities[period];
      if (validOptions && validOptions.length > 0) {
        const middleIndex = Math.floor(validOptions.length / 2);
        newGranularity = validOptions[middleIndex];
      }
    }
    
    dispatch('periodChange', { period, granularity: newGranularity });
  }

  function handleDateSelection(event: Event) {
    const input = event.target as HTMLInputElement;
    const selectedDate = input.value ? new Date(input.value) : null;
    dispatch('dateChange', { date: selectedDate });
  }

  function toggleSpeedDropdown() {
    dispatch('toggleSpeedDropdown');
  }

  function selectSpeed(speed: number) {
    dispatch('speedChange', { speed });
  }

  function startPaperTest() {
    dispatch('startPaperTest');
  }

  function pausePaperTest() {
    dispatch('pausePaperTest');
  }

  function resumePaperTest() {
    dispatch('resumePaperTest');
  }

  function stopPaperTest() {
    dispatch('stopPaperTest');
  }

  // Reactive statement for default test date
  $: defaultTestDate = (() => {
    if (!selectedTestDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    } else {
      return selectedTestDate.toISOString().split('T')[0];
    }
  })();

  let speedButtonElement: HTMLButtonElement;
</script>

<div class="chart-controls-container">
  <!-- Granularity Controls -->
  {#if !periodOnly}
    <div class="granularity-buttons">
      <button class="granularity-btn" class:active={selectedGranularity === '1m'} disabled={!isGranularityValid('1m', selectedPeriod)} on:click={() => selectGranularity('1m')}>1m</button>
      <button class="granularity-btn" class:active={selectedGranularity === '5m'} disabled={!isGranularityValid('5m', selectedPeriod)} on:click={() => selectGranularity('5m')}>5m</button>
      <button class="granularity-btn" class:active={selectedGranularity === '15m'} disabled={!isGranularityValid('15m', selectedPeriod)} on:click={() => selectGranularity('15m')}>15m</button>
      <button class="granularity-btn" class:active={selectedGranularity === '1h'} disabled={!isGranularityValid('1h', selectedPeriod)} on:click={() => selectGranularity('1h')}>1h</button>
      <button class="granularity-btn" class:active={selectedGranularity === '6h'} disabled={!isGranularityValid('6h', selectedPeriod)} on:click={() => selectGranularity('6h')}>6h</button>
      <button class="granularity-btn" class:active={selectedGranularity === '1D'} disabled={!isGranularityValid('1D', selectedPeriod)} on:click={() => selectGranularity('1D')}>1D</button>
    </div>
  {/if}

  <!-- Period Controls -->
  {#if !granularityOnly}
    <div class="period-buttons">
    <button class="period-btn" class:active={selectedPeriod === '1H'} disabled={isRunning} on:click={() => selectPeriod('1H')}>1H</button>
    <button class="period-btn" class:active={selectedPeriod === '4H'} disabled={isRunning} on:click={() => selectPeriod('4H')}>4H</button>
    <button class="period-btn" class:active={selectedPeriod === '5D'} disabled={isRunning} on:click={() => selectPeriod('5D')}>5D</button>
    <button class="period-btn" class:active={selectedPeriod === '1M'} disabled={isRunning} on:click={() => selectPeriod('1M')}>1M</button>
    <button class="period-btn" class:active={selectedPeriod === '3M'} disabled={isRunning} on:click={() => selectPeriod('3M')}>3M</button>
    <button class="period-btn" class:active={selectedPeriod === '6M'} disabled={isRunning} on:click={() => selectPeriod('6M')}>6M</button>
    <button class="period-btn" class:active={selectedPeriod === '1Y'} disabled={isRunning} on:click={() => selectPeriod('1Y')}>1Y</button>
    <button class="period-btn" class:active={selectedPeriod === '5Y'} disabled={isRunning} on:click={() => selectPeriod('5Y')}>5Y</button>
    
    <div class="button-separator"></div>
    
    <!-- Paper Test integrated controls -->
    <div class="date-speed-container">
      <input 
        type="date" 
        id="paper-test-date-input"
        class="period-btn date-picker-btn compact"
        max={(() => {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          return yesterday.toISOString().split('T')[0];
        })()}
        min="2024-01-01"
        value={defaultTestDate}
        on:change={handleDateSelection}
        on:input={handleDateSelection}
      />
      
      <!-- Speed dropdown -->
      <div class="speed-dropdown-container">
        <button 
          bind:this={speedButtonElement}
          class="period-btn speed-dropdown-btn compact"
          on:click|preventDefault|stopPropagation={toggleSpeedDropdown}
          on:blur={() => setTimeout(() => showSpeedDropdown = false, 200)}
        >
          {paperTestPlaybackSpeed}x Speed ▼
        </button>

        {#if showSpeedDropdown}
          <div class="speed-dropdown-menu">
            <div class="speed-dropdown-item" on:click={() => selectSpeed(0.1)}>0.1x</div>
            <div class="speed-dropdown-item" on:click={() => selectSpeed(0.5)}>0.5x</div>
            <div class="speed-dropdown-item" on:click={() => selectSpeed(1)}>1x</div>
            <div class="speed-dropdown-item" on:click={() => selectSpeed(2)}>2x</div>
            <div class="speed-dropdown-item" on:click={() => selectSpeed(5)}>5x</div>
            <div class="speed-dropdown-item" on:click={() => selectSpeed(10)}>10x</div>
            <div class="speed-dropdown-item" on:click={() => selectSpeed(50)}>50x</div>
            <div class="speed-dropdown-item" on:click={() => selectSpeed(100)}>100x</div>
          </div>
        {/if}
      </div>
      
      <!-- Play/Pause/Stop controls -->
      {#if !isPaperTestRunning}
        <button 
          class="period-btn play-stop-btn"
          on:click={startPaperTest}
          title="Start Paper Test"
        >
          ▶️ Start Test
        </button>
      {:else}
        {#if paperTestIsPaused}
          <button 
            class="period-btn play-stop-btn"
            on:click={resumePaperTest}
            title="Resume Paper Test"
          >
            ▶️ Resume
          </button>
        {:else}
          <button 
            class="period-btn play-stop-btn"
            on:click={pausePaperTest}
            title="Pause Paper Test"
          >
            ⏸️ Pause
          </button>
        {/if}
        <button 
          class="period-btn play-stop-btn"
          on:click={stopPaperTest}
          title="Stop Paper Test"
        >
          ⏹️ Stop
        </button>
      {/if}
    </div>
    </div>
  {/if}
</div>

<style>
  .chart-controls-container {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .granularity-buttons {
    display: flex;
    gap: 5px;
  }
  
  .granularity-btn {
    padding: 3px 6px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #9ca3af;
    border-radius: 4px;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .granularity-btn:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.3);
    color: #d1d4dc;
  }
  
  .granularity-btn.active {
    background: rgba(74, 0, 224, 0.4);
    color: #a78bfa;
    border-color: #a78bfa;
  }
  
  .granularity-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .period-buttons {
    display: flex;
    gap: 10px;
    padding: 15px 20px;
    background: rgba(74, 0, 224, 0.05);
    border-top: 1px solid rgba(74, 0, 224, 0.3);
    position: relative;
    z-index: 1;
    align-items: center;
    flex-wrap: wrap;
  }
  
  .period-btn {
    padding: 4px 8px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #9ca3af;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .period-btn:hover {
    background: rgba(74, 0, 224, 0.3);
    color: #d1d4dc;
  }
  
  .period-btn.active {
    background: rgba(74, 0, 224, 0.4);
    color: #a78bfa;
    border-color: #a78bfa;
  }

  .period-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .period-btn:disabled:hover {
    opacity: 0.3;
    color: #9ca3af;
    background: rgba(74, 0, 224, 0.2);
  }
  
  .button-separator {
    width: 1px;
    background: rgba(74, 0, 224, 0.3);
    margin: 0 10px;
    height: 32px;
    align-self: center;
  }

  .date-speed-container {
    display: flex;
    gap: 10px;
    align-items: center;
    opacity: 1 !important;
  }

  .period-btn.compact {
    padding: 4px 8px;
    font-size: 11px;
    min-height: 28px;
    box-sizing: border-box;
  }

  .date-picker-btn {
    min-width: 120px;
  }

  /* Speed dropdown styles */
  .speed-dropdown-container {
    position: relative;
    display: block;
    width: 100%;
    opacity: 1 !important;
  }
  
  .speed-dropdown-container,
  .speed-dropdown-container *,
  .speed-dropdown-menu,
  .speed-dropdown-menu *,
  .speed-dropdown-btn {
    opacity: 1 !important;
    filter: none !important;
    mix-blend-mode: normal !important;
  }
  
  .speed-dropdown-btn:disabled,
  .period-btn.speed-dropdown-btn:disabled {
    opacity: 1 !important;
  }
  
  .speed-dropdown-btn {
    min-width: 100px;
    width: 100%;
    pointer-events: auto;
    cursor: pointer;
  }
  
  .speed-dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    background: #000000 !important;
    background-color: #000000 !important;
    opacity: 1 !important;
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
    z-index: 10000 !important;
    min-width: 100%;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    mix-blend-mode: normal !important;
    isolation: isolate !important;
  }

  .speed-dropdown-item {
    padding: 8px 12px;
    cursor: pointer;
    color: #9ca3af;
    transition: all 0.2s;
    border-bottom: 1px solid rgba(74, 0, 224, 0.1);
  }

  .speed-dropdown-item:last-child {
    border-bottom: none;
  }

  .speed-dropdown-item:hover {
    background: rgba(74, 0, 224, 0.2);
    color: #d1d4dc;
  }

  .play-stop-btn {
    white-space: nowrap;
  }
</style>