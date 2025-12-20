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
    background: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
    transition: all var(--transition-normal);
    cursor: pointer;
  }

  .news-article:hover {
    background: var(--bg-primary-hover);
    border-color: var(--border-primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .news-article.bullish {
    border-left: 3px solid var(--color-success);
  }

  .news-article.bearish {
    border-left: 3px solid var(--color-error);
  }

  .article-header {
    display: flex;
    gap: var(--space-sm);
    align-items: flex-start;
    margin-bottom: var(--space-md);
  }

  .sentiment-icon {
    font-size: var(--font-size-lg);
    flex-shrink: 0;
  }

  .article-header h3 {
    margin: 0;
    font-size: var(--font-size-md);
    color: var(--color-primary);
    line-height: 1.4;
    font-weight: var(--font-weight-semibold);
  }

  .article-summary {
    color: var(--text-accent);
    font-size: var(--font-size-sm);
    line-height: 1.5;
    margin: var(--space-md) 0;
  }

  .article-meta {
    display: flex;
    gap: var(--space-md);
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    margin: var(--space-md) 0;
    flex-wrap: wrap;
  }

  .source {
    font-weight: var(--font-weight-semibold);
  }

  .category {
    text-transform: uppercase;
    font-weight: var(--font-weight-medium);
    letter-spacing: 0.5px;
  }

  .impact {
    color: var(--color-warning);
  }

  .article-keywords {
    display: flex;
    gap: var(--space-sm);
    flex-wrap: wrap;
    margin-top: var(--space-md);
  }

  .keyword {
    padding: var(--space-xs) var(--space-sm);
    background: var(--bg-primary-active);
    border: 1px solid var(--border-primary-active);
    border-radius: var(--radius-full);
    font-size: var(--font-size-xs);
    color: var(--color-primary);
    font-weight: var(--font-weight-medium);
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .news-article {
      padding: var(--space-lg);
    }
    
    .article-header h3 {
      font-size: var(--font-size-sm);
    }
    
    .article-summary {
      font-size: var(--font-size-xs);
    }
    
    .article-meta {
      gap: var(--space-sm);
    }
  }
</style>