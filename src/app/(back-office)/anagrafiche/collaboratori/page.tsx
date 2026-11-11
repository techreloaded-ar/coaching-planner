import { redirect } from "next/navigation";
import { richiediPermesso } from "@/lib/dal";

export default async function ElencoPrecedente({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await richiediPermesso("GESTIRE_COLLABORATORI");
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") query.set(key, value);
  }
  query.set("ruolo", "COLLABORATORE");
  redirect(`/anagrafiche/persone${query.size ? `?${query}` : ""}`);
}
