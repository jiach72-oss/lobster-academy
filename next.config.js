/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      // H5: 保护 data/ 目录 — 禁止直接 Web 访问
      {
        source: '/data/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      // H1: 全局安全响应头
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self';",
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
  // H5: 防止 data/ 下文件被 Next.js 作为静态资源服务
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/data/:path*',
          destination: '/api/not-found',
        },
      ],
    };
  },
};

module.exports = nextConfig;
