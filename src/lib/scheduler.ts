/**
 * „Cron” w procesie Node: rozgrzewa cache w tle i sprawdza alerty Telegram.
 * Uruchamiany z src/instrumentation.ts. Wyłączenie: ENABLE_SCHEDULER=false.
 */
import { getMacro } from './services/macro';
import { getCalendar, getChokepoints, getGeo, getRegions, getSeasonality } from './services/data';
import { checkAlerts } from './services/alerts';
import { getCbGold, getGpr, getReactions } from './services/extra';
import { snapshotDaily } from './services/digest';
import { startAis } from './providers/aisstream';

const g = globalThis as unknown as { __aurumScheduler?: boolean };

function every(ms: number, name: string, fn: () => Promise<unknown>, initialDelay = 0) {
  const run = async () => {
    try {
      await fn();
    } catch (e) {
      console.warn(`[scheduler] ${name}: ${e instanceof Error ? e.message : e}`);
    }
  };
  const t = setTimeout(() => {
    run();
    const h = setInterval(run, ms) as unknown as { unref?: () => void };
    h.unref?.();
  }, initialDelay) as unknown as { unref?: () => void };
  t.unref?.();
}

export function startScheduler() {
  if (g.__aurumScheduler || process.env.ENABLE_SCHEDULER === 'false') return;
  g.__aurumScheduler = true;
  console.log('[scheduler] start');
  startAis();
  // cache pilnuje TTL — tu tylko „pukamy”, żeby dane były gotowe przed pierwszym żądaniem
  every(30 * 60_000, 'macro', getMacro, 1_000);
  every(10 * 60_000, 'calendar', getCalendar, 3_000);
  every(10 * 60_000, 'geo', getGeo, 5_000);
  every(15 * 60_000, 'chokepoints', getChokepoints, 15_000);
  every(60 * 60_000, 'regions', getRegions, 30_000);
  every(6 * 3600_000, 'seasonality', getSeasonality, 60_000);
  every(12 * 3600_000, 'gpr', getGpr, 45_000);
  every(12 * 3600_000, 'cbgold', getCbGold, 50_000);
  every(12 * 3600_000, 'reactions', getReactions, 90_000);
  every(30 * 60_000, 'snapshot', snapshotDaily, 100_000);
  every(5 * 60_000, 'alerts', checkAlerts, 120_000);
}
