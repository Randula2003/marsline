import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // firebase-admin pulls in jwks-rsa (CommonJS) which require()s jose (ESM only). Vercel's function loader has no require(esm)
  // support, so loading firebase-admin from node_modules crashes every API route with ERR_REQUIRE_ESM. Bundle it instead:
  // the bundler handles the CommonJS/ESM mix, and no Node version or loader feature is needed at run time.
  transpilePackages: ["firebase-admin", "jwks-rsa", "jose"]
};
export default nextConfig;
