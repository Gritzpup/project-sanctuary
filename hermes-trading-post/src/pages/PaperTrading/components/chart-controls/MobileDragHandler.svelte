<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let controlsGrid: HTMLElement;
  
  const dispatch = createEventDispatcher();
  
  let isDragging = false;
  let startX = 0;
  let scrollLeft = 0;

  function handleDragStart(event: MouseEvent | TouchEvent) {
    if (window.innerWidth > 768) return; // Only on mobile
    
    isDragging = true;
    const clientX = event instanceof TouchEvent ? event.touches[0].clientX : event.clientX;
    startX = clientX - controlsGrid.offsetLeft;
    scrollLeft = controlsGrid.scrollLeft;
    controlsGrid.style.cursor = 'grabbing';
    
    dispatch('dragStart', { isDragging: true });
  }

  function handleDragMove(event: MouseEvent | TouchEvent) {
    if (!isDragging || window.innerWidth > 768) return;
    
    event.preventDefault();
    const clientX = event instanceof TouchEvent ? event.touches[0].clientX : event.clientX;
    const x = clientX - controlsGrid.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed multiplier
    controlsGrid.scrollLeft = scrollLeft - walk;
    
    dispatch('dragMove', { scrollLeft: controlsGrid.scrollLeft });
  }

  function handleDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    controlsGrid.style.cursor = 'grab';
    
    dispatch('dragEnd', { isDragging: false });
  }

  // Export handlers for parent to bind
  export { handleDragStart, handleDragMove, handleDragEnd };
</script>

<!-- This component handles mobile drag logic only -->
<slot />