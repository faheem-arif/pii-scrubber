/** @type {import("next").NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig = {
  output: "export",
  reactStrictMode: true,
  images: {
    unoptimized: true
  },
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
