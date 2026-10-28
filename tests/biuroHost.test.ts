import { test } from 'node:test';
import assert from 'node:assert/strict';
import nextConfig from '../next.config.mjs';
import { BIURO_HQ_HOSTS, biuroHqRootRewrites } from '../src/lib/biuroHost.mjs';

/**
 * Same host check as Next.js `matchHas` for `type: 'host'`:
 * strip a port, lowercase, then test `has.value` as an anchored regex.
 */
function hostMatches(hostHeader: string, pattern: string): boolean {
  const hostname = hostHeader.split(':', 1)[0].toLowerCase();
  return new RegExp(`^${pattern}$`).test(hostname);
}

test('biurohq.com i www: / → pulpit Biuro, inne hosty zostają przy złocie', async () => {
  const rewrites = await nextConfig.rewrites();
  const rules = biuroHqRootRewrites();

  assert.deepEqual(rewrites.beforeFiles, rules);
  assert.equal(rewrites.afterFiles, undefined);
  assert.equal(rewrites.fallback, undefined);
  assert.equal(rules.length, BIURO_HQ_HOSTS.length);

  for (const rule of rules) {
    assert.equal(rule.source, '/');
    assert.equal(rule.destination, '/biuro');
    assert.deepEqual(
      rule.has.map((item) => item.type),
      ['host'],
    );
  }

  for (const path of ['/biuro', '/biuro.html', '/biuro-status.json']) {
    assert.equal(
      rules.some((rule) => rule.source === path),
      false,
      path,
    );
  }

  const patterns = rules.map((rule) => rule.has[0].value);
  const matchesAny = (host: string) => patterns.some((pattern) => hostMatches(host, pattern));

  for (const host of [
    'biurohq.com',
    'www.biurohq.com',
    'BiuroHQ.com',
    'WWW.BIUROHQ.COM',
    'biurohq.com:443',
    'www.biurohq.com:443',
  ]) {
    assert.equal(matchesAny(host), true, host);
  }

  for (const host of [
    'localhost',
    'localhost:3000',
    '127.0.0.1:3000',
    'aurum-gold-terminal-two.vercel.app',
    'xauinteligenceooffice.com',
    'www.xauinteligenceooffice.com',
    'notbiurohq.com',
    'biurohq.com.evil.example',
    'biurohqXcom',
    'preview.biurohq.com',
  ]) {
    assert.equal(matchesAny(host), false, host);
  }

  const apex = patterns.find((pattern) => hostMatches('biurohq.com', pattern));
  const www = patterns.find((pattern) => hostMatches('www.biurohq.com', pattern));
  assert.ok(apex);
  assert.ok(www);
  assert.notEqual(apex, www);
  assert.equal(hostMatches('www.biurohq.com', apex), false);
  assert.equal(hostMatches('biurohq.com', www), false);
});
