import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';

export interface RawInputRow {
  Name?: string;
  ISIN?: string;
  Symbol?: string;
  Market?: string;
  Currency?: string;
}

export function normalizeTicker(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function detectDelimiter(sample: string): string {
  const candidates: Array<{ delimiter: string; score: number }> = [
    { delimiter: ',', score: 0 },
    { delimiter: ';', score: 0 },
    { delimiter: '\t', score: 0 },
    { delimiter: '|', score: 0 }
  ];

  const firstLine = sample.split(/\r?\n/u).find((line) => line.trim().length > 0) ?? '';
  candidates.forEach((candidate) => {
    const d = candidate.delimiter;
    const escaped = d === '|' ? '\\|' : d; 
    const pattern = new RegExp(escaped, 'gu');
    candidate.score = (firstLine.match(pattern) ?? []).length;
  });

  const best = candidates.reduce((prev, next) => (next.score > prev.score ? next : prev));
  return best.score > 0 ? best.delimiter : ',';
}

const columnAliases: Record<keyof RawInputRow, string[]> = {
  Name: ['Name', 'name', 'Company Name', 'Security Name', 'Issuer', 'Instrument'],
  ISIN: ['ISIN', 'isin', 'Isin', 'ISIN Code', 'ISIN CODE'],
  Symbol: ['Symbol', 'symbol', 'Ticker', 'ticker', 'Mnemonic', 'mnemonic'],
  Market: ['Market', 'market', 'Exchange', 'exchange', 'Primary Market', 'Primary market'],
  Currency: ['Currency', 'currency', 'Curr', 'curr', 'Trading Currency']
};

function extractValue(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return undefined;
}

export function parseInputFile(filePath: string): RawInputRow[] {
  const absolute = resolve(filePath);
  const text = readFileSync(absolute, 'utf8');
  const delimiter = detectDelimiter(text);
  const rawRows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter
  }) as Record<string, unknown>[];

  return rawRows.map((row) => {
    const normalized: RawInputRow = {};
    (Object.keys(columnAliases) as Array<keyof RawInputRow>).forEach((field) => {
      const value = extractValue(row, columnAliases[field]);
      if (value) {
        normalized[field] = value;
      }
    });
    return normalized;
  });
}

export function loadIsinMap(filePath: string): Record<string, string> {
  const absolute = resolve(filePath);
  const text = readFileSync(absolute, 'utf8');
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Record<string, string>[];
  const map: Record<string, string> = {};
  rows.forEach((row) => {
    const isinValue = row.ISIN ?? row.isin ?? row.Isin;
    const tickerValue = row.ticker ?? row.Ticker ?? row.symbol ?? row.Symbol;
    if (isinValue && tickerValue) {
      map[isinValue.toUpperCase()] = normalizeTicker(tickerValue);
    }
  });
  return map;
}
