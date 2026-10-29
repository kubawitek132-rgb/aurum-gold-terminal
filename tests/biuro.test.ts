import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const status = JSON.parse(fs.readFileSync(path.join(root, 'public/biuro-status.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'public/biuro.html'), 'utf8');

const SEATS = [
  'Macro',
  'Sentiment / News',
  'Quant / TA',
  'Price Map',
  'Bull / Bear Research',
  'On-chain',
  'Data Ingest',
  'Sim Lab',
  'Portfolio / PM',
  'Execution / Ship Paper',
  'Audit / Journal',
  'Obserwator AURUM',
  'Obserwator Coin Bot',
  'Fabryka botów',
  'Idea Scout',
];

const EXECS = [
  'CEO / Head Trader',
  'CRO / Risk',
  'COO / Ops',
  'CIO / Alokacja',
  'Research Director',
  'Policy / Compliance',
];

test('paper snapshot spina się z limitem i logiem filli', () => {
  const paper = status.paperBlotter;
  assert.deepEqual(status.paper, paper);
  assert.equal(paper.label, 'Paper snapshot');
  assert.equal(paper.asOf, status.updatedAt);
  assert.equal(paper.mode, 'autonomous');
  assert.equal(paper.pnlKind, 'marked');
  assert.equal(paper.killSwitch, 'off');
  assert.equal(paper.killSwitchTripped, false);
  assert.equal(paper.exposureCapUsd, 5000);
  assert.equal(status.risk.exposureCapUsd, 5000);
  assert.equal(status.risk.dailyDrawdownPct, '2%');
  assert.equal(paper.drawdownLimitPct, 2);
  assert.equal(status.metrics.pnlUsd, paper.pnlUsd);
  assert.equal(status.metrics.exposureUsd, paper.exposureUsd);
  assert.equal(status.metrics.filled, paper.filled);
  assert.equal(status.metrics.killSwitchTripped, false);
  assert.ok(paper.exposureUsd <= paper.exposureCapUsd);
  assert.ok(paper.drawdownPct < paper.drawdownLimitPct);
  assert.ok(paper.maxDrawdownPct < paper.drawdownLimitPct);

  const fills = paper.fills.filter((f: { result: string }) => f.result === 'fill');
  const quiet = paper.fills.filter((f: { result: string }) => f.result === 'no_signal');
  assert.equal(fills.length, paper.filled);
  assert.equal(quiet.length, paper.noSignal);
  assert.equal(paper.wins, fills.filter((f: { pnlUsd: number }) => (f.pnlUsd || 0) > 0).length);

  let pnl = 0;
  let open = 0;
  for (const f of fills) {
    assert.ok(f.symbol === 'BTC/USDT' || f.symbol === 'ETH/USDT');
    assert.equal(f.side, 'buy');
    assert.equal(f.bias, 'up');
    assert.equal(f.notionalUsd, 500);
    pnl += f.pnlUsd || 0;
    if (f.open) open += f.notionalUsd;
  }
  for (const f of quiet) assert.equal(f.bias, 'down');
  assert.ok(Math.abs(pnl - paper.pnlUsd) < 1e-9);
  assert.equal(open, paper.exposureUsd);
});

test('firma ma egzekutywę, fotele, pomysły i fabrykę', () => {
  assert.equal(status.firm.name, 'Biuro HQ');
  assert.deepEqual(status.firm.children, ['aurum', 'coin-bot']);
  const aurum = status.projects.find((p: { id: string }) => p.id === 'aurum');
  const coin = status.projects.find((p: { id: string }) => p.id === 'coin-bot');
  assert.equal(aurum.relation, 'child');
  assert.equal(coin.relation, 'child');
  assert.equal(aurum.parent, 'biuro-hq');
  assert.equal(coin.parent, 'biuro-hq');
  assert.equal(
    aurum.links.find((l: { label: string }) => l.label === 'Terminal').href,
    'https://xauinteligenceooffice.com',
  );
  assert.equal(aurum.links.some((l: { href: string }) => l.href === '/'), false);
  assert.ok(aurum.links.some((l: { href: string }) => l.href === 'https://www.xauinteligenceooffice.com'));
  assert.ok(coin.links.some((l: { href: string }) => l.href === 'https://cursor.com/codebase/kuba-witek/coin-bot'));
  assert.ok(coin.links.some((l: { href: string }) => l.href === 'https://github.com/kubawitek132-rgb/coin-bot'));
  assert.equal(coin.game.label, 'Gra BTC · ETH');
  assert.equal(coin.game.href, 'https://cursor.com/codebase/kuba-witek/coin-bot');
  assert.match(coin.game.note, /nie live/);
  assert.match(coin.game.note, /[Pp]aper game/);
  assert.equal(status.executives.length, EXECS.length);
  assert.deepEqual(status.executives.map((e: { name: string }) => e.name), EXECS);
  for (const e of status.executives) {
    assert.ok(e.does.length > 80, e.name);
    assert.ok(e.decision && e.waiting && e.next && e.blocks);
  }
  assert.deepEqual(status.departments.map((d: { name: string }) => d.name), SEATS);
  for (const d of status.departments) {
    assert.ok(d.does.length > 80, d.name);
    assert.ok(d.input && d.output && d.next && d.blocks, d.name);
  }
  const byName = Object.fromEntries(status.departments.map((d: { name: string }) => [d.name, d]));
  assert.equal(byName['Obserwator AURUM'].does, status.observers.aurum.does);
  assert.equal(byName['Obserwator Coin Bot'].does, status.observers.coinBot.does);
  assert.equal(byName['Fabryka botów'].does, status.botFactory.does);

  const names = status.projects.map((p: { name: string }) => p.name);
  assert.deepEqual(names, ['AURUM', 'Coin Bot', 'Inkubacja']);
  const incub = status.projects.find((p: { id: string }) => p.id === 'incubation');
  assert.ok(incub.slots.length >= 3);
  assert.ok(incub.slots.some((s: { name: string }) => s.name === 'Au Session'));
  assert.ok(incub.slots.some((s: { name: string }) => s.name === 'FX News Alert'));

  const statuses = status.ideas.map((i: { status: string }) => i.status);
  assert.ok(statuses.includes('research'));
  assert.ok(statuses.includes('kolejka'));
  assert.ok(statuses.includes('odrzucone'));
  for (const idea of status.ideas) {
    assert.ok(idea.thesis && idea.invalidation && idea.source && idea.next, idea.title);
  }
  const live = status.botFactory.stages.find((s: { id: string }) => s.id === 'live');
  assert.equal(live.state, 'off');
  assert.ok(status.botFactory.bots.some((b: { name: string }) => b.name === 'Coin Bot'));
  assert.ok(status.botFactory.bots.some((b: { stage: string }) => b.stage === 'Szkielet'));
  assert.equal(status.pipeline.length, 8);
  assert.match(status.update, /ideas\[\]/);
  assert.match(status.update, /bez sekretów/);
});

test('pulpit jest firmą, nie bramką akceptacji, i zostawia CI live', () => {
  assert.equal(/tylko po (Twojej )?akceptacji/i.test(html), false);
  assert.equal(/Realne pieniądze/i.test(html), false);
  assert.match(html, /bez <code>accept\(\)<\/code>/);
  assert.match(html, /nie składa zleceń/);
  assert.match(html, /najcenniejsze słowo/i);
  assert.match(html, /Biuro HQ — ojciec AURUM \+ Coin Bot/);
  assert.match(html, /id="children"/);
  assert.match(html, /Piony-dzieci/);
  assert.match(html, /https:\/\/xauinteligenceooffice\.com/);
  assert.match(html, /https:\/\/www\.xauinteligenceooffice\.com/);
  assert.match(html, /https:\/\/cursor\.com\/codebase\/kuba-witek\/coin-bot/);
  assert.match(html, /Gra BTC · ETH/);
  assert.match(html, /Paper game · lokalny dashboard/);
  assert.match(html, /id="office"/);
  assert.match(html, /function bootOffice/);
  assert.equal(html.includes('href="/"'), false);
  assert.match(html, /id="portfolio"/);
  assert.match(html, /id="exec-grid"/);
  assert.match(html, /id="seat-grid"/);
  assert.match(html, /id="fills-body"/);
  assert.match(html, /id="idea-grid"/);
  assert.match(html, /id="factory-board"/);
  assert.match(html, /id="firm-pipeline"/);
  assert.match(html, /Au Session/);
  assert.match(html, /FX News Alert/);
  assert.match(html, /Live · wyłączone|Live<\/span>|stage off|wyłączone/);
  const order = ['id="children"', 'id="portfolio"', 'id="exec"', 'id="seats"', 'id="fills-body"', 'id="ideas"', 'id="firm-pipeline"'];
  let at = -1;
  for (const token of order) {
    const next = html.indexOf(token);
    assert.ok(next > at, token);
    at = next;
  }
  for (const name of SEATS) assert.ok(html.includes(name), name);
  for (const name of EXECS) assert.ok(html.includes(name), name);
  assert.match(html, /STATUS_URL = '\/biuro-status\.json'/);
  assert.match(html, /function renderPaper/);
  assert.match(html, /function loadCi/);
  assert.match(html, /function renderDesk/);
  assert.match(
    html,
    /https:\/\/api\.github\.com\/repos\/kubawitek132-rgb\/aurum-gold-terminal\/actions\/workflows\/ci\.yml\/runs\?branch=main/,
  );
  assert.match(html, /jobs\[i\]\.name === 'build'/);
  assert.equal(status.risk.paper, 'Autonomiczny paper');
  assert.match(status.risk.paperDetail, /bez accept\(\)/);

  const page = fs.readFileSync(path.join(root, 'src/app/biuro/page.tsx'), 'utf8');
  assert.match(page, /biuro\.html/);
  assert.match(page, /Biuro HQ — ojciec AURUM \+ Coin Bot/);
  const home = fs.readFileSync(path.join(root, 'src/app/page.tsx'), 'utf8');
  assert.equal(home.includes('biuro'), false);
  assert.equal(/api[_-]?key|secret|BEGIN PRIVATE/i.test(JSON.stringify(status)), false);
});
