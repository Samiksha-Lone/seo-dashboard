/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  experimental: {
    serverComponentsExternalPackages: ['@sparticuz/chromium'],
    outputFileTracingIncludes: {
      '/api/cron/process-audit': ['./node_modules/@sparticuz/chromium/**'],
    },
  },
};

export default nextConfig;
