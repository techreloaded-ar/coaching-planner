import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { leggiGoogle } from "@/lib/importer-legacy/google";
import { configurazioneImporter } from "@/lib/importer-legacy/config";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const cfg = configurazioneImporter({ IMPORTER_GOOGLE_SPREADSHEET_ID: "test-id",
  IMPORTER_GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: "test@project.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) }) });
const ranges = [
  { values: [["Cliente"], ["Esempio"]] }, { values: [["Data", "Cliente", "Offerta"]] },
  { values: [["ID", "Nome", "Cognome", "Email"]] },
  { values: [["Coach", "Data", "Cliente", "Codice Offerta", "Ore", "Tipologia Fatturazione"], ["c1", 46331, "Esempio", "cod", 8, "FATTURABILE"]] },
];
afterEach(() => vi.unstubAllGlobals());
describe("lettura Google con service account", () => {
  it("usa scope readonly e host Google fissi, poi legge tutte le schede in un batch", async () => {
    const mock = vi.fn().mockResolvedValueOnce(Response.json({ access_token: "token" })).mockResolvedValueOnce(Response.json({ valueRanges: ranges }));
    vi.stubGlobal("fetch", mock);
    const result = await leggiGoogle(cfg);
    const auth = mock.mock.calls[0];
    expect(auth[0]).toBe("https://oauth2.googleapis.com/token");
    const jwt = (auth[1].body as URLSearchParams).get("assertion")!;
    const claims = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
    expect(claims.scope).toBe("https://www.googleapis.com/auth/spreadsheets.readonly");
    const api = new URL(mock.mock.calls[1][0]);
    expect(api.searchParams.getAll("ranges")).toHaveLength(4);
    expect(result.giornate[0].ore).toBe("8"); expect(result.clienti[0].cliente).toBe("Esempio");
  });
  it("rifiuta le credenziali malformate senza tentare la rete", async () => {
    const mock = vi.fn(); vi.stubGlobal("fetch", mock);
    await expect(leggiGoogle({ ...cfg, credenziali: "bad" })).rejects.toThrow("non valide");
    expect(mock).not.toHaveBeenCalled();
  });
  it("non riutilizza un token tra account diversi", async () => {
    const mock = vi.fn().mockResolvedValueOnce(Response.json({ access_token: "one" })).mockResolvedValueOnce(Response.json({ valueRanges: ranges }))
      .mockResolvedValueOnce(Response.json({ access_token: "two" })).mockResolvedValueOnce(Response.json({ valueRanges: ranges }));
    vi.stubGlobal("fetch", mock);
    await leggiGoogle(cfg); await leggiGoogle({ ...cfg, id: "altro-foglio" });
    expect(mock.mock.calls[1][1].headers.authorization).toBe("Bearer one"); expect(mock.mock.calls[3][1].headers.authorization).toBe("Bearer two");
  });
  it("espone errori utili senza riportare il corpo sensibile di Google", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ access_token: "token" })).mockResolvedValueOnce(new Response("dati sensibili", { status: 403 })));
    await expect(leggiGoogle(cfg)).rejects.toThrow("condivisione in lettura");
  });
});
