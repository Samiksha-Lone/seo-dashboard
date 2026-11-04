/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  experimental: {
    outputFileTracingIncludes: {
      '/**': ['./src/generated/prisma/libquery_engine-rhel-openssl-3.0.x.so.node'],
    },
  },
};

export default nextConfig;
