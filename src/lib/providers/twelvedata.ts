/**
 * Provider (opcjonalny): Twelve Data — wyłącznie miesięczna historia XAU/USD do panelu sezonowości.
 * Zużycie: 1 kredyt na dobę. Bez klucza panel sezonowości pokazuje komunikat zamiast danych.
 */
import { fetchJson } from '../http';
import type { SeriesPoint } from '../types';

export function tdConfigured(): boolean {
  return !!process.env.TWELVEDATA_API_KEY;
}

export async function tdMonthly(symbol = 'XAU/USD', outputsize = 300): Promise<SeriesPoint[]> {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) throw new Error('Brak TWELVEDATA_API_KEY');
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1month&outputsize=${outputsize}&apikey=${key}`;
  const raw = await fetchJson<{ status?: string; message?: string; values?: { datetime: string; close: string }[] }>(url);
  if (raw.status === 'error' || !raw.values) throw new Error(`TwelveData: ${raw.message ?? 'brak danych'}`);
  return raw.values
    .map((v) => ({ date: v.datetime.slice(0, 10), value: Number(v.close) }))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Dzienne zamknięcia XAU/USD (do statystyk reakcji na zdarzenia) — 1 kredyt na dobę. */
export async function tdDaily(symbol = 'XAU/USD', outputsize = 5000): Promise<SeriesPoint[]> {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) throw new Error('Brak TWELVEDATA_API_KEY');
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=${outputsize}&apikey=${key}`;
  const raw = await fetchJson<{ status?: string; message?: string; values?: { datetime: string; close: string }[] }>(url, 30_000);
  if (raw.status === 'error' || !raw.values) throw new Error(`TwelveData: ${raw.message ?? 'brak danych'}`);
  return raw.values
    .map((v) => ({ date: v.datetime.slice(0, 10), value: Number(v.close) }))
    .filter((p) => Number.isFinite(p.value) && p.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}
