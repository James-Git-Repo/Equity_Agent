import type { ForwardView, MomentumSnapshot, YahooQuoteSummaryResponse, YahooPriceHistoryPoint } from './types';

const DAYS_IN_MONTH = 30;

function safeDiv(numerator: number | null | undefined, denominator: number | null | undefined): number | null {
  if (numerator === null || numerator === undefined || denominator === null || denominator === undefined) return null;
  if (denominator === 0) return null;
  return numerator / denominator;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface FinancialSnapshot {
  price: number | null;
  marketCap: number | null;
  sharesOutstanding: number | null;
  epsTtm: number | null;
  revenueSeries: number[];
  fcfSeries: number[];
  epsSeries: number[];
  ebit: number | null;
  ebitda: number | null;
  netIncome: number | null;
  totalEquity: number | null;
  totalAssets: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  totalDebt: number | null;
  cash: number | null;
  interestExpense: number | null;
  revenue: number | null;
  cogs: number | null;
  beta: number | null;
  shortInterestPct: number | null;
  insiderNetBuys: number | null;
  institutionalPct: number | null;
  fundFlows3M: number | null;
  retainedEarnings: number | null;
  totalLiabilities: number | null;
}

export function buildFinancialSnapshot(data: YahooQuoteSummaryResponse): FinancialSnapshot {
  const incomeStatements = data.incomeStatementHistory?.incomeStatementHistory ?? [];
  const balanceSheets = data.balanceSheetHistory?.balanceSheetStatements ?? [];
  const cashflows = data.cashflowStatementHistory?.cashflowStatements ?? [];

  const revenueSeries = incomeStatements
    .slice(0, 3)
    .map((statement) => statement.totalRevenue?.raw ?? null)
    .filter((value): value is number => value !== null);
  const epsSeries = incomeStatements
    .slice(0, 3)
    .map((statement) => {
      const netIncome = statement.netIncome?.raw;
      const shares = data.defaultKeyStatistics?.sharesOutstanding?.raw;
      if (!netIncome || !shares) return null;
      return netIncome / shares;
    })
    .filter((value): value is number => value !== null);
  const fcfSeries = cashflows
    .slice(0, 3)
    .map((statement) => {
      const freeCashFlow = statement.freeCashFlow?.raw;
      if (freeCashFlow !== undefined && freeCashFlow !== null) return freeCashFlow;
      const operatingCashFlow = statement.totalCashFromOperatingActivities?.raw;
      const capex = statement.capitalExpenditures?.raw;
      if (operatingCashFlow === undefined || capex === undefined) return null;
      return operatingCashFlow + capex;
    })
    .filter((value): value is number => value !== null);

  return {
    price: data.price?.regularMarketPrice?.raw ?? null,
    marketCap: data.price?.marketCap?.raw ?? null,
    sharesOutstanding: data.defaultKeyStatistics?.sharesOutstanding?.raw ?? null,
    epsTtm: data.defaultKeyStatistics?.trailingEps?.raw ?? null,
    revenueSeries,
    fcfSeries,
    epsSeries,
    ebit: incomeStatements?.[0]?.ebit?.raw ?? null,
    ebitda: data.financialData?.ebitda?.raw ?? null,
    netIncome: incomeStatements?.[0]?.netIncome?.raw ?? null,
    totalEquity: balanceSheets?.[0]?.totalShareholderEquity?.raw ?? null,
    totalAssets: balanceSheets?.[0]?.totalAssets?.raw ?? null,
    currentAssets: balanceSheets?.[0]?.totalCurrentAssets?.raw ?? null,
    currentLiabilities: balanceSheets?.[0]?.totalCurrentLiabilities?.raw ?? null,
    totalDebt: balanceSheets?.[0]?.totalDebt?.raw ?? data.financialData?.totalDebt?.raw ?? null,
    cash: balanceSheets?.[0]?.cash?.raw ?? data.financialData?.totalCash?.raw ?? null,
    interestExpense: incomeStatements?.[0]?.interestExpense?.raw ?? null,
    revenue: incomeStatements?.[0]?.totalRevenue?.raw ?? null,
    cogs: incomeStatements?.[0]?.costOfRevenue?.raw ?? null,
    beta: data.price?.beta?.raw ?? null,
    shortInterestPct: data.defaultKeyStatistics?.shortPercentOfFloat?.raw ?? null,
    insiderNetBuys: data.defaultKeyStatistics?.heldPercentInsiders?.raw ?? null,
    institutionalPct: data.defaultKeyStatistics?.heldPercentInstitutions?.raw ?? null,
    fundFlows3M: null,
    retainedEarnings: balanceSheets?.[0]?.retainedEarnings?.raw ?? null,
    totalLiabilities: balanceSheets?.[0]?.totalLiab?.raw ?? null
  };
}

function growth(series: number[]): number | null {
  if (series.length < 2) return null;
  const first = series.at(-1);
  const last = series[0];
  if (first === undefined || last === undefined || first <= 0 || last <= 0) return null;
  const years = Math.min(series.length - 1, 3);
  return (last / first) ** (1 / years) - 1;
}

export function computeSeriesCagr(series: number[]): number | null {
  return growth(series);
}

export function computeDCF(snapshot: FinancialSnapshot, wacc: number, terminalGrowth = 0.02): number | null {
  if (snapshot.fcfSeries.length === 0 || !snapshot.sharesOutstanding) return null;
  const fcfTtm = snapshot.fcfSeries[0];
  if (fcfTtm === undefined || fcfTtm === null) return null;
  const fcfCagr = clamp(growth(snapshot.fcfSeries) ?? 0, -0.2, 0.25);
  const forecast: number[] = [];
  let current = fcfTtm;
  for (let i = 1; i <= 5; i += 1) {
    current *= 1 + fcfCagr;
    forecast.push(current);
  }
  const discount = (value: number, year: number) => value / (1 + wacc) ** year;
  const discountedSum = forecast.reduce((acc, value, index) => acc + discount(value, index + 1), 0);
  const terminalValue = forecast.at(-1);
  if (terminalValue === undefined) return null;
  const terminal = discount((terminalValue * (1 + terminalGrowth)) / (wacc - terminalGrowth), forecast.length);
  return (discountedSum + terminal) / snapshot.sharesOutstanding;
}

export function computeMomentum(history: YahooPriceHistoryPoint[]): MomentumSnapshot {
  if (!history.length) {
    return {
      return1M: null,
      return3M: null,
      return6M: null,
      tag: null,
      distanceFromHigh: null,
      distanceFromLow: null
    };
  }

  const sorted = [...history].sort((a, b) => a.date.getTime() - b.date.getTime());
  const latest = sorted.at(-1)!.close;
  const priceAt = (daysAgo: number) => {
    const cutoff = new Date(sorted.at(-1)!.date.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const point = [...sorted].reverse().find((item) => item.date <= cutoff);
    return point?.close ?? null;
  };

  const price1M = priceAt(DAYS_IN_MONTH);
  const price3M = priceAt(DAYS_IN_MONTH * 3);
  const price6M = priceAt(DAYS_IN_MONTH * 6);

  const return1M = price1M ? latest / price1M - 1 : null;
  const return3M = price3M ? latest / price3M - 1 : null;
  const return6M = price6M ? latest / price6M - 1 : null;

  let tag: string | null = null;
  if (return1M !== null && return3M !== null && return6M !== null) {
    if (return1M > 0 && return3M > 0 && return6M > 0 && return3M > return6M && return1M > return3M) {
      tag = 'Most Momentum';
    }
  }

  const closes = sorted.map((point) => point.close);
  const high = Math.max(...closes);
  const low = Math.min(...closes);
  const distanceFromHigh = high ? latest / high - 1 : null;
  const distanceFromLow = low ? latest / low - 1 : null;

  return {
    return1M,
    return3M,
    return6M,
    tag,
    distanceFromHigh,
    distanceFromLow
  };
}

export interface ScoreInputs {
  pe: number | null;
  evEbitda: number | null;
  dcfVsPrice: number | null;
  roic: number | null;
  ebitMargin: number | null;
  roe: number | null;
  revenueCagr: number | null;
  epsCagr: number | null;
  fcfCagr: number | null;
  debtToEquity: number | null;
  interestCoverage: number | null;
  insiderNetBuys: number | null;
  institutionalPct: number | null;
  shortInterestPct: number | null;
  beta: number | null;
  fcfToNi: number | null;
}

function normalizeMinBetter(value: number | null, series: number[]): number | null {
  if (value === null) return null;
  const min = Math.min(...series);
  const max = Math.max(...series);
  if (min === max) return 0.5;
  return (max - value) / (max - min);
}

function normalizeMaxBetter(value: number | null, series: number[]): number | null {
  if (value === null) return null;
  const min = Math.min(...series);
  const max = Math.max(...series);
  if (min === max) return 0.5;
  return (value - min) / (max - min);
}

function bellScore(value: number | null, center = 1, width = 0.5): number | null {
  if (value === null) return null;
  const distance = Math.abs(value - center);
  return Math.exp(-(distance ** 2) / (2 * width ** 2));
}

export function computeCompositeScores(rows: ScoreInputs[]): {
  composite: number;
  subscores: Record<string, number | null>;
}[] {
  const values = (key: keyof ScoreInputs) => rows.map((row) => row[key]).filter((value): value is number => value !== null);
  const defaultNeutral = 0.5;

  const makeScore = (value: number | null, series: number[], mode: 'min' | 'max' = 'max') => {
    if (value === null || series.length === 0) return defaultNeutral;
    return mode === 'max' ? normalizeMaxBetter(value, series) ?? defaultNeutral : normalizeMinBetter(value, series) ?? defaultNeutral;
  };

  return rows.map((row) => {
    const valuation = [
      makeScore(row.pe, values('pe'), 'min'),
      makeScore(row.evEbitda, values('evEbitda'), 'min'),
      makeScore(row.dcfVsPrice, values('dcfVsPrice'))
    ];
    const profitability = [
      makeScore(row.roic, values('roic')),
      makeScore(row.ebitMargin, values('ebitMargin')),
      makeScore(row.roe, values('roe'))
    ];
    const growthScores = [
      makeScore(row.revenueCagr, values('revenueCagr')),
      makeScore(row.epsCagr, values('epsCagr')),
      makeScore(row.fcfCagr, values('fcfCagr'))
    ];
    const health = [
      makeScore(row.debtToEquity, values('debtToEquity'), 'min'),
      makeScore(row.interestCoverage, values('interestCoverage'))
    ];
    const sentiment = [
      makeScore(row.insiderNetBuys, values('insiderNetBuys')),
      makeScore(row.institutionalPct, values('institutionalPct')),
      makeScore(row.shortInterestPct, values('shortInterestPct'), 'min'),
      makeScore(row.beta ? 1 - Math.abs(row.beta - 1) : null, values('beta'))
    ];
    const earnQuality = [bellScore(row.fcfToNi) ?? defaultNeutral];

    const weighted = (scores: number[], weights: number[]) =>
      scores.reduce((acc, score, index) => acc + score * weights[index], 0) / weights.reduce((acc, weight) => acc + weight, 0);

    const subscoreValuation = weighted(valuation, [1, 1, 1]);
    const subscoreProfitability = weighted(profitability, [0.5, 0.25, 0.25]);
    const subscoreGrowth = weighted(growthScores, [0.4, 0.4, 0.2]);
    const subscoreHealth = weighted(health, [0.5, 0.5]);
    const subscoreSentiment = weighted(sentiment, [0.4, 0.3, 0.2, 0.1]);
    const subscoreEarnQuality = earnQuality[0];

    const composite =
      subscoreValuation * 0.25 +
      subscoreProfitability * 0.2 +
      subscoreGrowth * 0.2 +
      subscoreHealth * 0.15 +
      subscoreSentiment * 0.1 +
      subscoreEarnQuality * 0.1;

    return {
      composite: Math.round(composite * 100),
      subscores: {
        valuation: Math.round(subscoreValuation * 100),
        profitability: Math.round(subscoreProfitability * 100),
        growth: Math.round(subscoreGrowth * 100),
        health: Math.round(subscoreHealth * 100),
        sentiment: Math.round(subscoreSentiment * 100),
        earningsQuality: Math.round(subscoreEarnQuality * 100)
      }
    };
  });
}

export function computeForwardView(params: {
  price: number | null;
  pe: number | null;
  epsCagr: number | null;
  peMedian: number | null;
  beta: number | null;
  wacc: number;
}): ForwardView {
  const { price, pe, epsCagr, peMedian, beta, wacc } = params;
  if (!price || !pe) {
    return { base: null, bull: null, bear: null, confidence: null };
  }
  const growth = epsCagr ?? 0;
  const normalizedBeta = beta ?? 1;
  const drift = clamp(growth, -0.2, 0.25);
  const baseMultiple = peMedian ?? pe;
  const multipleMeanReversion = (baseMultiple - pe) * 0.3;
  const macroShock = normalizedBeta > 1.3 ? -1 : normalizedBeta < 0.7 ? 1 : 0;
  const expectedPe = clamp(pe + multipleMeanReversion + macroShock, pe * 0.7, pe * 1.3);
  const epsForward = price / pe * (1 + drift / 2);
  const basePrice = epsForward * expectedPe;
  const base = (basePrice / price - 1) * 100;
  const bull = (basePrice * 1.15 / price - 1) * 100;
  const bear = (basePrice * 0.85 / price - 1) * 100;
  const confidence = 1 - Math.min(1, Math.abs(drift) + Math.abs(normalizedBeta - 1) + Math.max(0, 0.1 - wacc));
  return { base, bull, bear, confidence };
}

export function deriveMetrics(snapshot: FinancialSnapshot) {
  const price = snapshot.price;
  const pe = snapshot.epsTtm && snapshot.epsTtm > 0 && price ? price / snapshot.epsTtm : null;
  const ev = snapshot.marketCap && snapshot.totalDebt !== null && snapshot.cash !== null ? snapshot.marketCap + snapshot.totalDebt - snapshot.cash : null;
  const evEbitda = ev !== null && snapshot.ebitda && snapshot.ebitda > 0 ? ev / snapshot.ebitda : null;

  const totalDebt = snapshot.totalDebt ?? 0;
  const investedCapital = snapshot.totalAssets && snapshot.currentLiabilities !== null && snapshot.cash !== null
    ? snapshot.totalAssets - snapshot.currentLiabilities - snapshot.cash
    : snapshot.totalDebt !== null && snapshot.totalEquity !== null && snapshot.cash !== null
      ? snapshot.totalDebt + snapshot.totalEquity - snapshot.cash
      : null;
  const taxRate = 0.25;
  const nopat = snapshot.ebit ? snapshot.ebit * (1 - taxRate) : null;
  const roic = nopat !== null && investedCapital ? nopat / investedCapital : null;
  const grossMargin = snapshot.revenue && snapshot.cogs !== null ? (snapshot.revenue - snapshot.cogs) / snapshot.revenue : null;
  const ebitMargin = snapshot.revenue && snapshot.ebit ? snapshot.ebit / snapshot.revenue : null;
  const netMargin = snapshot.revenue && snapshot.netIncome ? snapshot.netIncome / snapshot.revenue : null;
  const roe = snapshot.netIncome && snapshot.totalEquity ? snapshot.netIncome / snapshot.totalEquity : null;
  const revenueCagr = growth(snapshot.revenueSeries);
  const epsCagr = growth(snapshot.epsSeries);
  const fcfCagr = growth(snapshot.fcfSeries);
  const debtToEquity = snapshot.totalDebt !== null && snapshot.totalEquity ? snapshot.totalDebt / snapshot.totalEquity : null;
  const interestCoverage = snapshot.ebit && snapshot.interestExpense ? clamp(snapshot.ebit / snapshot.interestExpense, -100, 100) : null;
  const fcfToNi = snapshot.fcfSeries[0] && snapshot.netIncome ? snapshot.fcfSeries[0] / snapshot.netIncome : null;

  const wc = snapshot.currentAssets !== null && snapshot.currentLiabilities !== null ? snapshot.currentAssets - snapshot.currentLiabilities : null;
  const re = snapshot.retainedEarnings ?? null;
  const ta = snapshot.totalAssets ?? null;
  const mve = snapshot.marketCap ?? null;
  const tl = snapshot.totalLiabilities ?? (snapshot.totalAssets && snapshot.totalEquity ? snapshot.totalAssets - snapshot.totalEquity : null);
  const sales = snapshot.revenue ?? null;
  const altmanZ = wc !== null && re !== null && snapshot.ebit !== null && mve !== null && tl !== null && sales !== null && ta !== null
    ? 1.2 * safeDiv(wc, ta)! +
      1.4 * safeDiv(re, ta)! +
      3.3 * safeDiv(snapshot.ebit, ta)! +
      0.6 * safeDiv(mve, tl)! +
      1.0 * safeDiv(sales, ta)!
    : null;

  return {
    price,
    pe,
    ev,
    evEbitda,
    roic,
    grossMargin,
    ebitMargin,
    netMargin,
    roe,
    revenueCagr,
    epsCagr,
    fcfCagr,
    debtToEquity,
    interestCoverage,
    fcfToNi,
    altmanZ
  };
}
