import { etichettaStatoCliente, type StatoCliente } from "@/domain/anagrafiche/stato-cliente";

const DESCRIZIONI: Record<StatoCliente["tipo"], string> = {
  ATTIVO: "Cliente attivo: offerte attive",
  NUOVO: "Cliente nuovo: nessuna offerta collegata",
  NON_ATTIVO: "Cliente non attivo: offerte tutte chiuse",
};

/** Chip dello stato derivato del cliente: «3 attive», «Nuovo», «5 chiuse». */
export function ChipStatoCliente({ stato }: { stato: StatoCliente }) {
  const classi =
    stato.tipo === "ATTIVO"
      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
      : stato.tipo === "NUOVO"
        ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
        : "border border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400";

  return (
    <span
      title={DESCRIZIONI[stato.tipo]}
      className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-[9px] py-[3px] text-[11.5px] font-semibold ${classi}`}
    >
      {stato.tipo === "ATTIVO" && <span className="h-[6px] w-[6px] rounded-full bg-current" aria-hidden="true" />}
      {stato.tipo === "NON_ATTIVO" && (
        <span className="h-[6px] w-[6px] rounded-full border-[1.5px] border-current" aria-hidden="true" />
      )}
      {etichettaStatoCliente(stato)}
    </span>
  );
}
