<script lang="ts">
  import { onMount, onDestroy, getContext } from 'svelte';
  import type { IChartApi } from 'lightweight-charts';
  
  export let mainPaneHeight: number = 70; // Percentage
  export let minPaneHeight: number = 100; // Pixels
  export let resizable: boolean = true;
  export let showDividers: boolean = true;
  
  interface Pane {
    id: string;
    height: number;
    minHeight: number;
    content?: any;
  }
  
  let container: HTMLDivElement;
  let panes: Pane[] = [
    {
      id: 'main',
      height: mainPaneHeight,
      minHeight: minPaneHeight
    }
  ];
  
  let resizing = false;
  let resizingPaneIndex = -1;
  let startY = 0;
  let startHeights: number[] = [];
  
  const chartContext = getContext<any>('chart');
  
  // Add a new pane
  export function addPane(id: string, height: number = 30): void {
    // Adjust existing pane heights
    const totalHeight = 100;
    const newPaneHeight = Math.min(height, totalHeight - panes.length * 10);
    const remainingHeight = totalHeight - newPaneHeight;
    
    // Distribute remaining height proportionally
    const currentTotal = panes.reduce((sum, pane) => sum + pane.height, 0);
    panes = panes.map(pane => ({
      ...pane,
      height: (pane.height / currentTotal) * remainingHeight
    }));
    
    // Add new pane
    panes.push({
      id,
      height: newPaneHeight,
      minHeight: minPaneHeight
    });
    
    panes = [...panes];
  }
  
  // Remove a pane
  export function removePane(id: string): void {
    const index = panes.findIndex(pane => pane.id === id);
    if (index === -1 || panes.length === 1) return;
    
    const removedHeight = panes[index].height;
    panes = panes.filter(pane => pane.id !== id);
    
    // Redistribute height
    const factor = 100 / (100 - removedHeight);
    panes = panes.map(pane => ({
      ...pane,
      height: pane.height * factor
    }));
  }
  
  // Get pane by ID
  export function getPane(id: string): Pane | undefined {
    return panes.find(pane => pane.id === id);
  }
  
  // Update pane height
  export function setPaneHeight(id: string, height: number): void {
    const index = panes.findIndex(pane => pane.id === id);
    if (index === -1) return;
    
    const oldHeight = panes[index].height;
    const diff = height - oldHeight;
    
    // Adjust other panes proportionally
    const otherPanes = panes.filter((_, i) => i !== index);
    const otherTotal = otherPanes.reduce((sum, pane) => sum + pane.height, 0);
    
    panes = panes.map((pane, i) => {
      if (i === index) {
        return { ...pane, height };
      } else {
        const ratio = pane.height / otherTotal;
        return { ...pane, height: pane.height - (diff * ratio) };
      }
    });
  }
  
  // Handle resize start
  function handleResizeStart(event: MouseEvent, index: number) {
    if (!resizable || index >= panes.length - 1) return;
    
    resizing = true;
    resizingPaneIndex = index;
    startY = event.clientY;
    startHeights = panes.map(pane => pane.height);
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    
    event.preventDefault();
  }
  
  // Handle resize move
  function handleResizeMove(event: MouseEvent) {
    if (!resizing || !container) return;
    
    const containerHeight = container.clientHeight;
    const deltaY = event.clientY - startY;
    const deltaPercent = (deltaY / containerHeight) * 100;
    
    // Calculate new heights
    const newHeights = [...startHeights];
    newHeights[resizingPaneIndex] += deltaPercent;
    newHeights[resizingPaneIndex + 1] -= deltaPercent;
    
    // Check minimum heights
    const minPercent1 = (minPaneHeight / containerHeight) * 100;
    const minPercent2 = (minPaneHeight / containerHeight) * 100;
    
    if (newHeights[resizingPaneIndex] >= minPercent1 && 
        newHeights[resizingPaneIndex + 1] >= minPercent2) {
      panes = panes.map((pane, i) => ({
        ...pane,
        height: newHeights[i]
      }));
    }
  }
  
  // Handle resize end
  function handleResizeEnd() {
    resizing = false;
    resizingPaneIndex = -1;
    
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }
  
  // Calculate actual pixel heights
  $: paneStyles = panes.map((pane, index) => {
    const isLast = index === panes.length - 1;
    return {
      height: isLast ? 'auto' : `${pane.height}%`,
      flexGrow: isLast ? 1 : 0
    };
  });
  
  onDestroy(() => {
    if (resizing) {
      handleResizeEnd();
    }
  });
</script>

<div bind:this={container} class="chart-panes" class:resizing>
  {#each panes as pane, index}
    <div 
      class="pane" 
      data-pane-id={pane.id}
      style="height: {paneStyles[index].height}; flex-grow: {paneStyles[index].flexGrow}"
    >
      {#if pane.id === 'main'}
        <slot name="main-pane" />
      {:else}
        <slot name="indicator-pane" {pane} />
      {/if}
    </div>
    
    {#if showDividers && index < panes.length - 1}
      <div 
        class="pane-divider"
        class:resizable
        on:mousedown={(e) => handleResizeStart(e, index)}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize pane"
      >
        {#if resizable}
          <div class="divider-handle"></div>
        {/if}
      </div>
    {/if}
  {/each}
</div>

<style>
  .chart-panes {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    position: relative;
  }
  
  .chart-panes.resizing {
    user-select: none;
  }
  
  .pane {
    position: relative;
    min-height: 0;
    overflow: hidden;
  }
  
  .pane-divider {
    height: 1px;
    background: var(--divider-color, #333);
    position: relative;
    flex-shrink: 0;
  }
  
  .pane-divider.resizable {
    cursor: row-resize;
    height: 5px;
    background: transparent;
    margin: -2px 0;
    z-index: 10;
  }
  
  .pane-divider.resizable::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--divider-color, #333);
    transform: translateY(-50%);
  }
  
  .divider-handle {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 30px;
    height: 3px;
    border-radius: 2px;
    background: var(--divider-handle-color, #666);
    opacity: 0;
    transition: opacity 0.2s;
  }
  
  .pane-divider:hover .divider-handle {
    opacity: 1;
  }
  
  /* Dark theme */
  :global(.dark) .chart-panes {
    --divider-color: #444;
    --divider-handle-color: #888;
  }
  
  /* Light theme */
  :global(.light) .chart-panes {
    --divider-color: #ddd;
    --divider-handle-color: #999;
  }
</style>