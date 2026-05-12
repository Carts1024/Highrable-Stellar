/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui", "@repo/convex-client", "@creit-tech/stellar-wallets-kit"],
};

export default nextConfig;
