import { biuroHqRootRewrites } from './src/lib/biuroHost.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: false, // MapLibre + deck.gl nie lubią podwójnego montowania w dev
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ['@deck.gl/core', '@deck.gl/layers', '@deck.gl/mapbox'],
  serverExternalPackages: ['ioredis'],
  // beforeFiles: strona złota na `/` nie może przesłonić pulpitu Biuro.
  // Rewrite, nie redirect — na biurohq.com pasek adresu zostaje `/`.
  async rewrites() {
    return { beforeFiles: biuroHqRootRewrites() };
  },
};

export default nextConfig;
