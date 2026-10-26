import "server-only";
import { cookies } from "next/headers";
import { NOME_COOKIE_TEMA, normalizzaTema, type Tema } from "@/lib/tema";

export async function temaPreferito(): Promise<Tema> {
  const cookieStore = await cookies();
  return normalizzaTema(cookieStore.get(NOME_COOKIE_TEMA)?.value);
}
