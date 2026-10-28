/** Hosts that serve the Biuro desk at `/`. Every other host keeps the gold terminal. */
export const BIURO_HQ_HOSTS = ['biurohq.com', 'www.biurohq.com'];

/**
 * Next.js matches `has.value` with `new RegExp('^' + value + '$')` after
 * lowercasing the hostname and stripping a port (matchHas, type `host`).
 * Escape regex metacharacters so `biurohq.com` does not also match `biurohqXcom`.
 */
function hostHasValue(host) {
  return host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rewrites for `beforeFiles` only. `afterFiles` runs after the app page at `/`
 * has already matched, so the gold terminal would win on biurohq.com.
 * Destination `/biuro` is an internal rewrite: the address bar stays `/`.
 */
export function biuroHqRootRewrites() {
  return BIURO_HQ_HOSTS.map((host) => ({
    source: '/',
    has: [{ type: 'host', value: hostHasValue(host) }],
    destination: '/biuro',
  }));
}
