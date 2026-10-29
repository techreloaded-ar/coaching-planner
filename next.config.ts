import type { NextConfig } from "next";
import { validaSessionSecret } from "./src/lib/session-config";

validaSessionSecret();

const nextConfig: NextConfig = {
  // Il checkout è autonomo anche quando vive dentro una worktree annidata.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  experimental: {
    serverActions: {
      // Con Google simulato (anteprime) l'app è servita anche dietro il proxy
      // locale della preview, che ha un'origine loopback su un'altra porta:
      // senza questa eccezione Next rifiuta ogni Server Action come CSRF.
      // `127.0.0.*` copre qualunque porta (l'ultimo segmento è `1:<porta>`).
      allowedOrigins:
        process.env.E2E_TEST_MODE === "true" ? ["127.0.0.*"] : [],
    },
  },
};

export default nextConfig;
