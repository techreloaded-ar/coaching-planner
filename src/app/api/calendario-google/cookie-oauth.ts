// Cookie temporanei del consenso al calendario Google (state + PKCE), distinti
// da quelli del login e limitati alle rotte del calendario.

export const COOKIE_STATE_CALENDARIO = "calendario_oauth_state";
export const COOKIE_CODE_VERIFIER_CALENDARIO = "calendario_oauth_code_verifier";

export function opzioniCookieOAuthCalendario(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/calendario-google",
    maxAge,
  };
}
