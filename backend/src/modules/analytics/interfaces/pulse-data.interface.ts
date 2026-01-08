export interface PulseData {
  candidateId: number;
  candidateName: string;
  partyName: string;
  pulseScore: number;
  trend: "RISING" | "STABLE" | "DECLINING";
  articlesAnalyzed: number;
  timeWindow: string;
  lastUpdated: Date;
  topDrivers: Array<{
    articleId: number;
    headline: string;
    sentiment: string;
    sentimentScore: number;
    confidence: number;
    relevanceWeight: number;
    effectiveScore: number;
    publishedAt: Date;
  }>;
}

export interface TrendData {
  date: string;
  pulseScore: number;
}
