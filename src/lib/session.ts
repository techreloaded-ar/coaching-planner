import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Ruolo } from "@/domain/types";

// ── Costanti ────────────────────────────────────────────────────

/** Durata della sessione in ore (rinnovo sliding). */
export const DURATA_SESSIONE_ORE = 8;

const NOME_COOKIE = "cp_sessione";

// ── Payload ─────────────────────────────────────────────────────

export interface PayloadSessione {
  utenteId: string;
  ruolo: Ruolo;
  nome: string;
  email: string;
  expiresAt: number; // timestamp Unix in secondi
}

// ── Helpers di crittografia ─────────────────────────────────────

function chiaveSegreta(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret === "changeme-change-me-change-me-change-me") {
    throw new Error(
      "SESSION_SECRET non configurata. Imposta una chiave sicura in .env.local."
    );
  }
  return new TextEncoder().encode(secret);
}

async function encrypt(payload: PayloadSessione): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURATA_SESSIONE_ORE}h`)
    .sign(chiaveSegreta());
}

async function decrypt(token: string): Promise<PayloadSessione | null> {
  try {
    const { payload } = await jwtVerify<PayloadSessione>(
      token,
      chiaveSegreta(),
      { algorithms: ["HS256"] }
    );
    return payload;
  } catch {
    // Token scaduto, manomesso o con firma non valida → sessione nulla
    return null;
  }
}

// ── Operazioni sul cookie ───────────────────────────────────────

function opzioniCookie(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

/**
 * Crea una nuova sessione: crittografa il payload e imposta il cookie.
 */
export async function createSession(
  utenteId: string,
  ruolo: Ruolo,
  nome: string,
  email: string
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + DURATA_SESSIONE_ORE * 3600;

  const payload: PayloadSessione = {
    utenteId,
    ruolo,
    nome,
    email,
    expiresAt,
  };

  const token = await encrypt(payload);
  const cookieStore = await cookies();

  cookieStore.set(NOME_COOKIE, token, opzioniCookie(new Date(expiresAt * 1000)));
}

/**
 * Rinnova la scadenza della sessione (sliding).
 * Presuppone che il cookie sia già presente; se assente non fa nulla.
 */
export async function updateSession(): Promise<void> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(NOME_COOKIE);

  if (!existing?.value) return;

  const payload = await decrypt(existing.value);
  if (!payload) return;

  const now = Math.floor(Date.now() / 1000);
  const newExpiresAt = now + DURATA_SESSIONE_ORE * 3600;

  const updatedPayload: PayloadSessione = {
    ...payload,
    expiresAt: newExpiresAt,
  };

  const token = await encrypt(updatedPayload);
  cookieStore.set(
    NOME_COOKIE,
    token,
    opzioniCookie(new Date(newExpiresAt * 1000))
  );
}

/**
 * Elimina la sessione (logout).
 */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(NOME_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  });
}

/**
 * Legge e decrittografa la sessione dal cookie senza interagire con il DB.
 * Restituisce `null` se assente, scaduta o manomessa.
 * Usata dal proxy per check ottimistici.
 */
export async function getSessionCookie(): Promise<PayloadSessione | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(NOME_COOKIE)?.value;
  if (!token) return null;
  return decrypt(token);
}
