import type { GeoCategory, GoldImpact } from './types';

/**
 * Heurystyki „jak to zwykle wpływa na złoto”. Celowo proste i przejrzyste —
 * to adnotacje edukacyjne, nie sygnały transakcyjne.
 */

interface Rule {
  match: RegExp;
  /** true = wyższy odczyt zwykle szkodzi złotu (dla danych USA) */
  higherBearish: boolean | null;
  note: string;
}

const US_RULES: Rule[] = [
  {
    match: /\b(cpi|pce|ppi|inflation|price index)\b/i,
    higherBearish: true,
    note: 'Wyższy odczyt → oczekiwania na jastrzębi Fed, wyższe rentowności i mocniejszy USD → presja na XAU. Niższy → wsparcie dla złota.',
  },
  {
    match: /non-?farm|\bnfp\b|adp|employment change|jolts|job openings|average hourly earnings/i,
    higherBearish: true,
    note: 'Silny rynek pracy → mniej obniżek/więcej jastrzębia → mocniejszy USD → zwykle spadek XAU. Słaby odczyt → złoto w górę.',
  },
  {
    match: /unemployment rate|jobless|unemployment claims|continuing claims/i,
    higherBearish: false,
    note: 'Wyższe bezrobocie / więcej wniosków → słabsza gospodarka, gołębi Fed → zwykle wsparcie dla złota.',
  },
  {
    match: /fomc|federal funds|fed chair|powell|fed .*speaks|monetary policy|rate decision|press conference/i,
    higherBearish: null,
    note: 'Decyzja/komunikacja Fed: jastrzębi ton (wyższe stopy, mniej cięć) → presja na XAU; gołębi → wsparcie. Spodziewaj się skoku zmienności.',
  },
  {
    match: /\bgdp\b|ism|pmi|retail sales|durable goods|industrial production|consumer confidence|sentiment|housing starts|building permits/i,
    higherBearish: true,
    note: 'Mocniejsze dane o aktywności → wyższe rentowności i USD → zwykle negatywne dla złota. Słabsze → pozytywne.',
  },
];

export function calendarGoldNote(
  title: string,
  currency: string,
  actual: string,
  forecast: string,
): { note: string; impact: GoldImpact } {
  const surprise = numericSurprise(actual, forecast);
  if (currency === 'USD') {
    const rule = US_RULES.find((r) => r.match.test(title));
    if (!rule) {
      return {
        note: 'Publikacja z USA: odczyt powyżej prognozy zwykle wzmacnia USD (negatywne dla XAU), poniżej – osłabia USD (pozytywne).',
        impact: surprise === null ? 'NEUTRAL' : surprise > 0 ? 'BEARISH' : surprise < 0 ? 'BULLISH' : 'NEUTRAL',
      };
    }
    if (rule.higherBearish === null || surprise === null || surprise === 0) return { note: rule.note, impact: 'NEUTRAL' };
    const bearish = rule.higherBearish ? surprise > 0 : surprise < 0;
    return { note: rule.note, impact: bearish ? 'BEARISH' : 'BULLISH' };
  }
  if (currency === 'CNY') {
    return {
      note: 'Dane z Chin: słabsza gospodarka bywa ambiwalentna – może osłabić popyt jubilerski, ale zwiększa zakupy PBoC/inwestycyjne jako bezpieczna przystań.',
      impact: 'NEUTRAL',
    };
  }
  if (/rate|monetary|speaks|press/i.test(title)) {
    return {
      note: `Bank centralny ${currency}: jastrzębi ton umacnia ${currency} i osłabia DXY → pośrednio wspiera XAUUSD (efekt zwykle mniejszy niż dla Fed).`,
      impact: 'NEUTRAL',
    };
  }
  const higherIsInverse = /unemployment|claims/i.test(title);
  let impact: GoldImpact = 'NEUTRAL';
  if (surprise !== null && surprise !== 0) {
    const positiveForCcy = higherIsInverse ? surprise < 0 : surprise > 0;
    impact = positiveForCcy ? 'BULLISH' : 'BEARISH';
  }
  return {
    note: `Lepsze dane dla ${currency} → mocniejsza waluta, słabszy DXY → lekkie wsparcie dla XAUUSD. Efekt pośredni, zwykle drugorzędny.`,
    impact,
  };
}

/** Parsuje „0.3%”, „215K”, „-1.2B”, „<0.1%”. */
export function parseNum(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = s.replace(/[<>,\s]/g, '').match(/^(-?\d+(?:\.\d+)?)([KMBT%])?/i);
  if (!m) return null;
  let v = parseFloat(m[1]);
  const suf = (m[2] || '').toUpperCase();
  if (suf === 'K') v *= 1e3;
  else if (suf === 'M') v *= 1e6;
  else if (suf === 'B') v *= 1e9;
  else if (suf === 'T') v *= 1e12;
  return v;
}

function numericSurprise(actual: string, forecast: string): number | null {
  const a = parseNum(actual);
  const f = parseNum(forecast);
  if (a === null || f === null) return null;
  return a - f;
}

const CONFLICT =
  /\b(wars?|strikes?|struck|air ?strikes?|missiles?|drones?|attack(s|ed)?|shelling|bomb(s|ed|ing)?|invasion|invade[sd]?|offensive|troops|clash(es)?|killed|explosions?|rockets?|military drills?|warships?|blockade|fighting|militants?)\b/i;
const SANCTIONS = /\bsanction/i;
const TRADE = /\b(tariffs?|trade wars?|export bans?|export controls?|embargo(es)?|duties)\b/i;
const DIPLOMACY = /\b(ceasefire|truce|peace (talks|deal|plan)|negotiat\w*|summit|de-?escalat\w*|agreements?)\b/i;

export function classifyGeo(title: string): { category: GeoCategory; impact: GoldImpact } {
  if (DIPLOMACY.test(title) && !CONFLICT.test(title.replace(/ceasefire/i, ''))) return { category: 'diplomacy', impact: 'BEARISH' };
  if (CONFLICT.test(title)) return { category: 'conflict', impact: 'BULLISH' };
  if (SANCTIONS.test(title)) return { category: 'sanctions', impact: 'BULLISH' };
  if (TRADE.test(title)) return { category: 'trade', impact: 'BULLISH' };
  if (DIPLOMACY.test(title)) return { category: 'diplomacy', impact: 'BEARISH' };
  return { category: 'other', impact: 'NEUTRAL' };
}

const NEWS_BULL =
  /(rate cut|cuts rates|dovish|weaker dollar|dollar (falls|slips|weakens|drops)|yields (fall|drop|slide|ease)|safe[- ]haven|gold (rises|jumps|climbs|gains|rallies|surges|hits record|record high)|central bank buying|inflation (rises|jumps|accelerates))/i;
const NEWS_BEAR =
  /(rate hike|hikes rates|hawkish|stronger dollar|dollar (rises|gains|strengthens|jumps)|yields (rise|jump|climb|surge)|gold (falls|drops|slips|declines|slides|tumbles)|outflows)/i;

export function classifyNews(title: string): { topic: 'gold' | 'fed' | 'usd' | 'inflation' | 'geopolitics' | 'other'; impact: GoldImpact } {
  let topic: 'gold' | 'fed' | 'usd' | 'inflation' | 'geopolitics' | 'other' = 'other';
  if (/\b(gold|bullion|xau|precious metal)/i.test(title)) topic = 'gold';
  else if (/\b(fed|fomc|federal reserve|powell|rate cut|rate hike|interest rate)/i.test(title)) topic = 'fed';
  else if (/\b(dollar|greenback|dxy|treasur)/i.test(title)) topic = 'usd';
  else if (/\b(inflation|cpi|prices)\b/i.test(title)) topic = 'inflation';
  else if (CONFLICT.test(title) || SANCTIONS.test(title) || TRADE.test(title)) topic = 'geopolitics';
  const bull = NEWS_BULL.test(title);
  const bear = NEWS_BEAR.test(title);
  let impact: GoldImpact = 'NEUTRAL';
  if (bull && !bear) impact = 'BULLISH';
  else if (bear && !bull) impact = 'BEARISH';
  else if (topic === 'geopolitics') impact = 'BULLISH';
  return { topic, impact };
}
