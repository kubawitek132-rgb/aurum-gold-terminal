/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: false, // MapLibre + deck.gl nie lubią podwójnego montowania w dev
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ['@deck.gl/core', '@deck.gl/layers', '@deck.gl/mapbox'],
  serverExternalPackages: ['ioredis'],
};

export default nextConfig;
