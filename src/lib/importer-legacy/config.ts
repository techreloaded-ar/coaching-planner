import { ErroreImporter } from "./errori";
import "server-only";

export function configurazioneImporter(env: Record<string, string | undefined> = process.env) {
  const id = (env.IMPORTER_GOOGLE_SPREADSHEET_ID ?? "").trim();
  const documentoValido = /^[A-Za-z0-9_-]+$/.test(id);
  return {
    id, dalMese: "2018-01",
    configurato: documentoValido && Boolean(env.IMPORTER_GOOGLE_SERVICE_ACCOUNT_JSON?.trim()),
    credenziali: env.IMPORTER_GOOGLE_SERVICE_ACCOUNT_JSON || "",
    schede: {
      clienti: "CLIENTI",
      offerte: "OFFERTE",
      coach: "COACH",
      giornate: "GIORNATE",
    },
    clienteInterno: "AGILERELOADED",
    esclusi: ["ND"],
    amministratori: (env.IMPORTER_EMAIL_AMMINISTRATORI || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
  };
}
export type ConfigImporter = ReturnType<typeof configurazioneImporter>;

export function richiediImporter() {
  const cfg = configurazioneImporter();
  if (!cfg.configurato) throw new ErroreImporter("Configura documento Google e service account sul server.");
  return cfg;
}

// Solo informazioni pubblicabili nella pagina: mai chiavi o endpoint AI.
export function statoConfigurazione() {
  const cfg = configurazioneImporter();
  return {
    configurato: cfg.configurato,
    documento: /^[A-Za-z0-9_-]+$/.test(cfg.id) ? `https://docs.google.com/spreadsheets/d/${cfg.id}/edit` : null,
    ambiente: process.env.VERCEL_ENV === "production" ? "Produzione" : process.env.VERCEL_ENV === "preview" ? "Preproduzione" : "Locale",
  };
}
