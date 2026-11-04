import { afterEach, describe, expect, it, vi } from "vitest";
import { ambientePreproduzione } from "@/lib/ambiente";

afterEach(() => vi.unstubAllEnvs());

describe("riconoscimento della preproduzione", () => {
  it.each([
    ["preview", "pre-prod", true],
    ["production", "prod", false],
    ["production", "pre-prod", false],
    ["preview", "main", false],
    ["preview", "feature/novita", false],
    ["development", "pre-prod", false],
    [undefined, undefined, false],
  ])("ambiente %s, branch %s: banner %s", (ambiente, branch, atteso) => {
    vi.stubEnv("VERCEL_ENV", ambiente);
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", branch);
    expect(ambientePreproduzione()).toBe(atteso);
  });
});
