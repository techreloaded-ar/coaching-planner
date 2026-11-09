"use client";

import { useState } from "react";
import { useIdratata } from "@/components/use-idratata";
import type { Giornata, Piano, RigaAnteprima, StatoRiga } from "@/lib/importer-legacy/types";
import { importaAction } from "./actions";
import Submit from "./submit";
import { daImportareSenzaCodice } from "@/lib/importer-legacy/senza-codice";

type Gruppo = StatoRiga | "SENZA_CODICE";
const ETICHETTE: Record<Gruppo, string> = {
  SENZA_CODICE: "Su SENZA CODICE",
  PRONTA: "Nuove", AGGIORNARE: "Da aggiornare", VERIFICARE: "Da verificare", NON_IMPORTABILE: "Scarti",
  PRESENTE: "Già presenti", IGNORATA: "Ignorate", SCOMPARSA: "Non più presenti nel foglio",
};
const ORDINE: Gruppo[] = ["SCOMPARSA", "VERIFICARE", "SENZA_CODICE", "AGGIORNARE", "PRONTA", "NON_IMPORTABILE", "PRESENTE", "IGNORATA"];
const FIELD = "rounded-md border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

function Cambiamenti({ prima, dopo, piano }: { prima: Giornata; dopo: Giornata; piano: Piano }) {
  const campi: [keyof Giornata, string][] = [
    ["collaboratoreId", "Coach"], ["data", "Data"], ["clienteId", "Cliente"], ["offertaId", "Offerta"],
    ["ore", "Ore"], ["categoria", "Categoria"], ["inAffiancamento", "Affiancamento PAIR"], ["rimborsoTrasfertaImporto", "Rimborso"],
    ["rimborsoTrasfertaEtichetta", "Tipo rimborso"], ["nota", "Note"],
  ];
  const modificati = campi.filter(([campo]) => prima[campo] !== dopo[campo]);
  function valore(g: Giornata, campo: keyof Giornata): string {
    if (campo === "clienteId") return piano.riferimenti.clienti.find((c) => c.id === g.clienteId)?.ragioneSociale || g.clienteId;
    if (campo === "offertaId") return piano.riferimenti.offerte.find((o) => o.id === g.offertaId)?.codice || "Da definire";
    if (campo === "collaboratoreId") return piano.riferimenti.coach.find((c) => c.id === g.collaboratoreId)?.etichetta || g.collaboratoreId;
    if (campo === "rimborsoTrasfertaImporto") return `${g[campo] ?? "0.00"} €`;
    if (campo === "inAffiancamento") return g.inAffiancamento ? "Sì: metà giornata al cliente" : "No";
    return String(g[campo] || "—");
  }
  return <table aria-label="Campi modificati" className="mt-4 w-full table-fixed border-collapse text-left text-sm">
    <caption className="mb-2 text-left font-semibold">Campi modificati</caption>
    <thead className="text-xs text-zinc-500"><tr><th scope="col" className="w-1/4 py-2 pr-2">Campo</th><th scope="col" className="px-2 py-2">Nell’app</th><th scope="col" className="py-2 pl-2">Dal foglio</th></tr></thead>
    <tbody>{modificati.map(([campo, etichetta]) => <tr key={campo} className="border-t border-zinc-200 align-top dark:border-zinc-700">
      <th scope="row" className="py-2 pr-2 font-medium">{etichetta}</th>
      <td className="whitespace-pre-wrap break-words px-2 py-2 text-zinc-500">{valore(prima, campo)}</td>
      <td className="whitespace-pre-wrap break-words py-2 pl-2 font-medium">{valore(dopo, campo)}</td>
    </tr>)}</tbody>
  </table>;
}

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
  const [filtro, setFiltro] = useState<Gruppo>(ORDINE.filter((stato) => stato !== "PRESENTE" && stato !== "IGNORATA").find((stato) => piano.righe.some((r) => (daImportareSenzaCodice(r) ? "SENZA_CODICE" : r.stato) === stato)) ?? "PRONTA");
  const [pagina, setPagina] = useState(1);
  const [pagineSecondarie, setPagineSecondarie] = useState({ PRESENTE: 1, IGNORATA: 1 });
  const [scelte, setScelte] = useState<Record<string, string>>(() => Object.fromEntries(
    piano.righe.filter((r) => r.stato === "SCOMPARSA").map((r) => [r.chiave, "ELIMINA"]),
  ));
  const [conferma, setConferma] = useState("");
  const [confermaSenzaCodice, setConfermaSenzaCodice] = useState(false);
  const gruppo = (r: RigaAnteprima): Gruppo => daImportareSenzaCodice(r, scelte[r.chiave]) ? "SENZA_CODICE" : r.stato;
  const counts = Object.fromEntries(ORDINE.map((stato) => [stato, piano.righe.filter((r) => gruppo(r) === stato).length]));
  const gruppiVisibili = ORDINE.filter((stato) => stato !== "PRESENTE" && stato !== "IGNORATA" && counts[stato] > 0);
  const filtroAttivo = gruppiVisibili.includes(filtro) ? filtro : gruppiVisibili[0] ?? "PRONTA";
  const filtrate = piano.righe.filter((r) => gruppo(r) === filtroAttivo);
  const suSenzaCodice = piano.righe.filter((r) => daImportareSenzaCodice(r, scelte[r.chiave]));
  const pagine = Math.max(1, Math.ceil(filtrate.length / 30));
  const aggiuntive = Object.values(scelte).filter((v) => v === "NUOVA" || v === "SENZA_CODICE").length;
  const aggiornamenti = piano.righe.filter((r) => r.stato === "AGGIORNARE").length + Object.values(scelte).filter((v) => v.startsWith("AGGIORNA:")).length;
  const ignorate = Object.values(scelte).filter((v) => v === "IGNORA").length;
  const an = piano.anagrafiche;
  const nuoveGiornate = piano.righe.filter((r) => r.stato === "PRONTA").length + aggiuntive;
  const offerteDaCreare = an.offerte.filter((o) => !o.ripiego || suSenzaCodice.some((r) => r.proposta?.offertaId === o.id));
  const nuoveAnagrafiche = an.clienti.length + an.coach.length + offerteDaCreare.length;
  const daVerificare = piano.righe.filter((r) => r.stato === "VERIFICARE" && !scelte[r.chiave]).length;
  const eliminazioni = Object.values(scelte).filter((v) => v === "ELIMINA").length;
  const daControllare = daVerificare + counts.NON_IMPORTABILE + suSenzaCodice.length + counts.SCOMPARSA;
  function scelta(r: RigaAnteprima, value: string) { setScelte((s) => ({ ...s, [r.chiave]: value })); setConfermaSenzaCodice(false); setPagina(1); }
  const haOperazioni = nuoveGiornate + aggiornamenti + nuoveAnagrafiche + ignorate + eliminazioni > 0 || piano.modalita === "RESET";
  const allineato = !haOperazioni && daVerificare === 0 && counts.NON_IMPORTABILE === 0 && counts.SCOMPARSA === 0 && counts.PRESENTE > 0;
  const importazioneDisabilitata = !idratata || (suSenzaCodice.length > 0 && !confermaSenzaCodice) || (piano.modalita === "RESET" && conferma !== "AZZERA TUTTO");
  const conferme = <>
    {suSenzaCodice.length > 0 && <div className="space-y-1 text-sm">
      <p className="hidden text-xs sm:block">Giornate su SENZA CODICE: {suSenzaCodice.length}. Nuove offerte a tariffa zero: {offerteDaCreare.filter((o) => o.ripiego).length}. Le offerte già censite mantengono la propria tariffa.</p>
      <label className="flex items-center gap-2"><input type="checkbox" checked={confermaSenzaCodice} onChange={(e) => setConfermaSenzaCodice(e.target.checked)} required />Confermo le associazioni a SENZA CODICE</label>
    </div>}
    {piano.modalita === "RESET" && <label className="flex flex-wrap items-center gap-2 text-sm">Scrivi AZZERA TUTTO per confermare il reset completo<input value={conferma} onChange={(e) => setConferma(e.target.value)} autoComplete="off" className={FIELD} /></label>}
  </>;

  const mostraRiga = (r: RigaAnteprima) => {
    const dati = r.proposta ?? (r.stato === "SCOMPARSA" ? r.candidati[0] : null);
    return <article key={r.chiave} className="min-w-0 break-words rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-semibold">{r.grezzi.coach || "Coach non indicato"} · {r.grezzi.cliente || "Cliente non indicato"}</h3>
            <span className="text-xs text-zinc-500">{r.numero ? `Riga ${r.numero} del foglio` : "Riga precedente"}</span>
          </div>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-zinc-500">Data</dt><dd>{dati?.data || r.grezzi.data || "Non indicata"}</dd></div>
            <div><dt className="text-xs text-zinc-500">Ore</dt><dd>{dati?.ore || r.grezzi.ore || "—"}</dd></div>
            <div><dt className="text-xs text-zinc-500">Offerta</dt><dd className="break-words">{dati ? piano.riferimenti.offerte.find((o) => o.id === dati.offertaId)?.codice || "Da definire" : r.grezzi["codice offerta"] || "Non indicata"}</dd></div>
          </dl>
          {r.stato !== "AGGIORNARE" && r.stato !== "PRESENTE" && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{r.motivo}</p>}
          {(r.stato === "AGGIORNARE" || scelte[r.chiave]?.startsWith("AGGIORNA:")) && r.proposta && r.candidati[0] && <Cambiamenti prima={r.candidati.find((g) => scelte[r.chiave] === `AGGIORNA:${g.id}`) ?? r.candidati[0]} dopo={r.proposta} piano={piano} />}
          {r.senzaCodice && r.proposta && <div className="mt-3 space-y-2 rounded-lg border border-amber-300 p-3 text-sm dark:border-amber-700">
            <p><strong>Codice originale:</strong> {r.senzaCodice.codiceOriginale || "Non indicato"}</p>
            <p><strong>Motivo:</strong> {r.senzaCodice.motivo === "MANCANTE" ? "Codice mancante" : r.senzaCodice.motivo === "AMBIGUA" ? "Codice ambiguo" : "Offerta non trovata"}</p>
            <p>{an.offerte.some((o) => o.id === r.proposta?.offertaId) ? "Offerta da creare alla conferma, tariffa 0 €/giorno." : "Offerta già censita: tariffa invariata."}</p>
            <p className="whitespace-pre-wrap"><strong>Note della giornata dopo l’importazione:</strong>{"\n"}{r.proposta.nota}</p>
          </div>}
          {r.suggerimento && <p className="mt-3 rounded-md bg-indigo-50 p-3 text-sm dark:bg-indigo-950"><strong>Suggerimento AI da verificare:</strong> {r.suggerimento}</p>}
          <details className="mt-3 text-sm"><summary className="cursor-pointer">Dati originali e confronto</summary>
            <dl className="my-3 grid grid-cols-2 gap-1">{Object.entries(r.grezzi).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="font-medium">{k}</dt><dd className="whitespace-pre-wrap">{v}</dd></div>)}</dl>
            {r.proposta && <div className="my-3 rounded border border-indigo-200 p-3"><h4 className="mb-2 font-semibold">Dal foglio</h4><DatiGiornata g={r.proposta} piano={piano} /></div>}
            {r.candidati.map((g, i) => <div key={g.id} className="my-3 rounded border border-zinc-300 p-3 dark:border-zinc-700"><h4 className="mb-2 font-semibold">Nell’app — candidata {i + 1}</h4><DatiGiornata g={g} piano={piano} /></div>)}
          </details>
          {!completata && r.stato === "SCOMPARSA" && <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">Decisione per giornata non più presente
            <select value={scelte[r.chiave] || ""} onChange={(e) => scelta(r, e.target.value)} className={FIELD}>
              <option value="">Mantieni nell’app</option><option value="ELIMINA">Elimina dall’app</option>
            </select>
          </label>}
          {scelte[r.chiave] === "ELIMINA" && <p className="mt-2 text-sm font-medium text-red-700 dark:text-red-300">Questa giornata verrà eliminata dall’app alla conferma dell’importazione.</p>}
          {!completata && r.stato === "VERIFICARE" && <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">Decisione per {r.numero ? `riga ${r.numero}` : "riga scomparsa"}
            <select value={scelte[r.chiave] || ""} onChange={(e) => scelta(r, e.target.value)} className={FIELD}>
              <option value="">Lascia da verificare</option>
              {r.proposta && r.senzaCodice?.motivo === "AMBIGUA" && !r.candidati.length ? <option value="SENZA_CODICE">Importa su SENZA CODICE</option> : r.proposta && <option value="NUOVA">Aggiungi come nuova</option>}
              {r.proposta && r.candidati.filter((g) => !piano.righe.some((other) => other.chiave !== r.chiave && other.stato === "PRESENTE" && other.collegataId === g.id)).map((g) => <option key={g.id} value={`AGGIORNA:${g.id}`}>Aggiorna candidata {r.candidati.indexOf(g) + 1} — {g.data}, {g.ore} ore</option>)}
              <option value="IGNORA">Ignora questa riga</option>
            </select>
          </label>}
        </article>;
  };

  return <div data-idratata={String(idratata)} aria-label="Anteprima importazione" className="flex min-h-0 flex-1 flex-col gap-3">
    <section aria-label="Riepilogo analisi" className="flex shrink-0 flex-wrap gap-x-6 gap-y-2 border-b border-zinc-200 pb-3 text-sm dark:border-zinc-800">
      {[{ nome: "Nuove giornate", valore: nuoveGiornate }, { nome: "Aggiornamenti", valore: aggiornamenti }, { nome: "Da controllare", valore: daControllare }].map(({ nome, valore }) =>
        <div key={nome} className="flex items-baseline gap-2">
          <p className="text-zinc-500 dark:text-zinc-400">{nome}</p><p className="font-semibold tabular-nums">{valore}</p>
        </div>)}
    </section>
    {piano.modalita === "RESET" && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
      Reset completo: saranno cancellati utenti, sessioni, collegamenti ai calendari, tariffe, clienti, offerte, abilitazioni, voci di rimborso, giornate e righe sospese. Verranno ricreate solo le anagrafiche e giornate mostrate. Potresti dover accedere di nuovo; gli utenti non presenti nel foglio non verranno ricreati.
    </div>}
    <form action={importaAction} className="flex min-h-0 flex-1 flex-col gap-3">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="revisione" value={revisione} />
      <input type="hidden" name="confermaSenzaCodice" value={confermaSenzaCodice ? "on" : "off"} />
      <input type="hidden" name="confermaReset" value={conferma} />
      {Object.entries(scelte).filter(([, v]) => v).map(([k, v]) => <input key={k} type="hidden" name={`scelta:${k}`} value={v} />)}
      <div className="shrink-0 space-y-3">
      <h2 className="text-lg font-semibold">Giornate</h2>
      <nav aria-label="Gruppi delle righe" className="flex flex-wrap gap-2">
        {gruppiVisibili.map((stato) => <button type="button" key={stato} aria-pressed={filtroAttivo === stato} onClick={() => { setFiltro(stato); setPagina(1); }} className={`rounded-lg border px-3 py-2 text-sm ${filtroAttivo === stato ? "border-indigo-500 bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-100" : "border-zinc-300 dark:border-zinc-700"}`}>{ETICHETTE[stato]} ({counts[stato]})</button>)}
      </nav>
      </div>
      <section aria-label="Dettaglio importazione" tabIndex={0} className="space-y-4 focus-visible:outline-2 focus-visible:outline-indigo-500 [@media(min-width:1024px)_and_(min-height:640px)]:min-h-0 [@media(min-width:1024px)_and_(min-height:640px)]:flex-1 [@media(min-width:1024px)_and_(min-height:640px)]:overflow-y-auto [@media(min-width:1024px)_and_(min-height:640px)]:overscroll-contain [@media(min-width:1024px)_and_(min-height:640px)]:pr-2">
      {allineato && <p role="status" className="rounded-lg bg-green-50 p-4 text-sm text-green-900 dark:bg-green-950 dark:text-green-100">Il foglio è già allineato. Nessuna modifica da importare.</p>}
      {gruppiVisibili.length > 0 && <section aria-label={ETICHETTE[filtroAttivo]} className="space-y-3">
        {!filtrate.length && <p className="py-6 text-sm text-zinc-500">Nessuna giornata da esaminare.</p>}
        {filtrate.slice((pagina - 1) * 30, pagina * 30).map(mostraRiga)}
        {pagine > 1 && <div className="flex items-center gap-3 text-sm"><button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className={FIELD}>Precedente</button><span>Pagina {pagina} di {pagine}</span><button type="button" disabled={pagina >= pagine} onClick={() => setPagina((p) => p + 1)} className={FIELD}>Successiva</button></div>}
      </section>}
      {(["PRESENTE", "IGNORATA"] as const).filter((stato) => counts[stato] > 0).map((stato) => {
        const righe = piano.righe.filter((r) => r.stato === stato);
        const paginaSecondaria = pagineSecondarie[stato];
        const totalePagine = Math.ceil(righe.length / 30);
        return <details key={stato} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">{counts[stato]} {counts[stato] === 1 ? (stato === "PRESENTE" ? "giornata già presente" : "giornata ignorata") : (stato === "PRESENTE" ? "giornate già presenti" : "giornate ignorate")} · Mostra</summary>
          <section aria-label={ETICHETTE[stato]} className="mt-3 space-y-3">
            {righe.slice((paginaSecondaria - 1) * 30, paginaSecondaria * 30).map(mostraRiga)}
            {totalePagine > 1 && <div className="flex items-center gap-3"><button type="button" disabled={paginaSecondaria <= 1} onClick={() => setPagineSecondarie((p) => ({ ...p, [stato]: paginaSecondaria - 1 }))} className={FIELD}>Precedente</button><span>Pagina {paginaSecondaria} di {totalePagine}</span><button type="button" disabled={paginaSecondaria >= totalePagine} onClick={() => setPagineSecondarie((p) => ({ ...p, [stato]: paginaSecondaria + 1 }))} className={FIELD}>Successiva</button></div>}
          </section>
        </details>;
      })}
      {an.avvisi.length > 0 && <section aria-label="Avvisi sui dati" className="space-y-2 rounded-xl border border-amber-300 p-4 text-sm dark:border-amber-700">
        <h2 className="font-semibold">Dati da verificare</h2>{an.avvisi.map((v, i) => <p key={i}>{v}</p>)}
      </section>}
      {nuoveAnagrafiche > 0 && <details className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <summary className="cursor-pointer font-semibold">Nuove anagrafiche ({nuoveAnagrafiche})</summary>
        <p className="my-3 text-sm">{piano.modalita === "RESET" ? "Il reset sostituirà le anagrafiche con quelle mostrate, conservando gli amministratori e i loro accessi." : "Identità e ruoli degli utenti esistenti restano invariati. I periodi e lo stato dei coach del foglio verranno sincronizzati. Agli utenti senza profilo collaboratore verrà aggiunto il profilo indicato. Le nuove anagrafiche verranno aggiunte insieme alle giornate approvate."}</p>
        {an.clienti.map((c) => <details key={c.id} className="my-2 rounded border border-zinc-200 p-3 dark:border-zinc-700">
          <summary>{c.ragioneSociale}{c.verifica ? " — estrazione AI da verificare" : ""}</summary>
          <h3 className="mt-3 text-sm font-semibold">Testo originale</h3><dl className="text-sm">{Object.entries(c.dettagli).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="font-medium">{k}</dt><dd className="whitespace-pre-wrap">{v}</dd></div>)}</dl>
          {c.verifica && <><h3 className="mt-3 text-sm font-semibold">Campi proposti dall’AI</h3><dl className="text-sm">{Object.entries(c.dati).filter(([k]) => k !== "note").map(([k, v]) => <div key={k}><dt className="font-medium">{k}</dt><dd>{v}</dd></div>)}</dl>
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="clienteAI" value={c.id} disabled={completata} />Confermo i dati AI di {c.ragioneSociale}</label><p className="text-xs">Senza conferma viene conservato soltanto il testo originale nelle note.</p></>}
        </details>)}
        {offerteDaCreare.map((o) => <p key={o.id} className="my-2 text-sm">Offerta {o.codice} — {piano.riferimenti.clienti.find((c) => c.id === o.clienteId)?.ragioneSociale} · {o.tariffaGiornaliera} €/giorno · {o.giorniPrevisti} giorni · {o.attiva ? "Aperta" : "Chiusa"} · Trasferte {o.gestioneTrasferta}{o.importoTrasfertaForfettaria ? ` ${o.importoTrasfertaForfettaria} €` : ""}</p>)}
        {an.coach.map((c) => <div key={c.id} className="my-2 text-sm">
          <p>{c.nome} {c.cognome} — {c.email} · {c.profiloEsistente ? "Aggiornamento storico e stato" : c.utenteEsistente ? "Profilo da aggiungere (ruolo invariato)" : c.ruolo} · {c.attivo === false ? "Collaboratore cessato / non attivo nel mese corrente" : "Collaboratore attivo"}</p>
          <ul className="ml-4 list-disc">{(c.tariffe ?? [{ validaDalMese: c.dalMese, validaAlMese: null, modalita: c.modalita, importo: c.importo }]).map((t) => <li key={t.validaDalMese}>{t.validaDalMese} → {t.validaAlMese ?? "in corso"} · {t.modalita} {t.importo} {t.modalita === "PERCENTUALE" ? "% trattenuta" : "€"}</li>)}</ul>
        </div>)}
      </details>}
      </section>
      {!completata && haOperazioni && <section aria-label="Azioni importazione" className="sticky bottom-0 z-20 shrink-0 space-y-1 border-t border-zinc-300 bg-white px-1 py-2 shadow-[0_-8px_16px_-16px_rgba(0,0,0,0.4)] dark:border-zinc-700 dark:bg-zinc-950 [@media(min-width:1024px)_and_(min-height:640px)]:static">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">Da aggiungere: <strong>{nuoveGiornate}</strong>. Da aggiornare: <strong>{aggiornamenti}</strong>. {eliminazioni > 0 && <span className="font-semibold text-red-700 dark:text-red-300">Da eliminare: {eliminazioni}. </span>}<span className="hidden sm:inline">{nuoveAnagrafiche > 0 && `Nuove anagrafiche: ${nuoveAnagrafiche}.`}</span></p>
          <Submit attesa="Importazione in corso…" pericolo={piano.modalita === "RESET"} disabilitato={importazioneDisabilitata}>{piano.modalita === "RESET" ? "Azzera e reimporta i dati approvati" : "Importa"}</Submit>
        </div>
        {(daVerificare + counts.NON_IMPORTABILE + ignorate > 0) && <p className="text-xs text-zinc-500">Escluse: {[daVerificare > 0 && `${daVerificare} da verificare`, counts.NON_IMPORTABILE > 0 && `${counts.NON_IMPORTABILE} ${counts.NON_IMPORTABILE === 1 ? "scarto" : "scarti"}`, ignorate > 0 && `${ignorate} ignorate per tua scelta`].filter(Boolean).join(", ")}.</p>}
        {counts.SCOMPARSA - eliminazioni > 0 && <p className="text-xs text-zinc-500">Giornate non più presenti che resteranno nell’app: {counts.SCOMPARSA - eliminazioni}.</p>}
        {conferme}
      </section>}
    </form>
  </div>;
}
