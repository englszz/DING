import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() { return [{source:"/:path*",headers:[
    {key:"X-Content-Type-Options",value:"nosniff"},
    {key:"X-Frame-Options",value:"DENY"},
    {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
    {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},
    {key:"Content-Security-Policy",value:"object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"},
  ]}]; },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "archive.org", pathname: "/download/mbid-*/**" },
      { protocol: "https", hostname: "*.us.archive.org", pathname: "/download/mbid-*/**" },
      { protocol: "https", hostname: "*.eu.archive.org", pathname: "/download/mbid-*/**" },
      {protocol:"https",hostname:"is*-ssl.mzstatic.com",pathname:"/image/**"},
      {
        protocol: "https",
        hostname: "coverartarchive.org",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "thumb.wikimedia.org",
        pathname: "/wikipedia/**",
      },
    ],
  },
};

export default nextConfig;
