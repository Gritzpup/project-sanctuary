<script lang="ts">
  import CollapsibleSidebar from '../../components/layout/CollapsibleSidebar.svelte';
  import NewsHeader from './components/NewsHeader.svelte';
  import NewsFilters from './components/NewsFilters.svelte';
  import NewsGrid from './components/NewsGrid.svelte';
  import NewsPagination from './components/NewsPagination.svelte';
  import { loadNews, applyFilters, paginateArticles } from './services/NewsService.svelte';
  import type { NewsArticle } from './services/NewsService.svelte';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  
  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let sidebarCollapsed = false;

  const dispatch = createEventDispatcher();

  function toggleSidebar() {
    dispatch('toggle');
  }

  function handleNavigation(event: CustomEvent) {
    dispatch('navigate', event.detail);
  }

  // News state
  let articles: NewsArticle[] = [];
  let filteredArticles: NewsArticle[] = [];
  let paginatedArticles: NewsArticle[] = [];
  let isLoading = false;
  let selectedCategory = 'all';
  let selectedSentiment = 'all';
  let selectedTimeframe = '24h';
  let searchQuery = '';

  // Pagination
  let currentPage = 1;
  let articlesPerPage = 20;
  let totalPages = 0;

  // Auto-refresh
  let refreshInterval: NodeJS.Timer | null = null;
  let autoRefresh = true;

  // Load and filter news
  async function loadAndFilterNews() {
    isLoading = true;
    
    try {
      articles = await loadNews();
      handleFilterChange();
    } catch (error) {
      console.error('Failed to load news:', error);
    } finally {
      isLoading = false;
    }
  }

  // Handle filter changes
  function handleFilterChange() {
    currentPage = 1;
    filteredArticles = applyFilters(articles, selectedCategory, selectedSentiment, selectedTimeframe, searchQuery);
    updatePagination();
  }

  // Update pagination
  function updatePagination() {
    const result = paginateArticles(filteredArticles, currentPage, articlesPerPage);
    paginatedArticles = result.articles;
    totalPages = result.totalPages;
  }

  // Toggle auto-refresh
  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    
    if (autoRefresh) {
      refreshInterval = setInterval(loadAndFilterNews, 60000); // Refresh every minute
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }

  // Handle page changes
  $: if (currentPage) {
    updatePagination();
  }

  onMount(() => {
    loadAndFilterNews();
    
    if (autoRefresh) {
      refreshInterval = setInterval(loadAndFilterNews, 60000);
    }
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
</script>

<div class="dashboard-layout">
  <CollapsibleSidebar 
    {sidebarCollapsed}
    activeSection="news"
    on:toggle={toggleSidebar}
    on:navigate={handleNavigation}
  />
  
  <main class="dashboard-content" class:expanded={sidebarCollapsed}>
    <NewsHeader {currentPrice} filteredCount={filteredArticles.length} />
    
    <div class="content-wrapper">
      <div class="news-container">
        <NewsFilters
          bind:selectedCategory
          bind:selectedSentiment
          bind:selectedTimeframe
          bind:searchQuery
          bind:autoRefresh
          {isLoading}
          on:filterChange={handleFilterChange}
          on:toggleAutoRefresh={toggleAutoRefresh}
          on:refresh={loadAndFilterNews}
        />
        
        <NewsGrid articles={paginatedArticles} {isLoading} />
        
        <NewsPagination bind:currentPage {totalPages} />
      </div>
    </div>
  </main>
</div>

<style>
  .dashboard-layout {
    display: flex;
    min-height: 100vh;
    background: #0a0a0a;
    color: #d1d4dc;
  }

  .dashboard-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-left: 250px;
    width: calc(100% - 250px);
    transition: all 0.3s ease;
  }

  .dashboard-content.expanded {
    margin-left: 80px;
    width: calc(100% - 80px);
  }

  .content-wrapper {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .news-container {
    max-width: 1400px;
    margin: 0 auto;
  }
</style>