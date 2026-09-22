/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'yogibo.cafe24.com' },
      { protocol: 'https', hostname: 'yogibo.jp' },
    ],
  },
};

module.exports = nextConfig;
