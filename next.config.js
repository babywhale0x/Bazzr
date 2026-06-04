/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@mysten/walrus', '@mysten/sui'],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@telegram-apps/bridge': false,
      '@telegram-apps/sdk': false,
      '@telegram-apps/transformers': false,
      '@telegram-apps/types': false,
      'fs': false,
      'net': false,
      'tls': false,
      'dns': false,
      'child_process': false,
    };
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.walrus.space',
      },
      {
        protocol: 'https',
        hostname: '**.ipfs.io',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
};
module.exports = nextConfig;