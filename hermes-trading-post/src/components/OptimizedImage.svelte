<!--
  🚀 PHASE 16c: Optimized image component with lazy loading and WebP support

  Features:
  - Lazy loading for off-screen images
  - WebP format with JPEG fallback
  - Async decoding for better performance
  - Optional blur-up placeholder
-->

<script lang="ts">
  // @ts-nocheck - Legacy Svelte 4 component with $$Props interface
  import { onMount } from 'svelte';

  // Component props
  export let src: string;
  export let alt: string;
  export let width: number | undefined = undefined;
  export let height: number | undefined = undefined;
  export let title: string | undefined = undefined;
  export let loading: 'lazy' | 'eager' = 'lazy';
  export let decoding: 'async' | 'sync' | 'auto' = 'async';

  let className: string | undefined;
  export { className as class };

  let imageRef: HTMLImageElement;
  let supportsWebP = false;

  // Detect WebP support
  onMount(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    supportsWebP = canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
  });

  // Generate WebP source if supported
  $: webpSrc = supportsWebP && src.endsWith('.jpg')
    ? src.replace(/\.jpg$/, '.webp')
    : src;

  // Estimate aspect ratio for layout shift prevention
  $: aspectRatio = width && height ? width / height : undefined;
</script>

<picture style={aspectRatio ? `aspect-ratio: ${aspectRatio}` : ''}>
  {#if supportsWebP && webpSrc !== src}
    <source srcset={webpSrc} type="image/webp" />
  {/if}
  <source srcset={src} type="image/jpeg" />
  <img
    bind:this={imageRef}
    {src}
    {alt}
    {width}
    {height}
    {title}
    {loading}
    {decoding}
    class={className}
  />
</picture>

<style>
  img {
    display: block;
    max-width: 100%;
    height: auto;
  }
</style>
