export type LogLevel = 'info' | 'warn' | 'error';

export interface ProcessingLogItem {
  timestamp: string;
  level: LogLevel;
  stage: 'resolve' | 'fetch' | 'compute' | 'save' | 'client';
  message: string;
}

export interface InputRow {
  input: string;
  ticker?: string;
  isin?: string;
  symbol?: string;
  name?: string;
  market?: string;
  currency?: string;
  inputRank: number;
}

export interface MetricRow {
  ticker: string;
  status: 'ok' | 'error';
  statusMessage?: string;
  compositeScore?: number;
  subscores?: Record<string, number | null>;
  momentumTag?: string | null;
  expReturn6M?: {
    base: number | null;
    bull: number | null;
    bear: number | null;
    confidence?: number | null;
  };
  metrics?: Record<string, number | string | null>;
}

export interface RunResponse {
  rows: MetricRow[];
  logs: ProcessingLogItem[];
}

export interface YahooQuoteSummaryResponse {
  price?: {
    regularMarketPrice?: { raw?: number };
    marketCap?: { raw?: number };
    beta?: { raw?: number };
    shortName?: string;
    longName?: string;
    currency?: string;
  };
  financialData?: {
    totalDebt?: { raw?: number };
    totalCash?: { raw?: number };
    ebitda?: { raw?: number };
    freeCashflow?: { raw?: number };
    recommendationMean?: { raw?: number };
  };
  defaultKeyStatistics?: {
    sharesOutstanding?: { raw?: number };
    trailingEps?: { raw?: number };
    shortPercentOfFloat?: { raw?: number };
    heldPercentInsiders?: { raw?: number };
    heldPercentInstitutions?: { raw?: number };
  };
  summaryDetail?: {
    dividendYield?: { raw?: number };
  };
  incomeStatementHistory?: {
    incomeStatementHistory?: Array<{
      totalRevenue?: { raw?: number };
      costOfRevenue?: { raw?: number };
      ebit?: { raw?: number };
      netIncome?: { raw?: number };
      incomeBeforeTax?: { raw?: number };
      incomeTaxExpense?: { raw?: number };
      interestExpense?: { raw?: number };
    }>;
  };
  cashflowStatementHistory?: {
    cashflowStatements?: Array<{
      totalCashFromOperatingActivities?: { raw?: number };
      capitalExpenditures?: { raw?: number };
      freeCashFlow?: { raw?: number };
      dividendsPaid?: { raw?: number };
    }>;
  };
  balanceSheetHistory?: {
    balanceSheetStatements?: Array<{
      totalAssets?: { raw?: number };
      totalCurrentAssets?: { raw?: number };
      totalCurrentLiabilities?: { raw?: number };
      totalShareholderEquity?: { raw?: number };
      totalLiab?: { raw?: number };
      retainedEarnings?: { raw?: number };
      totalDebt?: { raw?: number };
      cash?: { raw?: number };
      netReceivables?: { raw?: number };
      inventory?: { raw?: number };
    }>;
  };
}

export interface YahooPriceHistoryPoint {
  date: Date;
  close: number;
}

export interface MomentumSnapshot {
  return1M: number | null;
  return3M: number | null;
  return6M: number | null;
  tag: string | null;
  distanceFromHigh: number | null;
  distanceFromLow: number | null;
}

export interface ForwardView {
  base: number | null;
  bull: number | null;
  bear: number | null;
  confidence: number | null;
}
