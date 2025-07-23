<script lang="ts">
  import CollapsibleSidebar from './CollapsibleSidebar.svelte';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { newsService, type NewsArticle, type NewsFilter } from '../services/newsService';
  
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
  let isLoading = false;
  let selectedCategory = 'all';
  let selectedSentiment = 'all';
  let selectedTimeframe = '24h';
  let searchQuery = '';
  let aiInsightsEnabled = false;
  
  // Pagination
  let currentPage = 1;
  let articlesPerPage = 20;
  let totalArticles = 0;
  
  // Auto-refresh
  let refreshInterval: NodeJS.Timer | null = null;
  let autoRefresh = true;
  
  // Categories for filtering
  const categories = [
    { value: 'all', label: 'All News' },
    { value: 'bitcoin', label: 'Bitcoin' },
    { value: 'crypto', label: 'Crypto Market' },
    { value: 'regulation', label: 'Regulation' },
    { value: 'technology', label: 'Technology' },
    { value: 'macro', label: 'Macro Economics' },
    { value: 'defi', label: 'DeFi' }
  ];
  
  const sentiments = [
    { value: 'all', label: 'All Sentiments' },
    { value: 'bullish', label: '🟢 Bullish' },
    { value: 'neutral', label: '⚪ Neutral' },
    { value: 'bearish', label: '🔴 Bearish' }
  ];
  
  const timeframes = [
    { value: '1h', label: 'Last Hour' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' }
  ];
  
  onMount(() => {
    loadNews();
    
    // Set up auto-refresh
    if (autoRefresh) {
      refreshInterval = setInterval(loadNews, 60000); // Refresh every minute
    }
  });
  
  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
  
  async function loadNews() {
    isLoading = true;
    
    const filter: NewsFilter = {
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      sentiment: selectedSentiment !== 'all' ? selectedSentiment : undefined,
      timeframe: selectedTimeframe,
      search: searchQuery || undefined,
      page: currentPage,
      limit: articlesPerPage
    };
    
    try {
      const response = await newsService.fetchNews(filter);
      articles = response.articles;
      totalArticles = response.total;
      
      // Store for AI training data
      if (articles.length > 0) {
        await newsService.storeArticlesForAI(articles, currentPrice);
      }
    } catch (error) {
      console.error('Failed to load news:', error);
    } finally {
      isLoading = false;
    }
  }
  
  function handleFilterChange() {
    currentPage = 1;
    loadNews();
  }
  
  function handleSearch() {
    currentPage = 1;
    loadNews();
  }
  
  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    
    if (autoRefresh && !refreshInterval) {
      refreshInterval = setInterval(loadNews, 60000);
    } else if (!autoRefresh && refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }
  
  function getSentimentIcon(sentiment: string): string {
    switch (sentiment) {
      case 'bullish': return '🟢';
      case 'bearish': return '🔴';
      default: return '⚪';
    }
  }
  
  function getImpactColor(impact: number): string {
    if (impact >= 8) return '#ef5350'; // High impact - red
    if (impact >= 5) return '#ffa726'; // Medium impact - orange
    return '#66bb6a'; // Low impact - green
  }
  
  function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
  
  // Calculate total pages
  $: totalPages = Math.ceil(totalArticles / articlesPerPage);
  
  function nextPage() {
    if (currentPage < totalPages) {
      currentPage++;
      loadNews();
    }
  }
  
  function prevPage() {
    if (currentPage > 1) {
      currentPage--;
      loadNews();
    }
  }
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
      <h1>Market News & Analysis</h1>
      <div class="header-controls">
        <div class="control-group">
          <label class="toggle-control">
            <input type="checkbox" bind:checked={autoRefresh} on:change={toggleAutoRefresh} />
            <span>Auto-refresh</span>
          </label>
          <label class="toggle-control">
            <input type="checkbox" bind:checked={aiInsightsEnabled} disabled />
            <span>AI Insights (Coming Soon)</span>
          </label>
        </div>
        <div class="stats">
          <span class="stat-item">
            <span class="label">BTC Price:</span>
            <span class="value">${currentPrice.toLocaleString()}</span>
          </span>
          <span class="stat-item">
            <span class="label">Articles:</span>
            <span class="value">{totalArticles}</span>
          </span>
        </div>
      </div>
    </div>
    
    <div class="filters-section">
      <div class="search-bar">
        <input 
          type="text" 
          placeholder="Search news..." 
          bind:value={searchQuery}
          on:keyup={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button class="search-btn" on:click={handleSearch}>
          🔍 Search
        </button>
      </div>
      
      <div class="filters">
        <select bind:value={selectedCategory} on:change={handleFilterChange}>
          {#each categories as cat}
            <option value={cat.value}>{cat.label}</option>
          {/each}
        </select>
        
        <select bind:value={selectedSentiment} on:change={handleFilterChange}>
          {#each sentiments as sent}
            <option value={sent.value}>{sent.label}</option>
          {/each}
        </select>
        
        <select bind:value={selectedTimeframe} on:change={handleFilterChange}>
          {#each timeframes as tf}
            <option value={tf.value}>{tf.label}</option>
          {/each}
        </select>
      </div>
    </div>
    
    <div class="news-container">
      {#if isLoading}
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading news...</p>
        </div>
      {:else if articles.length === 0}
        <div class="empty-state">
          <h3>No news articles found</h3>
          <p>Try adjusting your filters or search query</p>
        </div>
      {:else}
        <div class="articles-grid">
          {#each articles as article}
            <article class="news-article" data-sentiment={article.sentiment}>
              <div class="article-header">
                <div class="article-meta">
                  <span class="sentiment-icon">{getSentimentIcon(article.sentiment)}</span>
                  <span class="source">{article.source}</span>
                  <span class="time">{formatTimeAgo(article.timestamp)}</span>
                </div>
                <div class="impact-indicator" style="background-color: {getImpactColor(article.impact)}">
                  Impact: {article.impact}/10
                </div>
              </div>
              
              <h3 class="article-title">
                <a href={article.url} target="_blank" rel="noopener noreferrer">
                  {article.title}
                </a>
              </h3>
              
              <p class="article-summary">{article.summary}</p>
              
              <div class="article-footer">
                <div class="tags">
                  {#each article.tags as tag}
                    <span class="tag">{tag}</span>
                  {/each}
                </div>
                
                {#if article.aiAnalysis}
                  <div class="ai-analysis">
                    <span class="ai-label">AI:</span>
                    <span class="ai-text">{article.aiAnalysis}</span>
                  </div>
                {/if}
              </div>
              
              <!-- Hidden data for AI training -->
              <div class="ai-training-data" style="display: none;">
                <span data-price-at-publish="{article.priceAtPublish}"></span>
                <span data-price-change-1h="{article.priceChange1h}"></span>
                <span data-price-change-24h="{article.priceChange24h}"></span>
                <span data-keywords="{JSON.stringify(article.keywords)}"></span>
              </div>
            </article>
          {/each}
        </div>
        
        <div class="pagination">
          <button 
            class="page-btn" 
            on:click={prevPage} 
            disabled={currentPage === 1}
          >
            ← Previous
          </button>
          <span class="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button 
            class="page-btn" 
            on:click={nextPage} 
            disabled={currentPage === totalPages}
          >
            Next →
          </button>
        </div>
      {/if}
    </div>
    
    <div class="ai-section">
      <div class="ai-panel">
        <h2>🤖 AI Strategy Training (Future Development)</h2>
        <div class="ai-info">
          <p>This news aggregator is collecting and storing data for future AI-powered strategy development:</p>
          <ul>
            <li>News articles with sentiment analysis</li>
            <li>Price movements correlated with news events</li>
            <li>Market impact scores for different news types</li>
            <li>Historical patterns for predictive modeling</li>
          </ul>
          <p class="note">
            Currently in data collection phase. AI strategy generation will be available after sufficient training data is collected.
          </p>
          <div class="ai-stats">
            <div class="stat">
              <span class="label">Articles Collected:</span>
              <span class="value">{totalArticles}</span>
            </div>
            <div class="stat">
              <span class="label">Data Points:</span>
              <span class="value">{totalArticles * 15}</span>
            </div>
            <div class="stat">
              <span class="label">Training Ready:</span>
              <span class="value">Not Yet</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>

<style>
  .dashboard-layout {
    display: flex;
    height: 100vh;
    background: #0a0a0a;
  }
  
  .dashboard-content {
    flex: 1;
    margin-left: 250px;
    transition: margin-left 0.3s ease;
    overflow-y: auto;
    padding: 20px;
  }
  
  .dashboard-content.expanded {
    margin-left: 80px;
  }
  
  .header {
    margin-bottom: 30px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  
  .header h1 {
    font-size: 28px;
    margin: 0;
    color: #d1d4dc;
  }
  
  .header-controls {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
  }
  
  .control-group {
    display: flex;
    gap: 20px;
  }
  
  .toggle-control {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 14px;
    color: #888;
    cursor: pointer;
  }
  
  .toggle-control input[type="checkbox"] {
    cursor: pointer;
  }
  
  .stats {
    display: flex;
    gap: 20px;
  }
  
  .stat-item {
    display: flex;
    gap: 5px;
    font-size: 14px;
  }
  
  .stat-item .label {
    color: #888;
  }
  
  .stat-item .value {
    color: #d1d4dc;
    font-weight: 500;
  }
  
  .filters-section {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }
  
  .search-bar {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
  }
  
  .search-bar input {
    flex: 1;
    padding: 10px 15px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #d1d4dc;
    font-size: 14px;
  }
  
  .search-bar input:focus {
    outline: none;
    border-color: #a78bfa;
  }
  
  .search-btn {
    padding: 10px 20px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.4);
    border-radius: 6px;
    color: #a78bfa;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }
  
  .search-btn:hover {
    background: rgba(74, 0, 224, 0.3);
  }
  
  .filters {
    display: flex;
    gap: 10px;
  }
  
  .filters select {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #d1d4dc;
    font-size: 14px;
    cursor: pointer;
  }
  
  .filters select:focus {
    outline: none;
    border-color: #a78bfa;
  }
  
  .news-container {
    min-height: 400px;
  }
  
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100px 20px;
    color: #888;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(74, 0, 224, 0.3);
    border-top-color: #a78bfa;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .empty-state {
    text-align: center;
    padding: 100px 20px;
    color: #888;
  }
  
  .empty-state h3 {
    margin: 0 0 10px 0;
    color: #a78bfa;
  }
  
  .articles-grid {
    display: grid;
    gap: 20px;
    margin-bottom: 30px;
  }
  
  .news-article {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 20px;
    transition: all 0.2s;
  }
  
  .news-article:hover {
    background: rgba(74, 0, 224, 0.05);
    border-color: rgba(74, 0, 224, 0.5);
  }
  
  .news-article[data-sentiment="bullish"] {
    border-left: 3px solid #26a69a;
  }
  
  .news-article[data-sentiment="bearish"] {
    border-left: 3px solid #ef5350;
  }
  
  .article-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }
  
  .article-meta {
    display: flex;
    align-items: center;
    gap: 15px;
    font-size: 12px;
    color: #888;
  }
  
  .sentiment-icon {
    font-size: 16px;
  }
  
  .impact-indicator {
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: white;
  }
  
  .article-title {
    margin: 0 0 10px 0;
    font-size: 18px;
    line-height: 1.4;
  }
  
  .article-title a {
    color: #d1d4dc;
    text-decoration: none;
    transition: color 0.2s;
  }
  
  .article-title a:hover {
    color: #a78bfa;
  }
  
  .article-summary {
    margin: 0 0 15px 0;
    color: #888;
    line-height: 1.6;
  }
  
  .article-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  
  .tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  
  .tag {
    padding: 4px 10px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 4px;
    font-size: 11px;
    color: #a78bfa;
  }
  
  .ai-analysis {
    font-size: 12px;
    color: #66bb6a;
    display: flex;
    gap: 5px;
  }
  
  .ai-label {
    font-weight: 600;
  }
  
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 20px;
    margin-top: 30px;
  }
  
  .page-btn {
    padding: 8px 16px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.4);
    border-radius: 6px;
    color: #a78bfa;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }
  
  .page-btn:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.3);
  }
  
  .page-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .page-info {
    color: #888;
    font-size: 14px;
  }
  
  .ai-section {
    margin-top: 40px;
    padding-top: 40px;
    border-top: 1px solid rgba(74, 0, 224, 0.3);
  }
  
  .ai-panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 30px;
  }
  
  .ai-panel h2 {
    margin: 0 0 20px 0;
    color: #a78bfa;
  }
  
  .ai-info {
    color: #888;
  }
  
  .ai-info p {
    margin: 0 0 15px 0;
    line-height: 1.6;
  }
  
  .ai-info ul {
    margin: 0 0 20px 20px;
    padding: 0;
  }
  
  .ai-info li {
    margin: 8px 0;
  }
  
  .ai-info .note {
    padding: 15px;
    background: rgba(255, 167, 38, 0.1);
    border: 1px solid rgba(255, 167, 38, 0.3);
    border-radius: 6px;
    color: #ffa726;
    font-size: 14px;
  }
  
  .ai-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-top: 20px;
  }
  
  .ai-stats .stat {
    text-align: center;
    padding: 15px;
    background: rgba(74, 0, 224, 0.1);
    border-radius: 6px;
  }
  
  .ai-stats .stat .label {
    display: block;
    font-size: 12px;
    color: #888;
    margin-bottom: 5px;
  }
  
  .ai-stats .stat .value {
    display: block;
    font-size: 20px;
    color: #a78bfa;
    font-weight: 600;
  }
</style>