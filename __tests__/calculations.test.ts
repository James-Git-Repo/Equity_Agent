import { describe, expect, it } from 'vitest';
import { computeCompositeScores, computeDCF, computeForwardView, computeMomentum } from '../lib/calculations';

const snapshot = {
  fcfSeries: [120_000_000, 100_000_000, 80_000_000],
  sharesOutstanding: 50_000_000
};

describe('computeDCF', () => {
  it('discounts forecast cash flows and terminal value', () => {
    const value = computeDCF(snapshot as any, 0.08, 0.02);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(150);
  });
});

describe('computeMomentum', () => {
  it('computes total returns and tags momentum', () => {
    const start = new Date('2023-01-01');
    const history = Array.from({ length: 260 }).map((_, index) => {
      const price = 80 + index * 0.4 + Math.sin(index / 12) * 0.5;
      return {
        date: new Date(start.getTime() + index * 24 * 60 * 60 * 1000),
        close: price
      };
    });
    const momentum = computeMomentum(history);
    expect(momentum.return1M).toBeGreaterThan(0);
    expect(momentum.return3M).toBeGreaterThan(0);
    expect(momentum.return6M).toBeGreaterThan(0);
    expect(['Most Momentum', null]).toContain(momentum.tag);
  });
});

describe('computeCompositeScores', () => {
  it('produces deterministic composite scores', () => {
    const [row] = computeCompositeScores([
      {
        pe: 15,
        evEbitda: 10,
        dcfVsPrice: 20,
        roic: 0.12,
        ebitMargin: 0.2,
        roe: 0.18,
        revenueCagr: 0.1,
        epsCagr: 0.12,
        fcfCagr: 0.08,
        debtToEquity: 0.4,
        interestCoverage: 15,
        insiderNetBuys: 0.02,
        institutionalPct: 0.6,
        shortInterestPct: 0.03,
        beta: 1,
        fcfToNi: 1.1
      }
    ]);
    expect(row.composite).toBeGreaterThan(0);
    expect(row.composite).toBeLessThanOrEqual(100);
    expect(row.subscores.valuation).toBeGreaterThan(0);
  });
});

describe('computeForwardView', () => {
  it('returns base, bull, and bear projections', () => {
    const result = computeForwardView({
      price: 100,
      pe: 15,
      epsCagr: 0.1,
      peMedian: 14,
      beta: 1.1,
      wacc: 0.08
    });
    expect(result.base).toBeTypeOf('number');
    expect(result.bull).toBeGreaterThan(result.base!);
    expect(result.bear).toBeLessThan(result.base!);
  });
});
