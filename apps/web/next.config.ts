import path from 'node:path';

import type { NextConfig } from 'next';

const apiBasePath = process.env.API_BASE_PATH ?? process.env.NEXT_PUBLIC_API_BASE_PATH ?? '/api';
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, '../..')
  },
  transpilePackages: ['@balance/config', '@balance/types', '@balance/ui', '@balance/utils'],
  async rewrites() {
    return [
      {
        source: `${apiBasePath}/:path*`,
        destination: `${apiProxyTarget}/:path*`
      }
    ];
  }
};

export default nextConfig;
