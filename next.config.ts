import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The phone loads this dev server by LAN address. Next blocks that unless the host is listed.
  allowedDevOrigins: ["127.0.0.1", "localhost", "10.165.42.27"],
};

export default nextConfig;
