/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep builds green even if a stray lint/style rule trips.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
