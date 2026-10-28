'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { BiuroTokensSnapshot, TokenChainFilter } from '@/lib/biuroTokens';
import styles from './CoinExplorer.module.css';

function money(value: number | null, compact = false): string {
  if (value === null) return '—';
  if (!compact && value > 0 && value < 0.000000000001) return `$${value.toExponential(3)}`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: compact ? 'compact' : 'standard', maximumFractionDigits: compact || value >= 1 ? 2 : 12 }).format(value);
}

function receiptTime(value: string): string {
  return new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Warsaw' }).format(new Date(value));
}

export function CoinExplorer() {
  const id = useId();
  const [query, setQuery] = useState('SOL');
  const [chain, setChain] = useState<TokenChainFilter>('solana');
  const [data, setData] = useState<BiuroTokensSnapshot | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const request = useRef<AbortController | null>(null);
  const version = useRef(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => { clearInterval(timer); version.current++; request.current?.abort(); };
  }, []);

  async function search(event?: FormEvent) {
    event?.preventDefault();
    const text = query.trim();
    if (text.length < 2 || text.length > 64) { setData(null); setState('error'); setError('Wpisz symbol lub adres kontraktu (2–64 znaki).'); return; }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const current = ++version.current;
    setState('loading'); setError(''); setData(null);
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const params = new URLSearchParams({ q: text, chain });
      const response = await fetch(`/api/biuro/tokens?${params}`, { cache: 'no-store', signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || 'Nie udało się pobrać wyników.');
      if (current !== version.current) return;
      setData(payload as BiuroTokensSnapshot); setNow(Date.now()); setState('ready');
    } catch (failure) {
      if (current !== version.current) return;
      setError(controller.signal.aborted ? 'Wyszukiwanie trwało zbyt długo. Spróbuj ponownie.' : failure instanceof Error ? failure.message : 'Nie udało się pobrać wyników.');
      setState('error');
    } finally { clearTimeout(timeout); }
  }

  const old = data ? now - Date.parse(data.fetchedAt) > 60_000 : false;
  return <section className={styles.explorer} aria-labelledby={`${id}-title`}>
    <div className={styles.heading}><div><span className={styles.eyebrow}>ODKRYWAJ RYNEK</span><h3 id={`${id}-title`}>Tokeny i pary DEX</h3></div><span className={styles.sourceBadge}>DEX Screener</span></div>
    <p className={styles.description}>Solana i inne sieci. Szukaj po symbolu lub adresie kontraktu.</p>
    <form onSubmit={search} className={styles.searchForm}>
      <label className={styles.searchLabel} htmlFor={`${id}-query`}>Symbol lub adres kontraktu</label>
      <div className={styles.searchRow}><input id={`${id}-query`} type="search" value={query} onChange={event => setQuery(event.target.value)} minLength={2} maxLength={64} placeholder="SOL, BONK lub adres kontraktu" autoComplete="off" spellCheck={false} /><button type="submit" disabled={state === 'loading'} aria-label="Wyszukaj token">{state === 'loading' ? <span className={styles.spinner} /> : '⌕'}</button></div>
      <div className={styles.filterRow}><label htmlFor={`${id}-chain`}>Sieć</label><select id={`${id}-chain`} value={chain} onChange={event => setChain(event.target.value as TokenChainFilter)}><option value="solana">Solana</option><option value="all">Wszystkie sieci</option></select><button type="submit" disabled={state === 'loading'}>{state === 'loading' ? 'Szukam…' : 'Szukaj par'}</button></div>
    </form>
    <div className={styles.feedback} aria-live="polite" aria-atomic="true">
      {error && <p className={styles.error} role="alert">{error}</p>}
      {state === 'idle' && <p className={styles.empty}><span>⌕</span>Wyszukaj token, aby zobaczyć rzeczywiste pary i płynność.</p>}
      {state === 'loading' && <p className={styles.loading}><span className={styles.spinner} />Pobieranie par z DEX Screener…</p>}
      {data && <div className={styles.receipt}><span>{data.pairs.length ? `${data.pairs.length} par · ${data.query}` : `Brak par dla „${data.query}”`}</span><span className={old ? styles.oldReceipt : ''}>{old ? 'Ostatni odczyt' : 'Odebrano'} {receiptTime(data.fetchedAt)}</span></div>}
      {data && !data.pairs.length && <p className={styles.noMatches}>Spróbuj pełnego adresu kontraktu lub wybierz wszystkie sieci.</p>}
    </div>
    {data && data.pairs.length > 0 && <div className={styles.results}>{data.pairs.map(pair => <article className={styles.pairCard} key={`${pair.chainId}:${pair.pairAddress}`}>
      <div className={styles.pairHeading}><div><h4 title={pair.name}>{pair.symbol}<span> / {pair.quoteSymbol}</span></h4><p title={pair.name}>{pair.name}</p></div><span className={pair.chainId === 'solana' ? styles.solanaBadge : styles.chainBadge}>{pair.chainId}</span></div>
      <div className={styles.pairPrice}><strong>{money(pair.priceUsd)}</strong><span>USD · {pair.dexId}</span></div>
      <dl className={styles.metrics}><div><dt>Płynność</dt><dd title={pair.liquidityUsd === null ? 'Źródło nie udostępnia wartości' : money(pair.liquidityUsd)}>{money(pair.liquidityUsd, true)}</dd></div><div><dt>Wolumen 24h</dt><dd title={pair.volume24hUsd === null ? 'Źródło nie udostępnia wartości' : money(pair.volume24hUsd)}>{money(pair.volume24hUsd, true)}</dd></div></dl>
      <div className={styles.pairFooter}><span title={`Adres kontraktu: ${pair.baseAddress}`}>{pair.baseAddress.slice(0, 6)}…{pair.baseAddress.slice(-5)}</span><a href={pair.url} target="_blank" rel="noopener noreferrer">Zobacz parę <span>↗</span></a></div>
    </article>)}</div>}
    <p className={styles.note}>{data ? 'Czas oznacza odbiór API; źródło nie podaje czasu notowania. ' : ''}Symbol może oznaczać różne tokeny — porównaj adres kontraktu.</p>
  </section>;
}

export default CoinExplorer;
