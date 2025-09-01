<script lang="ts">
  import CollapsibleSidebar from '../components/layout/CollapsibleSidebar.svelte';
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
  interface NewsArticle {
    id: string;
    title: string;
    summary: string;
    source: string;
    timestamp: number;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    impact: number; // 1-5
    category: string;
    url: string;
    keywords: string[];
  }
  
  let articles: NewsArticle[] = [];
  let filteredArticles: NewsArticle[] = [];
  let isLoading = false;
  let selectedCategory = 'all';
  let selectedSentiment = 'all';
  let selectedTimeframe = '24h';
  let searchQuery = '';
  
  // Pagination
  let currentPage = 1;
  let articlesPerPage = 20;
  
  // Auto-refresh
  let refreshInterval: NodeJS.Timer | null = null;
  let autoRefresh = true;
  
  // Filter options
  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'market', label: 'Market Analysis' },
    { value: 'regulation', label: 'Regulation' },
    { value: 'technology', label: 'Technology' },
    { value: 'adoption', label: 'Adoption' },
    { value: 'defi', label: 'DeFi' }
  ];
  
  const sentiments = [
    { value: 'all', label: 'All Sentiments' },
    { value: 'bullish', label: 'Bullish', color: '#22c55e' },
    { value: 'bearish', label: 'Bearish', color: '#ef4444' },
    { value: 'neutral', label: 'Neutral', color: '#6b7280' }
  ];
  
  const timeframes = [
    { value: '1h', label: 'Last Hour' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' }
  ];
  
  // Generate mock news data
  function generateMockNews(): NewsArticle[] {
    const mockArticles: NewsArticle[] = [];
    const sources = ['CoinDesk', 'CryptoNews', 'Bitcoin Magazine', 'The Block', 'Decrypt'];
    const sentimentOptions: ('bullish' | 'bearish' | 'neutral')[] = ['bullish', 'bearish', 'neutral'];
    const categoryOptions = ['market', 'regulation', 'technology', 'adoption', 'defi'];
    
    for (let i = 0; i < 50; i++) {
      mockArticles.push({
        id: `article-${i}`,
        title: `Bitcoin ${['Surges', 'Dips', 'Stabilizes', 'Rallies'][Math.floor(Math.random() * 4)]} as ${['Market', 'Traders', 'Investors', 'Institutions'][Math.floor(Math.random() * 4)]} ${['React', 'Respond', 'Adjust', 'Prepare'][Math.floor(Math.random() * 4)]}`,
        summary: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Market movements continue to show volatility as traders assess the latest developments.',
        source: sources[Math.floor(Math.random() * sources.length)],
        timestamp: Date.now() - Math.random() * 86400000 * 7, // Random time in last 7 days
        sentiment: sentimentOptions[Math.floor(Math.random() * 3)],
        impact: Math.floor(Math.random() * 5) + 1,
        category: categoryOptions[Math.floor(Math.random() * categoryOptions.length)],
        url: '#',
        keywords: ['bitcoin', 'crypto', 'market', 'trading']
      });
    }
    
    return mockArticles.sort((a, b) => b.timestamp - a.timestamp);
  }
  
  // Load news
  async function loadNews() {
    isLoading = true;
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Use mock data for now
      articles = generateMockNews();
      applyFilters();
    } catch (error) {
      console.error('Failed to load news:', error);
    } finally {
      isLoading = false;
    }
  }
  
  // Apply filters
  function applyFilters() {
    filteredArticles = articles.filter(article => {
      // Category filter
      if (selectedCategory !== 'all' && article.category !== selectedCategory) {
        return false;
      }
      
      // Sentiment filter
      if (selectedSentiment !== 'all' && article.sentiment !== selectedSentiment) {
        return false;
      }
      
      // Timeframe filter
      const now = Date.now();
      const timeframMs = {
        '1h': 3600000,
        '24h': 86400000,
        '7d': 604800000,
        '30d': 2592000000
      }[selectedTimeframe] || 86400000;
      
      if (now - article.timestamp > timeframMs) {
        return false;
      }
      
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return article.title.toLowerCase().includes(query) ||
               article.summary.toLowerCase().includes(query) ||
               article.keywords.some(k => k.toLowerCase().includes(query));
      }
      
      return true;
    });
  }
  
  // Pagination
  $: paginatedArticles = filteredArticles.slice(
    (currentPage - 1) * articlesPerPage,
    currentPage * articlesPerPage
  );
  
  $: totalPages = Math.ceil(filteredArticles.length / articlesPerPage);
  
  // Handle filter changes
  function handleFilterChange() {
    currentPage = 1;
    applyFilters();
  }
  
  // Toggle auto-refresh
  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    
    if (autoRefresh) {
      refreshInterval = setInterval(loadNews, 60000); // Refresh every minute
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }
  
  // Utility functions
  function getSentimentIcon(sentiment: string): string {
    switch (sentiment) {
      case 'bullish': return '📈';
      case 'bearish': return '📉';
      default: return '➡️';
    }
  }
  
  function getImpactStars(impact: number): string {
    return '⭐'.repeat(impact);
  }
  
  function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
  
  onMount(() => {
    loadNews();
    
    if (autoRefresh) {
      refreshInterval = setInterval(loadNews, 60000);
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
    <div class="header">
      <h1>Crypto News</h1>
      <div class="header-stats">
        <div class="stat-item">
          <span class="stat-label">BTC Price</span>
          <span class="stat-value price">${currentPrice ? currentPrice.toFixed(2) : '0.00'}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Articles</span>
          <span class="stat-value">{filteredArticles.length}</span>
        </div>
      </div>
    </div>
    
    <div class="content-wrapper">
      <div class="news-container">
        <!-- Filters -->
        <div class="filters-panel">
          <div class="filter-group">
            <label>Category</label>
            <select bind:value={selectedCategory} on:change={handleFilterChange}>
              {#each categories as category}
                <option value={category.value}>{category.label}</option>
              {/each}
            </select>
          </div>
          
          <div class="filter-group">
            <label>Sentiment</label>
            <select bind:value={selectedSentiment} on:change={handleFilterChange}>
              {#each sentiments as sentiment}
                <option value={sentiment.value}>{sentiment.label}</option>
              {/each}
            </select>
          </div>
          
          <div class="filter-group">
            <label>Timeframe</label>
            <select bind:value={selectedTimeframe} on:change={handleFilterChange}>
              {#each timeframes as timeframe}
                <option value={timeframe.value}>{timeframe.label}</option>
              {/each}
            </select>
          </div>
          
          <div class="filter-group">
            <label>Search</label>
            <input 
              type="text" 
              placeholder="Search news..."
              bind:value={searchQuery}
              on:input={handleFilterChange}
            />
          </div>
          
          <button class="refresh-btn" class:active={autoRefresh} on:click={toggleAutoRefresh}>
            {autoRefresh ? '🔄 Auto' : '⏸️ Manual'}
          </button>
          
          <button class="refresh-btn" on:click={loadNews} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        
        <!-- News Articles -->
        <div class="articles-grid">
          {#if isLoading && articles.length === 0}
            <div class="loading-message">Loading news...</div>
          {:else if paginatedArticles.length === 0}
            <div class="no-articles">No articles found</div>
          {:else}
            {#each paginatedArticles as article}
              <article class="news-article" class:bullish={article.sentiment === 'bullish'} class:bearish={article.sentiment === 'bearish'}>
                <div class="article-header">
                  <span class="sentiment-icon">{getSentimentIcon(article.sentiment)}</span>
                  <h3>{article.title}</h3>
                </div>
                
                <p class="article-summary">{article.summary}</p>
                
                <div class="article-meta">
                  <span class="source">{article.source}</span>
                  <span class="category">{article.category}</span>
                  <span class="impact" title="Impact level">{getImpactStars(article.impact)}</span>
                  <span class="timestamp">{formatTimeAgo(article.timestamp)}</span>
                </div>
                
                <div class="article-keywords">
                  {#each article.keywords.slice(0, 3) as keyword}
                    <span class="keyword">#{keyword}</span>
                  {/each}
                </div>
              </article>
            {/each}
          {/if}
        </div>
        
        <!-- Pagination -->
        {#if totalPages > 1}
          <div class="pagination">
            <button 
              on:click={() => currentPage = Math.max(1, currentPage - 1)} 
              disabled={currentPage === 1}
            >
              Previous
            </button>
            
            <span class="page-info">
              Page {currentPage} of {totalPages}
            </span>
            
            <button 
              on:click={() => currentPage = Math.min(totalPages, currentPage + 1)} 
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        {/if}
      </div>
    </div>
  </main>
</div>

<style>
  :global(.dashboard-layout) {
    display: flex;
    min-height: 100vh;
    background: #0a0a0a;
    color: #d1d4dc;
  }

  :global(.dashboard-content) {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-left: 250px;
    width: calc(100% - 250px);
    transition: all 0.3s ease;
  }

  :global(.dashboard-content.expanded) {
    margin-left: 80px;
    width: calc(100% - 80px);
  }

  .header {
    padding: 20px;
    background: #0f0f0f;
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header h1 {
    margin: 0;
    font-size: 24px;
    color: #a78bfa;
  }

  .header-stats {
    display: flex;
    gap: 30px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .stat-label {
    font-size: 12px;
    color: #758696;
    text-transform: uppercase;
  }

  .stat-value {
    font-size: 18px;
    font-weight: 600;
  }

  .stat-value.price {
    color: #26a69a;
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

  .filters-panel {
    display: flex;
    gap: 15px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    margin-bottom: 20px;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .filter-group label {
    font-size: 12px;
    color: #758696;
    text-transform: uppercase;
  }

  .filter-group select,
  .filter-group input {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 4px;
    color: #d1d4dc;
    font-size: 14px;
  }

  .refresh-btn {
    padding: 8px 16px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.4);
    border-radius: 4px;
    color: #a78bfa;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .refresh-btn:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.3);
    border-color: rgba(74, 0, 224, 0.6);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .refresh-btn.active {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.4);
    color: #22c55e;
  }

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

  .news-article {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 20px;
    transition: all 0.2s;
  }

  .news-article:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(74, 0, 224, 0.5);
  }

  .news-article.bullish {
    border-left: 3px solid #22c55e;
  }

  .news-article.bearish {
    border-left: 3px solid #ef4444;
  }

  .article-header {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .sentiment-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .article-header h3 {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
    line-height: 1.4;
  }

  .article-summary {
    color: #9ca3af;
    font-size: 14px;
    line-height: 1.5;
    margin: 12px 0;
  }

  .article-meta {
    display: flex;
    gap: 15px;
    font-size: 12px;
    color: #758696;
    margin: 12px 0;
  }

  .source {
    font-weight: 600;
  }

  .category {
    text-transform: uppercase;
  }

  .impact {
    color: #fbbf24;
  }

  .article-keywords {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .keyword {
    padding: 4px 8px;
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 12px;
    font-size: 11px;
    color: #a78bfa;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 20px;
    margin-top: 30px;
    padding: 20px;
  }

  .pagination button {
    padding: 8px 16px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.4);
    border-radius: 4px;
    color: #a78bfa;
    cursor: pointer;
    transition: all 0.2s;
  }

  .pagination button:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.3);
    border-color: rgba(74, 0, 224, 0.6);
  }

  .pagination button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .page-info {
    color: #9ca3af;
    font-size: 14px;
  }
</style>