import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // A self-contained server for the Docker image (deploy/). Has no effect on next dev.
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  transpilePackages: ['@everycation/shared', '@everycation/tokens'],
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },
};

export default nextConfig;
