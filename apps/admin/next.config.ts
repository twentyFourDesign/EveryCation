import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@everycation/shared', '@everycation/tokens'],
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },
};

export default nextConfig;
