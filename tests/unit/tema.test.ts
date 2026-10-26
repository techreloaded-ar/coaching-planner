import { describe, expect, it } from "vitest";
import { normalizzaTema, TEMA_PREDEFINITO } from "@/lib/tema";

describe("normalizzaTema", () => {
  it.each(["chiaro", "scuro", "browser"] as const)("accetta %s", (tema) => {
    expect(normalizzaTema(tema)).toBe(tema);
  });

  it.each([undefined, "", "dark", "SCURO", "scuro;path=/"])(
    "riporta %s al tema predefinito Browser",
    (valore) => {
      expect(normalizzaTema(valore)).toBe(TEMA_PREDEFINITO);
      expect(TEMA_PREDEFINITO).toBe("browser");
    },
  );
});
