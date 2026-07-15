import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { PayloadSessione, Ruolo } from "@/domain/types";
import {
  calcolaScadenzaSessione,
  chiaveSessioneSegreta,
} from "@/lib/session-config";

interface DatiSessione {
  utenteId: string;
  ruolo: Ruolo;
  nome: string;
  email: string;
}

interface OpzioniTempoSessione {
  now?: number;
}

export interface RisultatoVerificaERinnovoSessione {
  payload: PayloadSessione;
  token: string;
}

export async function creaTokenSessione(
  dati: DatiSessione,
  options: OpzioniTempoSessione = {}
): Promise<RisultatoVerificaERinnovoSessione> {
  const now = risolviNow(options.now);
  const payload = creaPayloadSessione(dati, now);

  return {
    payload,
    token: await firmaTokenSessione(payload, { now }),
  };
}

export async function firmaTokenSessione(
  payload: PayloadSessione,
  options: OpzioniTempoSessione = {}
): Promise<string> {
  const now = risolviNow(options.now);
  const payloadValido = validaPayloadPerFirma(payload, now);

  return firmaTokenSessioneConChiave(
    payloadValido,
    chiaveSessioneSegreta(),
    now
  );
}

export async function verificaTokenSessione(
  token: string,
  options: OpzioniTempoSessione = {}
): Promise<PayloadSessione | null> {
  return verificaTokenSessioneConChiave(
    token,
    chiaveSessioneSegreta(),
    options
  );
}

export async function verificaERinnovaTokenSessione(
  token: string,
  options: OpzioniTempoSessione = {}
): Promise<RisultatoVerificaERinnovoSessione | null> {
  const now = risolviNow(options.now);
  const chiave = chiaveSessioneSegreta();
  const payload = await verificaTokenSessioneConChiave(token, chiave, { now });

  if (!payload) {
    return null;
  }

  const payloadRinnovato = {
    ...payload,
    expiresAt: calcolaScadenzaSessione(now),
  };

  return {
    payload: payloadRinnovato,
    token: await firmaTokenSessioneConChiave(payloadRinnovato, chiave, now),
  };
}

function creaPayloadSessione(
  dati: DatiSessione,
  now: number
): PayloadSessione {
  if (
    !isStringaNonVuota(dati.utenteId) ||
    !isRuolo(dati.ruolo) ||
    !isStringaNonVuota(dati.nome) ||
    !isStringaNonVuota(dati.email)
  ) {
    throw new Error("Payload sessione non valido.");
  }

  return {
    ...dati,
    expiresAt: calcolaScadenzaSessione(now),
  };
}

async function firmaTokenSessioneConChiave(
  payload: PayloadSessione,
  chiave: Uint8Array,
  now: number
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(payload.expiresAt)
    .sign(chiave);
}

async function verificaTokenSessioneConChiave(
  token: string,
  chiave: Uint8Array,
  options: OpzioniTempoSessione
): Promise<PayloadSessione | null> {
  try {
    const { payload } = await jwtVerify(token, chiave, {
      algorithms: ["HS256"],
      ...(options.now !== undefined
        ? { currentDate: new Date(options.now * 1000) }
        : {}),
    });

    return validaPayloadSessioneFirmata(payload);
  } catch {
    return null;
  }
}

function validaPayloadPerFirma(
  payload: PayloadSessione,
  now: number
): PayloadSessione {
  if (
    !isStringaNonVuota(payload.utenteId) ||
    !isRuolo(payload.ruolo) ||
    !isStringaNonVuota(payload.nome) ||
    !isStringaNonVuota(payload.email) ||
    !isTimestampUnix(payload.expiresAt) ||
    payload.expiresAt <= now
  ) {
    throw new Error("Payload sessione non valido.");
  }

  return payload;
}

function validaPayloadSessioneFirmata(
  payload: JWTPayload | Record<string, unknown>
): PayloadSessione | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidato = payload as JWTPayload & Record<string, unknown>;

  if (
    !isStringaNonVuota(candidato.utenteId) ||
    !isRuolo(candidato.ruolo) ||
    !isStringaNonVuota(candidato.nome) ||
    !isStringaNonVuota(candidato.email) ||
    !isTimestampUnix(candidato.expiresAt) ||
    !isTimestampUnix(candidato.iat) ||
    !isTimestampUnix(candidato.exp) ||
    candidato.exp !== candidato.expiresAt ||
    candidato.exp <= candidato.iat
  ) {
    return null;
  }

  return {
    utenteId: candidato.utenteId,
    ruolo: candidato.ruolo,
    nome: candidato.nome,
    email: candidato.email,
    expiresAt: candidato.expiresAt,
  };
}

function risolviNow(now?: number): number {
  return now ?? Math.floor(Date.now() / 1000);
}

function isStringaNonVuota(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRuolo(value: unknown): value is Ruolo {
  return value === "AMMINISTRATORE" || value === "COLLABORATORE";
}

function isTimestampUnix(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
