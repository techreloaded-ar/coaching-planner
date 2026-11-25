"use client";

import {
  BloccoScheletro,
  GrigliaCalendarioScheletro,
  ScheletroPagina,
  TabellaScheletro,
  TitoloScheletro,
} from "@/components";
import { varianteScheletro, type VarianteScheletro } from "./variante-scheletro";

/**
 * Scheletro della pagina di destinazione di una voce del menu, mostrato al
 * clic finché la pagina non arriva dal server.
 *
 * Sceglie l'impaginazione dall'indirizzo di arrivo e porta il contenitore
 * della sua area: menu laterale e intestazione restano al loro posto.
 */
export default function ScheletroDelPercorso({
  percorso,
  vista,
}: {
  /** Pathname della pagina di arrivo. */
  percorso: string;
  /** Parametro `?vista=` del registro attività, se presente. */
  vista: string | null;
}) {
  const variante = varianteScheletro(percorso, vista);
  const areaAttivita = percorso === "/attivita" || percorso.startsWith("/attivita/");

  return (
    <div className={areaAttivita ? "flex-1" : CONTENITORE_BACK_OFFICE}>
      <ScheletroPagina variante={variante} className={CONTENITORE[variante]}>
        <ContenutoScheletro variante={variante} />
      </ScheletroPagina>
    </div>
  );
}

/** Stesso contenitore del `<main>` del layout del back office. */
const CONTENITORE_BACK_OFFICE =
  "min-w-0 flex-1 bg-zinc-50 px-9 py-[30px] max-sm:px-4 max-sm:py-5 dark:bg-zinc-950";

// Il <main> del back office ha già il proprio padding; nell'area attività ogni
// pagina porta il suo contenitore, riprodotto qui per non far saltare il contenuto.
const CONTENITORE: Record<VarianteScheletro, string> = {
  calendario: "mx-auto w-full max-w-[1080px] px-8 py-7 max-sm:px-4 max-sm:py-5",
  "elenco-attivita": "mx-auto w-full max-w-[1080px] px-8 py-7 max-md:px-4 max-md:py-5",
  riepilogo: "mx-auto w-full max-w-[1080px] px-8 py-7 max-md:px-4 max-md:py-5",
  giornata: "mx-auto w-full max-w-[1280px] px-4 pt-4 pb-12 md:px-8 md:pt-6",
  elenco: "",
  report: "",
  importazione: "mx-auto max-w-6xl",
  dettaglio: "",
};

const CLASSE_CARD =
  "rounded-[11px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

function ContenutoScheletro({ variante }: { variante: VarianteScheletro }) {
  switch (variante) {
    case "calendario":
      return (
        <>
          <BarraMeseScheletro />
          <GrigliaCalendarioScheletro />
        </>
      );
    case "elenco-attivita":
      return (
        <>
          <BarraMeseScheletro />
          <div className="mb-3 flex flex-wrap items-end gap-2.5">
            <CampoScheletro className="w-[220px] max-sm:w-full" />
            <CampoScheletro className="w-[260px] max-sm:w-full" />
            <CampoScheletro className="min-w-[180px] flex-1" />
          </div>
          <TabellaScheletro righe={8} colonne={5} conBarraStrumenti={false} />
        </>
      );
    case "riepilogo":
      return <RiepilogoScheletro />;
    case "giornata":
      return <GiornataScheletro />;
    case "elenco":
      return (
        <>
          <TitoloScheletro conAzione />
          <TabellaScheletro righe={10} />
        </>
      );
    case "report":
      return (
        <>
          <TitoloScheletro />
          <ControlliMeseScheletro />
          <TabellaScheletro righe={8} colonne={5} conBarraStrumenti={false} />
        </>
      );
    case "importazione":
      return (
        <>
          <TitoloScheletro conOcchiello={false} conDescrizione={false} />
          <div className={`flex flex-wrap items-center justify-between gap-3 p-3 ${CLASSE_CARD}`}>
            <div className="space-y-2">
              <BloccoScheletro className="h-3.5 w-32" />
              <BloccoScheletro className="h-3.5 w-56" />
            </div>
            <BloccoScheletro className="h-[38px] w-36 rounded-[10px]" />
          </div>
        </>
      );
    case "dettaglio":
      return (
        <>
          <TitoloScheletro />
          <ModuloScheletro />
        </>
      );
  }
}

/** Barra del mese dell'area attività: frecce, mese, «Mese corrente», vista e totali. */
function BarraMeseScheletro() {
  return (
    <div className="mb-[18px] flex flex-wrap items-center gap-3 max-sm:gap-2.5">
      <BloccoScheletro className="h-9 w-9 rounded-[10px] max-sm:h-11 max-sm:w-11" />
      <BloccoScheletro className="h-7 w-40" />
      <BloccoScheletro className="h-9 w-9 rounded-[10px] max-sm:h-11 max-sm:w-11" />
      <BloccoScheletro className="ml-1 h-9 w-32 rounded-[10px] max-sm:hidden" />
      <div className="flex-1 max-sm:hidden" />
      <BloccoScheletro className="h-[38px] w-[150px] rounded-[10px] max-sm:ml-auto" />
      <BloccoScheletro className="h-8 w-40 rounded-full max-sm:hidden" />
    </div>
  );
}

/** Selettore del mese dei report: frecce, mese e «Mese corrente». */
function ControlliMeseScheletro() {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2.5">
      <BloccoScheletro className="h-9 w-9 rounded-[10px]" />
      <BloccoScheletro className="h-7 w-40" />
      <BloccoScheletro className="h-9 w-9 rounded-[10px]" />
      <BloccoScheletro className="h-9 w-32 rounded-[10px]" />
    </div>
  );
}

/** Etichetta e campo di un modulo. */
function CampoScheletro({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <BloccoScheletro className="h-3 w-16" />
      <BloccoScheletro className="h-[38px] w-full rounded-[10px]" />
    </div>
  );
}

/** Card con un modulo a due colonne: schede di dettaglio e pagine di modifica. */
function ModuloScheletro() {
  return (
    <div className={`max-w-[840px] p-6 ${CLASSE_CARD}`}>
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, campo) => (
          <CampoScheletro key={campo} />
        ))}
      </div>
      <BloccoScheletro className="mt-6 h-[38px] w-32 rounded-[10px]" />
    </div>
  );
}

/** Dettaglio giornata: ritorno e cambio giorno, titolo, modulo di inserimento e righe. */
function GiornataScheletro() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <BloccoScheletro className="h-5 w-40" />
        <div className="flex items-center gap-2 max-sm:w-full">
          <BloccoScheletro className="h-10 w-10 rounded-lg sm:h-9 sm:w-9" />
          <BloccoScheletro className="h-10 w-40 rounded-lg max-sm:flex-1 sm:h-9" />
          <BloccoScheletro className="h-10 w-10 rounded-lg sm:h-9 sm:w-9" />
        </div>
      </div>
      <div className="mt-6">
        <BloccoScheletro className="h-8 w-72 max-w-full" />
        <BloccoScheletro className="mt-2 h-4 w-48" />
      </div>
      <div className={`mt-6 p-5 ${CLASSE_CARD}`}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, campo) => (
            <CampoScheletro key={campo} />
          ))}
        </div>
        <BloccoScheletro className="mt-5 h-[38px] w-36 rounded-[10px]" />
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }, (_, riga) => (
          <div key={riga} className={`flex items-center gap-4 px-4 py-4 ${CLASSE_CARD}`}>
            <BloccoScheletro className="h-4 w-1/3" />
            <BloccoScheletro className="h-4 w-16" />
            <BloccoScheletro className="ml-auto h-8 w-20 rounded-[9px]" />
          </div>
        ))}
      </div>
    </>
  );
}

/** Riepilogo mensile: ritorno, barra del mese, titolo e card dei totali. */
function RiepilogoScheletro() {
  return (
    <>
      <BloccoScheletro className="mb-5 h-4 w-44" />
      <div className="mb-[18px] flex flex-wrap items-center gap-3">
        <BloccoScheletro className="h-9 w-9 rounded-[10px]" />
        <BloccoScheletro className="h-7 w-40" />
        <BloccoScheletro className="h-9 w-9 rounded-[10px]" />
        <div className="flex-1" />
        <BloccoScheletro className="h-8 w-44 rounded-full" />
      </div>
      <BloccoScheletro className="h-4 w-36" />
      <BloccoScheletro className="mt-2.5 h-8 w-56" />
      <div className="mt-[18px] grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, card) => (
          <div key={card} className={`p-[16px_18px] ${CLASSE_CARD}`}>
            <BloccoScheletro className="h-3 w-24" />
            <BloccoScheletro className="mt-3 h-8 w-20" />
          </div>
        ))}
        <div className={`h-[112px] p-[18px_20px] md:col-span-2 xl:col-span-4 ${CLASSE_CARD}`}>
          <BloccoScheletro className="h-3 w-28" />
          <BloccoScheletro className="mt-3 h-10 w-40" />
        </div>
      </div>
    </>
  );
}
