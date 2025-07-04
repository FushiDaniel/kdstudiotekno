/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['firebasestorage.googleapis.com'],
  },
  reactStrictMode: true,
  devIndicators: {
    buildActivity: false,
  },
}

module.exports = nextConfig 