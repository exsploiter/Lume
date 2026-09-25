/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['acorn', 'acorn-walk'],
  },
};

module.exports = nextConfig;
