import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { validaSessionSecret } from "@/lib/session-config";

// Cifratura a riposo dei token OAuth (AES-256-GCM).
//
// La chiave è derivata da SESSION_SECRET con un'etichetta di dominio, così non
// serve una seconda variabile d'ambiente. Ruotare SESSION_SECRET rende
// illeggibili i token salvati: il collaboratore dovrà ricollegare il calendario.

const ALGORITMO = "aes-256-gcm";
const VERSIONE = "v1";

function chiave(): Buffer {
  return createHash("sha256")
    .update(`coaching-planner:token-calendario-google:${validaSessionSecret()}`)
    .digest();
}

/** Restituisce `v1.<iv>.<tag>.<testo cifrato>` in base64url. */
export function cifraToken(testoInChiaro: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITMO, chiave(), iv);
  const cifrato = Buffer.concat([cipher.update(testoInChiaro, "utf8"), cipher.final()]);
  return [VERSIONE, iv, cipher.getAuthTag(), cifrato]
    .map((parte) => (typeof parte === "string" ? parte : parte.toString("base64url")))
    .join(".");
}

/** Lancia se il valore è malformato, manomesso o cifrato con un'altra chiave. */
export function decifraToken(valoreCifrato: string): string {
  const [versione, iv, tag, cifrato] = valoreCifrato.split(".");
  if (versione !== VERSIONE || !iv || !tag || cifrato === undefined) {
    throw new Error("Token cifrato non valido");
  }
  const decipher = createDecipheriv(ALGORITMO, chiave(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(cifrato, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
