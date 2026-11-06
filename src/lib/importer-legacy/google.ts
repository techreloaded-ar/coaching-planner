import { ErroreImporter } from "./errori";
import "server-only";
import { createSign } from "node:crypto";
import { normalizzaIntestazione } from "../../../scripts/importa-storico/foglio";
import type { ConfigImporter } from "./config";
import type { Celle, Schede } from "./types";

export async function leggiGoogle(cfg: ConfigImporter): Promise<Schede> {
  let key: { client_email: string; private_key: string };
  try {
    key = JSON.parse(cfg.credenziali);
    if (typeof key.client_email !== "string" || typeof key.private_key !== "string") throw new ErroreImporter();
  } catch { throw new ErroreImporter("Credenziali del service account non valide: occorrono client_email e private_key."); }
  const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: key.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  let signature: string;
  try { signature = createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url"); }
  catch { throw new ErroreImporter("La chiave privata del service account non è valida."); }
  const auth = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(15_000),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  const token = await auth.json();
  if (!auth.ok || typeof token.access_token !== "string") throw new ErroreImporter("Autenticazione Google fallita. Verifica il service account.");
  // Una sola lettura batch per le quattro schede. Nessuna cache di token globale.
  const query = new URLSearchParams({ valueRenderOption: "UNFORMATTED_VALUE" });
  for (const name of Object.values(cfg.schede)) query.append("ranges", `'${name.replace(/'/g, "''")}'`);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cfg.id}/values:batchGet?${query}`, {
    headers: { authorization: `Bearer ${token.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new ErroreImporter(`Lettura Google fallita (${response.status}). Verifica condivisione in lettura e Google Sheets API.`);
  const body = await response.json();
  if (!Array.isArray(body.valueRanges) || body.valueRanges.length !== 4) throw new ErroreImporter("Il documento non contiene tutte le schede richieste.");
  const result = {} as Schede;
  Object.keys(cfg.schede).forEach((name, i) => {
    const values: unknown[][] = body.valueRanges[i].values ?? [];
    const headers = (values[0] || []).map((v) => normalizzaIntestazione(String(v ?? "")));
    if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) throw new ErroreImporter(`Intestazioni duplicate nella scheda ${name}.`);
    result[name as keyof Schede] = values.slice(1).map((row): Celle => Object.fromEntries(headers.filter(Boolean).map((h) => [h, String(row[headers.indexOf(h)] ?? "").trim()])));
    const required = name === "clienti" ? ["cliente"] : name === "offerte" ? ["data", "cliente", "offerta"] : name === "coach" ? ["id", "nome", "cognome", "email"] : ["coach", "data", "cliente", "codice offerta", "ore", "tipologia fatturazione"];
    if (required.some((h) => !headers.includes(h))) throw new ErroreImporter(`Colonne mancanti nella scheda ${name}: ${required.filter((h) => !headers.includes(h)).join(", ")}.`);
  });
  if (result.giornate.length > 30_000) throw new ErroreImporter("Il documento supera il limite di 30.000 giornate per analisi. Riduci il periodo nel documento di importazione.");
  return result;
}
