/**
 * @file newsService.ts
 * @description Fetches and processes crypto news data
 */

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  timestamp: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  impact: number; // 1-10 scale
  tags: string[];
  keywords: string[];
  
  // Price correlation data
  priceAtPublish?: number;
  priceChange1h?: number;
  priceChange24h?: number;
  
  // AI-specific fields
  aiAnalysis?: string;
  confidence?: number;
  tradingSignal?: 'buy' | 'sell' | 'hold';
}

export interface NewsFilter {
  category?: string;
  sentiment?: string;
  timeframe?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface NewsResponse {
  articles: NewsArticle[];
  total: number;
  page: number;
}

export interface AITrainingData {
  articleId: string;
  timestamp: number;
  sentiment: string;
  impact: number;
  priceAtPublish: number;
  priceChange1h: number;
  priceChange24h: number;
  keywords: string[];
  category: string;
  source: string;
  resultingAction?: 'buy' | 'sell' | 'hold';
  resultingProfit?: number;
}

class NewsService {
  private aiTrainingData: AITrainingData[] = [];
  private mockArticles: NewsArticle[] = [];

  constructor() {
    // Initialize with mock data
    this.generateMockArticles();
  }

  async fetchNews(filter: NewsFilter): Promise<NewsResponse> {
    // In production, this would call real news APIs
    // For now, return filtered mock data
    
    let filtered = [...this.mockArticles];
    
    // Apply filters
    if (filter.category && filter.category !== 'all') {
      filtered = filtered.filter(article => 
        article.tags.some(tag => tag.toLowerCase() === filter.category)
      );
    }
    
    if (filter.sentiment && filter.sentiment !== 'all') {
      filtered = filtered.filter(article => article.sentiment === filter.sentiment);
    }
    
    if (filter.timeframe) {
      const cutoff = this.getTimeframeCutoff(filter.timeframe);
      filtered = filtered.filter(article => article.timestamp >= cutoff);
    }
    
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(article => 
        article.title.toLowerCase().includes(searchLower) ||
        article.summary.toLowerCase().includes(searchLower) ||
        article.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    // Pagination
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const start = (page - 1) * limit;
    const paginatedArticles = filtered.slice(start, start + limit);
    
    return {
      articles: paginatedArticles,
      total: filtered.length,
      page
    };
  }

  async storeArticlesForAI(articles: NewsArticle[], currentPrice: number): Promise<void> {
    // Store articles with price correlation for AI training
    const trainingData: AITrainingData[] = articles.map(article => ({
      articleId: article.id,
      timestamp: article.timestamp,
      sentiment: article.sentiment,
      impact: article.impact,
      priceAtPublish: article.priceAtPublish || currentPrice,
      priceChange1h: article.priceChange1h || 0,
      priceChange24h: article.priceChange24h || 0,
      keywords: article.keywords,
      category: article.tags[0] || 'general',
      source: article.source
    }));
    
    this.aiTrainingData.push(...trainingData);
    
    // In production, this would store to a database
    console.log(`Stored ${trainingData.length} articles for AI training. Total: ${this.aiTrainingData.length}`);
  }

  getAITrainingData(): AITrainingData[] {
    return this.aiTrainingData;
  }

  analyzeNewsImpact(article: NewsArticle): { 
    signal: 'buy' | 'sell' | 'hold', 
    confidence: number,
    reasoning: string 
  } {
    // Simple rule-based analysis for now
    // In future, this will be replaced by AI model
    
    let score = 0;
    let reasoning = [];
    
    // Sentiment analysis
    if (article.sentiment === 'bullish') {
      score += article.impact * 2;
      reasoning.push('Positive sentiment');
    } else if (article.sentiment === 'bearish') {
      score -= article.impact * 2;
      reasoning.push('Negative sentiment');
    }
    
    // Keyword analysis
    const bullishKeywords = ['adoption', 'institutional', 'upgrade', 'partnership', 'breakthrough'];
    const bearishKeywords = ['ban', 'hack', 'crash', 'regulation', 'lawsuit'];
    
    article.keywords.forEach(keyword => {
      if (bullishKeywords.some(bk => keyword.toLowerCase().includes(bk))) {
        score += 5;
        reasoning.push(`Bullish keyword: ${keyword}`);
      }
      if (bearishKeywords.some(bk => keyword.toLowerCase().includes(bk))) {
        score -= 5;
        reasoning.push(`Bearish keyword: ${keyword}`);
      }
    });
    
    // Impact weighting
    if (article.impact >= 8) {
      score = score * 1.5;
      reasoning.push('High impact news');
    }
    
    // Generate signal
    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    if (score > 10) signal = 'buy';
    else if (score < -10) signal = 'sell';
    
    const confidence = Math.min(Math.abs(score) / 20, 1) * 100;
    
    return {
      signal,
      confidence,
      reasoning: reasoning.join(', ')
    };
  }

  private getTimeframeCutoff(timeframe: string): number {
    const now = Date.now();
    switch (timeframe) {
      case '1h': return now - 60 * 60 * 1000;
      case '24h': return now - 24 * 60 * 60 * 1000;
      case '7d': return now - 7 * 24 * 60 * 60 * 1000;
      case '30d': return now - 30 * 24 * 60 * 60 * 1000;
      default: return now - 24 * 60 * 60 * 1000;
    }
  }

  private generateMockArticles() {
    const sources = ['CoinDesk', 'CryptoSlate', 'The Block', 'Decrypt', 'Bitcoin Magazine'];
    const sentiments: ('bullish' | 'bearish' | 'neutral')[] = ['bullish', 'bearish', 'neutral'];
    
    const mockTitles = [
      {
        title: "BlackRock Increases Bitcoin ETF Holdings to $10 Billion",
        sentiment: 'bullish' as const,
        impact: 9,
        tags: ['bitcoin', 'institutional'],
        keywords: ['BlackRock', 'ETF', 'institutional', 'adoption']
      },
      {
        title: "Federal Reserve Hints at Crypto-Friendly Regulations",
        sentiment: 'bullish' as const,
        impact: 8,
        tags: ['regulation', 'macro'],
        keywords: ['Federal Reserve', 'regulation', 'policy', 'adoption']
      },
      {
        title: "Major Exchange Suffers Security Breach, $50M Lost",
        sentiment: 'bearish' as const,
        impact: 9,
        tags: ['security', 'crypto'],
        keywords: ['hack', 'security', 'breach', 'exchange']
      },
      {
        title: "Bitcoin Mining Difficulty Reaches All-Time High",
        sentiment: 'neutral' as const,
        impact: 5,
        tags: ['bitcoin', 'technology'],
        keywords: ['mining', 'difficulty', 'network', 'hashrate']
      },
      {
        title: "MicroStrategy Announces $500M Bitcoin Purchase",
        sentiment: 'bullish' as const,
        impact: 7,
        tags: ['bitcoin', 'institutional'],
        keywords: ['MicroStrategy', 'institutional', 'purchase', 'adoption']
      },
      {
        title: "China Reiterates Crypto Ban, Markets Unfazed",
        sentiment: 'neutral' as const,
        impact: 4,
        tags: ['regulation', 'crypto'],
        keywords: ['China', 'ban', 'regulation', 'market']
      },
      {
        title: "Lightning Network Adoption Surges 400% Year-over-Year",
        sentiment: 'bullish' as const,
        impact: 6,
        tags: ['bitcoin', 'technology'],
        keywords: ['Lightning Network', 'adoption', 'scaling', 'technology']
      },
      {
        title: "IMF Warns of Cryptocurrency Risks to Financial Stability",
        sentiment: 'bearish' as const,
        impact: 7,
        tags: ['regulation', 'macro'],
        keywords: ['IMF', 'risk', 'financial stability', 'warning']
      },
      {
        title: "Major Bank Launches Crypto Custody Service",
        sentiment: 'bullish' as const,
        impact: 8,
        tags: ['institutional', 'crypto'],
        keywords: ['bank', 'custody', 'institutional', 'service']
      },
      {
        title: "DeFi Protocol Exploited for $30 Million",
        sentiment: 'bearish' as const,
        impact: 6,
        tags: ['defi', 'security'],
        keywords: ['DeFi', 'exploit', 'hack', 'vulnerability']
      }
    ];
    
    // Generate 50 mock articles
    for (let i = 0; i < 50; i++) {
      const template = mockTitles[i % mockTitles.length];
      const hoursAgo = Math.floor(Math.random() * 72); // Up to 3 days old
      const priceVariation = (Math.random() - 0.5) * 5000; // +/- $2500
      
      this.mockArticles.push({
        id: `article-${i + 1}`,
        title: template.title,
        summary: `${template.title}. This development has significant implications for the cryptocurrency market and could affect trading strategies moving forward. Market analysts are closely watching the situation.`,
        url: `https://example.com/article-${i + 1}`,
        source: sources[Math.floor(Math.random() * sources.length)],
        timestamp: Date.now() - (hoursAgo * 60 * 60 * 1000),
        sentiment: template.sentiment,
        impact: template.impact + Math.floor(Math.random() * 3) - 1, // +/- 1 from base
        tags: template.tags,
        keywords: template.keywords,
        priceAtPublish: 95000 + priceVariation,
        priceChange1h: (Math.random() - 0.5) * 2, // +/- 1%
        priceChange24h: (Math.random() - 0.5) * 5, // +/- 2.5%
      });
    }
    
    // Sort by timestamp (newest first)
    this.mockArticles.sort((a, b) => b.timestamp - a.timestamp);
  }
}

// Export singleton instance
export const newsService = new NewsService();