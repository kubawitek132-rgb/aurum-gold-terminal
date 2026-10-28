export const BIURO_HQ_HOSTS: readonly string[];

export function biuroHqRootRewrites(): Array<{
  source: '/';
  has: Array<{ type: 'host'; value: string }>;
  destination: '/biuro';
}>;
