"use client";

import { useState } from "react";
import { useIdratata } from "@/components/use-idratata";
import type { Giornata, Piano, RigaAnteprima, StatoRiga } from "@/lib/importer-legacy/types";
import { importaAction } from "./actions";
import Submit from "./submit";
import { daImportareSenzaCodice } from "@/lib/importer-legacy/senza-codice";

type Gruppo = StatoRiga | "SENZA_CODICE";
const ETICHETTE: Record<Gruppo, string> = {
  SENZA_CODICE: "Da importare su SENZA CODICE",
  PRONTA: "Pronte da importare", AGGIORNARE: "Da aggiornare", VERIFICARE: "Da verificare", NON_IMPORTABILE: "Scarti",
  PRESENTE: "Già presenti", IGNORATA: "Ignorate", SCOMPARSA: "Scomparse dal foglio",
};
const ORDINE: Gruppo[] = ["PRONTA", "SENZA_CODICE", "AGGIORNARE", "VERIFICARE", "NON_IMPORTABILE", "PRESENTE", "IGNORATA"];
const FIELD = "rounded-md border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

function DatiGiornata({ g, piano }: { g: Giornata; piano: Piano }) {
  return <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
    <dt>Collaboratore</dt><dd>{piano.riferimenti.coach.find((c) => c.id === g.collaboratoreId)?.etichetta || g.collaboratoreId}</dd>
    <dt>Data</dt><dd>{g.data}</dd>
    <dt>Cliente</dt><dd>{piano.riferimenti.clienti.find((c) => c.id === g.clienteId)?.ragioneSociale || g.clienteId}</dd>
    <dt>Offerta</dt><dd>{piano.riferimenti.offerte.find((o) => o.id === g.offertaId)?.codice || "Da definire"}</dd>
    <dt>Ore</dt><dd>{g.ore}</dd><dt>Categoria</dt><dd>{g.categoria}</dd>
    <dt>Rimborso</dt><dd>{g.rimborsoTrasfertaImporto ?? "0.00"} € {g.rimborsoTrasfertaEtichetta}</dd>
    {g.nota && <><dt>Note</dt><dd>{g.nota}</dd></>}
  </dl>;
}

export default function Anteprima({ piano, id, revisione, completata }: { piano: Piano; id: string; revisione: string; completata: boolean }) {
  const idratata = useIdratata();
  const [filtro, setFiltro] = useState<Gruppo>(ORDINE.find((stato) => piano.righe.some((r) => (daImportareSenzaCodice(r) ? "SENZA_CODICE" : r.stato) === stato)) ?? "PRONTA");
  const [pagina, setPagina] = useState(1);
  const [scelte, setScelte] = useState<Record<string, string>>({});
  const [conferma, setConferma] = useState("");
  const [confermaSenzaCodice, setConfermaSenzaCodice] = useState(false);
  const gruppo = (r: RigaAnteprima): Gruppo => daImportareSenzaCodice(r, scelte[r.chiave]) ? "SENZA_CODICE" : r.stato;
  const counts = Object.fromEntries(ORDINE.map((stato) => [stato, piano.righe.filter((r) => gruppo(r) === stato).length]));
  const filtrate = piano.righe.filter((r) => gruppo(r) === filtro);
  const suSenzaCodice = piano.righe.filter((r) => daImportareSenzaCodice(r, scelte[r.chiave]));
  const pagine = Math.max(1, Math.ceil(filtrate.length / 30));
  const aggiuntive = Object.values(scelte).filter((v) => v === "NUOVA" || v === "SENZA_CODICE").length;
  const aggiornamenti = piano.righe.filter((r) => r.stato === "AGGIORNARE").length + Object.values(scelte).filter((v) => v.startsWith("AGGIORNA:")).length;
  const ignorate = Object.values(scelte).filter((v) => v === "IGNORA").length;
  const an = piano.anagrafiche;
  const nuoveGiornate = piano.righe.filter((r) => r.stato === "PRONTA").length + aggiuntive;
  const offerteDaCreare = an.offerte.filter((o) => !o.ripiego || suSenzaCodice.some((r) => r.proposta?.offertaId === o.id));
  const nuoveAnagrafiche = an.clienti.length + an.coach.length + offerteDaCreare.length;
  function scelta(r: RigaAnteprima, value: string) { setScelte((s) => ({ ...s, [r.chiave]: value })); setConfermaSenzaCodice(false); }

  return <div data-idratata={String(idratata)} aria-label="Anteprima importazione" className="space-y-5">
    <p role="status" className="rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-800">{piano.ai}</p>
    {piano.esito && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-900 dark:bg-green-950 dark:text-green-100">
      Salvate: {piano.esito.aggiunte} nuove, {piano.esito.aggiornate} aggiornate. Riconosciute: {piano.esito.riconosciute}. Ignorate per tua scelta: {piano.esito.ignorate}.
    </p>}
    {piano.modalita === "RESET" && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
      Reset completo: saranno cancellati utenti, sessioni, collegamenti ai calendari, tariffe, clienti, offerte, abilitazioni, voci di rimborso, giornate e righe sospese. Verranno ricreate solo le anagrafiche e giornate mostrate. Potresti dover accedere di nuovo; gli utenti non presenti nel foglio non verranno ricreati.
    </div>}
    <form action={importaAction} className="space-y-5">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="revisione" value={revisione} />
      {Object.entries(scelte).filter(([, v]) => v).map(([k, v]) => <input key={k} type="hidden" name={`scelta:${k}`} value={v} />)}
      <details className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <summary className="cursor-pointer font-semibold">Anagrafiche da aggiungere: {an.clienti.length} clienti, {offerteDaCreare.length} offerte, {an.coach.length} collaboratori</summary>
        <p className="my-3 text-sm">{piano.modalita === "RESET" ? "Il reset sostituirà tutte le anagrafiche con quelle mostrate." : "I dati e i ruoli degli utenti esistenti restano invariati. Agli utenti senza profilo collaboratore verrà aggiunto il profilo indicato. Le nuove anagrafiche verranno aggiunte insieme alle giornate approvate."}</p>
        {an.avvisi.map((v, i) => <p key={i} className="my-2 text-sm text-amber-800 dark:text-amber-300">{v}</p>)}
        {an.clienti.map((c) => <details key={c.id} className="my-2 rounded border border-zinc-200 p-3 dark:border-zinc-700">
          <summary>{c.ragioneSociale}{c.verifica ? " — estrazione AI da verificare" : ""}</summary>
          <h3 className="mt-3 text-sm font-semibold">Testo originale</h3><dl className="text-sm">{Object.entries(c.dettagli).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="font-medium">{k}</dt><dd className="whitespace-pre-wrap">{v}</dd></div>)}</dl>
          {c.verifica && <><h3 className="mt-3 text-sm font-semibold">Campi proposti dall’AI</h3><dl className="text-sm">{Object.entries(c.dati).filter(([k]) => k !== "note").map(([k, v]) => <div key={k}><dt className="font-medium">{k}</dt><dd>{v}</dd></div>)}</dl>
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="clienteAI" value={c.id} disabled={completata} />Confermo i dati AI di {c.ragioneSociale}</label><p className="text-xs">Senza conferma viene conservato soltanto il testo originale nelle note.</p></>}
        </details>)}
        {offerteDaCreare.map((o) => <p key={o.id} className="my-2 text-sm">Offerta {o.codice} — {piano.riferimenti.clienti.find((c) => c.id === o.clienteId)?.ragioneSociale} · {o.tariffaGiornaliera} €/giorno · {o.giorniPrevisti} giorni · {o.attiva ? "Aperta" : "Chiusa"} · Trasferte {o.gestioneTrasferta}{o.importoTrasfertaForfettaria ? ` ${o.importoTrasfertaForfettaria} €` : ""}</p>)}
        {an.coach.map((c) => <p key={c.id} className="my-2 text-sm">{c.nome} {c.cognome} — {c.email} · {c.utenteEsistente ? "Profilo da aggiungere all’utente esistente (ruolo invariato)" : c.ruolo} · {c.modalita} {c.importo} € dal {c.dalMese}{c.partitaIva ? ` · P.IVA ${c.partitaIva}` : ""}</p>)}
      </details>
      <nav aria-label="Gruppi delle righe" className="flex flex-wrap gap-2">
        {ORDINE.map((stato) => <button type="button" key={stato} aria-pressed={filtro === stato} onClick={() => { setFiltro(stato); setPagina(1); }} className={`rounded-lg border px-3 py-2 text-sm ${filtro === stato ? "border-indigo-500 bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-100" : "border-zinc-300 dark:border-zinc-700"}`}>{ETICHETTE[stato]} ({counts[stato]})</button>)}
      </nav>
      <section aria-label={ETICHETTE[filtro]} className="space-y-3">
        {!filtrate.length && <p className="py-6 text-sm text-zinc-500">Nessuna riga in questo gruppo.</p>}
        {filtrate.slice((pagina - 1) * 30, pagina * 30).map((r) => <article key={r.chiave} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="font-semibold">{r.numero ? `Riga ${r.numero}` : "Riga precedente"} · {r.grezzi.coach || "Coach non indicato"} · {r.proposta?.data || r.grezzi.data || "Data non indicata"} · {r.grezzi.cliente || "Cliente non indicato"} · {r.proposta?.ore || r.grezzi.ore || "—"} ore</h3>
          <p className="mt-1 text-sm">{r.motivo}</p>
          {r.senzaCodice && r.proposta && <div className="mt-3 space-y-2 rounded-lg border border-amber-300 p-3 text-sm dark:border-amber-700">
            <p><strong>Codice originale:</strong> {r.senzaCodice.codiceOriginale || "Non indicato"}</p>
            <p><strong>Motivo:</strong> {r.senzaCodice.motivo === "MANCANTE" ? "Codice mancante" : r.senzaCodice.motivo === "AMBIGUA" ? "Codice ambiguo" : "Offerta non trovata"}</p>
            <p><strong>Destinazione{gruppo(r) === "VERIFICARE" ? " proposta" : ""}:</strong> SENZA CODICE — {r.grezzi.cliente}. {an.offerte.some((o) => o.id === r.proposta?.offertaId) ? "Offerta da creare alla conferma, tariffa 0 €/giorno." : "Offerta già censita: tariffa invariata."}</p>
            <p className="whitespace-pre-wrap"><strong>Note della giornata dopo l’importazione:</strong>{"\n"}{r.proposta.nota}</p>
          </div>}
          {r.suggerimento && <p className="mt-3 rounded-md bg-indigo-50 p-3 text-sm dark:bg-indigo-950"><strong>Suggerimento AI da verificare:</strong> {r.suggerimento}</p>}
          <details className="mt-3 text-sm"><summary className="cursor-pointer">Dati originali e confronto</summary>
            <dl className="my-3 grid grid-cols-2 gap-1">{Object.entries(r.grezzi).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="font-medium">{k}</dt><dd className="whitespace-pre-wrap">{v}</dd></div>)}</dl>
            {r.proposta && <div className="my-3 rounded border border-indigo-200 p-3"><h4 className="mb-2 font-semibold">Dal foglio</h4><DatiGiornata g={r.proposta} piano={piano} /></div>}
            {r.candidati.map((g, i) => <div key={g.id} className="my-3 rounded border border-zinc-300 p-3 dark:border-zinc-700"><h4 className="mb-2 font-semibold">Nell’app — candidata {i + 1}</h4><DatiGiornata g={g} piano={piano} /></div>)}
          </details>
          {!completata && r.stato === "VERIFICARE" && <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">Decisione per {r.numero ? `riga ${r.numero}` : "riga scomparsa"}
            <select value={scelte[r.chiave] || ""} onChange={(e) => scelta(r, e.target.value)} className={FIELD}>
              <option value="">Lascia da verificare</option>
              {r.proposta && r.senzaCodice?.motivo === "AMBIGUA" && !r.candidati.length ? <option value="SENZA_CODICE">Importa su SENZA CODICE</option> : r.proposta && <option value="NUOVA">Aggiungi come nuova</option>}
              {r.proposta && r.candidati.filter((g) => !piano.righe.some((other) => other.chiave !== r.chiave && other.stato === "PRESENTE" && other.collegataId === g.id)).map((g) => <option key={g.id} value={`AGGIORNA:${g.id}`}>Aggiorna candidata {r.candidati.indexOf(g) + 1} — {g.data}, {g.ore} ore</option>)}
              <option value="IGNORA">Ignora questa riga</option>
            </select>
          </label>}
        </article>)}
        {pagine > 1 && <div className="flex items-center gap-3 text-sm"><button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className={FIELD}>Precedente</button><span>Pagina {pagina} di {pagine}</span><button type="button" disabled={pagina >= pagine} onClick={() => setPagina((p) => p + 1)} className={FIELD}>Successiva</button></div>}
      </section>
      {!completata && <div className="space-y-3 rounded-xl border border-zinc-300 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm">Nuove giornate: {nuoveGiornate}. Da aggiornare: {aggiornamenti}. Scarti: {counts.NON_IMPORTABILE}. Da verificare: {piano.righe.filter((r) => r.stato === "VERIFICARE" && !scelte[r.chiave]).length}. Righe da ignorare: {ignorate}. {nuoveAnagrafiche} nuove anagrafiche.</p>
        {suSenzaCodice.length > 0 && <div className="space-y-2 text-sm">
          <p role="status">{suSenzaCodice.length} giornate verranno associate a SENZA CODICE. Verranno create {offerteDaCreare.filter((o) => o.ripiego).length} offerte di ripiego a tariffa zero. Le offerte già censite mantengono la propria tariffa.</p>
          <label className="flex items-center gap-2"><input type="checkbox" name="confermaSenzaCodice" checked={confermaSenzaCodice} onChange={(e) => setConfermaSenzaCodice(e.target.checked)} required />Confermo le associazioni a SENZA CODICE</label>
        </div>}
        {piano.modalita === "RESET" && <label className="flex flex-wrap items-center gap-2 text-sm">Scrivi AZZERA TUTTO per confermare il reset completo<input name="confermaReset" value={conferma} onChange={(e) => setConferma(e.target.value)} autoComplete="off" className={FIELD} /></label>}
        <Submit attesa="Importazione in corso…" pericolo={piano.modalita === "RESET"} disabilitato={!idratata || (suSenzaCodice.length > 0 && !confermaSenzaCodice) || (piano.modalita === "RESET" && conferma !== "AZZERA TUTTO")}>{piano.modalita === "RESET" ? "Azzera e reimporta i dati approvati" : "Importa e aggiorna"}</Submit>
      </div>}
    </form>
  </div>;
}
