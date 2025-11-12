/* eslint-disable no-console */
import yahooFinance from 'yahoo-finance2';
// Correzione: Importiamo il tipo locale, NON 'QuoteSummaryModules'
import type { YahooQuoteSummaryResponse } from '../lib/types';
import { pRateLimit } from 'p-ratelimit';

// Creare l'istanza
const yahoo = new yahooFinance();

// Mantiene il limitatore di richieste
const limiter = pRateLimit({
  interval: 1000,
  rate: 1,
  concurrency: 1
});

const throttled = async (fn: () => Promise<any>) => {
  return limiter(fn);
};

// Moduli che vogliamo scaricare da Yahoo (con il TIPO CORRETTO)
// Usiamo 'keyof YahooQuoteSummaryResponse' che è il tipo che già abbiamo
const modules: (keyof YahooQuoteSummaryResponse)[] = [
  'price',
  'summaryDetail',
  'balanceSheetHistory',
  'cashflowStatementHistory',
  'incomeStatementHistory',
  'defaultKeyStatistics'
  // 'summaryProfile' è stato rimosso perché non è in lib/types.ts
];

export async function fetchYahooBundle(
  ticker: string,
  opts: { maxQps: number }
): Promise<{ data?: YahooQuoteSummaryResponse; error?: string }> {
  try {
    // La funzione accetterà il nostro array di chiavi
    const data = await throttled(() => 
      yahoo.quoteSummary(ticker, { modules })
    );

    // Facciamo il cast al tipo locale corretto
    return { data: data as YahooQuoteSummaryResponse };
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('404') || message.includes('Not Found')) {
      return { error: 'Quote not found for symbol: ' + ticker };
    }
    console.error(`Validation or fetch error for ${ticker}:`, error);
    return { error: message };
  }
}