import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cifraToken, decifraToken } from "@/lib/cifratura-token";

describe("cifratura del token del calendario (US-001 AC-4)", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "segreto-di-test-lungo-almeno-trentadue-caratteri");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("cifra senza esporre il token e lo decifra identico", () => {
    const cifrato = cifraToken("1//refresh-token-google");

    expect(cifrato).not.toContain("refresh-token-google");
    expect(cifrato.startsWith("v1.")).toBe(true);
    expect(decifraToken(cifrato)).toBe("1//refresh-token-google");
  });

  it("produce cifrati diversi per lo stesso token (IV casuale)", () => {
    expect(cifraToken("stesso")).not.toBe(cifraToken("stesso"));
  });

  it("rifiuta un valore manomesso o malformato", () => {
    const [versione, iv, tag, testo] = cifraToken("token").split(".");
    const manomesso = [versione, iv, tag, Buffer.from("altro").toString("base64url")].join(".");

    expect(() => decifraToken(manomesso)).toThrow();
    expect(() => decifraToken(`v1.${iv}.${tag}`)).toThrow();
    expect(() => decifraToken("non-cifrato")).toThrow();
    expect(testo).toBeTruthy();
  });

  it("non decifra con una SESSION_SECRET diversa", () => {
    const cifrato = cifraToken("token");
    vi.stubEnv("SESSION_SECRET", "un-altro-segreto-lungo-almeno-trentadue-caratteri");

    expect(() => decifraToken(cifrato)).toThrow();
  });
});
