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
    gap: 20px;
  }

  .loading-message,
  .no-articles {
    grid-column: 1 / -1;
    text-align: center;
    padding: 40px;
    color: #758696;
  }
</style>