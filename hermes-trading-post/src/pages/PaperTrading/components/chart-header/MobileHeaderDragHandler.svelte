<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let headerRow2: HTMLElement;
  
  const dispatch = createEventDispatcher();
  
  let isDraggingHeader = false;
  let startXHeader = 0;
  let scrollLeftHeader = 0;

  function handleHeaderDragStart(event: MouseEvent | TouchEvent) {
    if (window.innerWidth > 768) return; // Only on mobile
    
    isDraggingHeader = true;
    const clientX = event instanceof TouchEvent ? event.touches[0].clientX : event.clientX;
    startXHeader = clientX - headerRow2.offsetLeft;
    scrollLeftHeader = headerRow2.scrollLeft;
    headerRow2.style.cursor = 'grabbing';
    
    dispatch('dragStart', { isDragging: true });
  }

  function handleHeaderDragMove(event: MouseEvent | TouchEvent) {
    if (!isDraggingHeader || window.innerWidth > 768) return;
    
    event.preventDefault();
    const clientX = event instanceof TouchEvent ? event.touches[0].clientX : event.clientX;
    const x = clientX - headerRow2.offsetLeft;
    const walk = (x - startXHeader) * 2; // Scroll speed multiplier
    headerRow2.scrollLeft = scrollLeftHeader - walk;
    
    dispatch('dragMove', { scrollLeft: headerRow2.scrollLeft });
  }

  function handleHeaderDragEnd() {
    if (!isDraggingHeader) return;
    isDraggingHeader = false;
    headerRow2.style.cursor = 'grab';
    
    dispatch('dragEnd', { isDragging: false });
  }

  // Export handlers for parent to bind
  export { handleHeaderDragStart, handleHeaderDragMove, handleHeaderDragEnd };
</script>

<!-- This component handles mobile drag logic for header row 2 -->
<slot />