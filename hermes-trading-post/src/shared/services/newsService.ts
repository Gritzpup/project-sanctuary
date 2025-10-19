/**
 * @file newsService.ts
 * @description News service for fetching, filtering, and paginating articles
 */

export interface NewsArticle {
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

/**
 * Generate mock news data
 */
export function generateMockNews(): NewsArticle[] {
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

/**
 * Load news
 */
export async function loadNews(): Promise<NewsArticle[]> {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));

  // Use mock data for now
  return generateMockNews();
}

/**
 * Apply filters to articles
 */
export function applyFilters(
  articles: NewsArticle[],
  selectedCategory: string,
  selectedSentiment: string,
  selectedTimeframe: string,
  searchQuery: string
): NewsArticle[] {
  return articles.filter(article => {
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
    const timeframeMs = {
      '1h': 3600000,
      '24h': 86400000,
      '7d': 604800000,
      '30d': 2592000000
    }[selectedTimeframe] || 86400000;

    if (now - article.timestamp > timeframeMs) {
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

/**
 * Paginate articles
 */
export function paginateArticles(
  articles: NewsArticle[],
  currentPage: number,
  articlesPerPage: number
): { articles: NewsArticle[], totalPages: number } {
  const totalPages = Math.ceil(articles.length / articlesPerPage);
  const paginatedArticles = articles.slice(
    (currentPage - 1) * articlesPerPage,
    currentPage * articlesPerPage
  );

  return { articles: paginatedArticles, totalPages };
}
