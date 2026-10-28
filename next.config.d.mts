declare const nextConfig: {
  rewrites: () => Promise<{
    beforeFiles: Array<{
      source: '/';
      has: Array<{ type: 'host'; value: string }>;
      destination: '/biuro';
    }>;
    afterFiles?: undefined;
    fallback?: undefined;
  }>;
};

export default nextConfig;
