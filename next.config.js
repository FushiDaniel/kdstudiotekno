/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['firebasestorage.googleapis.com'],
    unoptimized: true,
  },
  reactStrictMode: true,
  devIndicators: {
    buildActivity: false,
  },
  output: 'standalone',
  swcMinify: true,
}

module.exports = nextConfig 