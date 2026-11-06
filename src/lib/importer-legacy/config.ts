import { ErroreImporter } from "./errori";
import "server-only";
import { normalizzaTesto } from "@/domain/righe-sospese/abbinamento";

export function configurazioneImporter(env: Record<string, string | undefined> = process.env) {
  const abilitato = env.IMPORTER_ENABLED === "true";
  const id = (env.IMPORTER_GOOGLE_SPREADSHEET_ID ?? "").trim();
  const documentoValido = /^[A-Za-z0-9_-]+$/.test(id);
  const dalMese = env.IMPORTER_PRIMO_MESE_TARIFFA?.trim() || "2018-01";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(dalMese)) throw new ErroreImporter("IMPORTER_PRIMO_MESE_TARIFFA non valido.");
  return {
    abilitato, id, dalMese,
    configurato: documentoValido && Boolean(env.IMPORTER_GOOGLE_SERVICE_ACCOUNT_JSON?.trim()),
    credenziali: env.IMPORTER_GOOGLE_SERVICE_ACCOUNT_JSON || "",
    schede: {
      clienti: env.IMPORTER_SCHEDA_CLIENTI || "CLIENTI",
      offerte: env.IMPORTER_SCHEDA_OFFERTE || "OFFERTE",
      coach: env.IMPORTER_SCHEDA_COACH || "COACH",
      giornate: env.IMPORTER_SCHEDA_GIORNATE || "GIORNATE",
    },
    clienteInterno: normalizzaTesto(env.IMPORTER_CLIENTE_INTERNO || "AGILERELOADED"),
    esclusi: (env.IMPORTER_CLIENTI_ESCLUSI ?? "ND").split(",").map(normalizzaTesto).filter(Boolean),
    amministratori: (env.IMPORTER_EMAIL_AMMINISTRATORI || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
  };
}
export type ConfigImporter = ReturnType<typeof configurazioneImporter>;

export function richiediImporter() {
  const cfg = configurazioneImporter();
  if (!cfg.abilitato) throw new ErroreImporter("Importazione disabilitata in questo ambiente.");
  if (!cfg.configurato) throw new ErroreImporter("Configura documento Google e service account sul server.");
  return cfg;
}

// Solo informazioni pubblicabili nella pagina: mai chiavi o endpoint AI.
export function statoConfigurazione() {
  const cfg = configurazioneImporter();
  return {
    abilitato: cfg.abilitato, configurato: cfg.configurato,
    documento: /^[A-Za-z0-9_-]+$/.test(cfg.id) ? `https://docs.google.com/spreadsheets/d/${cfg.id}/edit` : null,
    ambiente: process.env.VERCEL_ENV === "production" ? "Produzione" : process.env.VERCEL_ENV === "preview" ? "Preproduzione" : "Locale",
  };
}
