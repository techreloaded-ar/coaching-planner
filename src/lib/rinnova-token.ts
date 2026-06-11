import { SignJWT, jwtVerify } from "jose";
import type { PayloadSessione } from "@/lib/session";
import { DURATA_SESSIONE_ORE } from "@/lib/session";

/**
 * Rinnova un token di sessione ri-firmandolo con jose (HS256).
 * Decodifica il payload esistente e produce un nuovo JWT con exp ed
 * expiresAt aggiornati (now + DURATA_SESSIONE_ORE).
 *
 * Restituisce il nuovo token oppure null se:
 * - SESSION_SECRET non è configurata
 * - il token è scaduto, manomesso o non valido
 */
export async function rinnovaToken(token: string): Promise<string | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret === "changeme-change-me-change-me-change-me") {
    return null;
  }

  const chiave = new TextEncoder().encode(secret);

  // Decodifica il payload esistente
  let payload: PayloadSessione | null = null;
  try {
    const result = await jwtVerify<PayloadSessione>(token, chiave, {
      algorithms: ["HS256"],
    });
    payload = result.payload;
  } catch {
    return null;
  }

  if (!payload) return null;

  // Ri-firma con exp ed expiresAt aggiornati
  const now = Math.floor(Date.now() / 1000);
  const newExpiresAt = now + DURATA_SESSIONE_ORE * 3600;

  const newPayload: PayloadSessione = {
    ...payload,
    expiresAt: newExpiresAt,
  };

  return new SignJWT({ ...newPayload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURATA_SESSIONE_ORE}h`)
    .sign(chiave);
}
