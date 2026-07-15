import { verificaERinnovaTokenSessione } from "@/lib/session-token";

export async function rinnovaToken(token: string): Promise<string | null> {
  const sessione = await verificaERinnovaTokenSessione(token);
  return sessione?.token ?? null;
}
