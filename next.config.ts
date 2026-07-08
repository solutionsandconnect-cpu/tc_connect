import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 'app.enezo.localhost' = test LOCAL de la résolution par host (marque Enezo) en dev.
  allowedDevOrigins: ['192.168.1.16', '100.121.83.75', 'app.enezo.localhost'],
};

export default nextConfig;
