export interface GuideHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface GuideStreamResult {
  full: string;
  cached: boolean;
  source: 'faq' | 'llm';
}
