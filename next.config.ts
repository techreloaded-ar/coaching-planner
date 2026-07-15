import type { NextConfig } from "next";
import { validaSessionSecret } from "./src/lib/session-config";

validaSessionSecret();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
