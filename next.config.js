/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/image-with-disclaimer': ['./public/fonts/**/*'],
  },
}

module.exports = nextConfig
