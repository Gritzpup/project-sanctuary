<script lang="ts">
  import NewsArticle from './NewsArticle.svelte';

  export let articles: any[];
  export let isLoading: boolean;

  $: hasArticles = articles && articles.length > 0;
</script>

<div class="articles-grid">
  {#if isLoading && !hasArticles}
    <div class="loading-message">Loading news...</div>
  {:else if !hasArticles}
    <div class="no-articles">No articles found</div>
  {:else}
    {#each articles as article}
      <NewsArticle {article} />
    {/each}
  {/if}
</div>

<style>
  .articles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: var(--space-xl);
  }

  .loading-message,
  .no-articles {
    grid-column: 1 / -1;
    text-align: center;
    padding: var(--space-xxl);
    color: var(--text-secondary);
    font-size: var(--font-size-md);
    background: var(--bg-surface);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .articles-grid {
      grid-template-columns: 1fr;
      gap: var(--space-lg);
    }
    
    .loading-message,
    .no-articles {
      padding: var(--space-xl);
      font-size: var(--font-size-sm);
    }
  }

  /* Tablet responsive */
  @media (max-width: 1024px) and (min-width: 769px) {
    .articles-grid {
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--space-lg);
    }
  }
</style>