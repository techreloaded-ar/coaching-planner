import { validaSessionSecret } from "@/lib/session-config";

export function register() {
  validaSessionSecret();
}
