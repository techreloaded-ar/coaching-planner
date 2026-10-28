import {
  DESCRIZIONE_CATEGORIA_ATTIVITA,
  type CategoriaAttivita,
} from "@/domain/types";

const STILE_CATEGORIA: Record<CategoriaAttivita, string> = {
  FATTURABILE:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  NON_FATTURABILE:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  INVESTIMENTO:
    "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
};

/** Etichetta colorata della categoria di un'attività, con il significato come title. */
export function BadgeCategoriaAttivita({
  categoria,
}: {
  categoria: CategoriaAttivita;
}) {
  const { etichetta, significato } = DESCRIZIONE_CATEGORIA_ATTIVITA[categoria];
  return (
    <span
      title={significato}
      className={`inline-flex items-center whitespace-nowrap rounded-full px-[9px] py-[3px] text-[11px] font-bold ${STILE_CATEGORIA[categoria]}`}
    >
      {etichetta}
    </span>
  );
}
