/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  experimental: {
    outputFileTracingIncludes: {
      '/api/cron/process-audit': ['./node_modules/@sparticuz/chromium/bin/**'],
    },
  },
};

export default nextConfig;
