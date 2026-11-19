import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/ascii-animals',
  trailingSlash: true,
  reactStrictMode: true,
  outputFileTracingRoot: fileURLToPath(new URL('..', import.meta.url)),
  // The dependency is the built package, linked from this isolated consumer.
  // There are deliberately no aliases to src/ or private renderer files.
};

export default nextConfig;
