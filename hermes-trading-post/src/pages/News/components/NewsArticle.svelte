<script lang="ts">
  export let article: {
    id: string;
    title: string;
    summary: string;
    source: string;
    timestamp: number;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    impact: number;
    category: string;
    url: string;
    keywords: string[];
  };

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
</script>

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

<style>
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
</style>