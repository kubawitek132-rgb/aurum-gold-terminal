#!/usr/bin/env node
/**
 * Sprawdza src/data/central-banks.json: które banki miały posiedzenie po dacie `asOf`
 * (trzeba wpisać wynik do lastChange i podbić asOf), komu brakuje przyszłych dat
 * i kiedy kolejne decyzje. Uruchom: npm run check-banks
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../src/data/central-banks.json', import.meta.url));
const { asOf, banks } = JSON.parse(readFileSync(file, 'utf8'));
const now = Date.now();
const DAY = 86_400_000;
const asOfT = Date.parse(asOf);
let problems = 0;

console.log(`central-banks.json — stan na ${asOf} (${Math.floor((now - asOfT) / DAY)} dni temu)\n`);
for (const b of banks) {
  const t = b.meetings.map(Date.parse).filter(Number.isFinite).sort((a, c) => a - c);
  const missed = t.filter((x) => x > asOfT + DAY && x <= now);
  const next = t.find((x) => x > now);
  const notes = [];
  if (missed.length) notes.push(`⚠ posiedzenie ${new Date(missed.at(-1)).toISOString().slice(0, 10)} po asOf — wpisz wynik`);
  if (!next) notes.push('⚠ brak przyszłych dat w meetings');
  else if (t.filter((x) => x > now).length < 2) notes.push('dopisz kolejne daty (została 1)');
  if (b.verify) notes.push(`do weryfikacji: ${b.verify}`);
  if (notes.some((n) => n.startsWith('⚠'))) problems++;
  const nx = next ? `${new Date(next).toISOString().slice(0, 16).replace('T', ' ')} UTC (za ${Math.ceil((next - now) / DAY)} d)` : '—';
  console.log(`${b.short.padEnd(5)} ${b.rateLabel.padEnd(34)} następna: ${nx.padEnd(36)} ${notes.join(' · ')}`);
}
console.log(problems ? `\n${problems} bank(i) wymaga aktualizacji.` : '\nWszystko aktualne.');
process.exitCode = problems ? 1 : 0;
