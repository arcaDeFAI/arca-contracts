/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  outputFileTracingRoot: __dirname,
  webpack(config) {
    // Ensure typechain-types in the parent directory can resolve 'ethers'
    // from the UI node_modules (since root node_modules may not exist)
    config.resolve.modules = [
      ...(config.resolve.modules || []),
      path.resolve(__dirname, 'node_modules'),
    ];
    return config;
  },
};

module.exports = nextConfig;
