#!/usr/bin/env python3
"""Genera bench/index.html, la porta d'ingresso del banco, da bench/manifest.json.

Uso: python3 bench/index.py
Ogni report linka l'indice e l'indice linka ogni report. I criteri di valutazione comuni (§2) vivono qui:
i report li richiamano con un link invece di ridefinirli.
"""
import json
from pathlib import Path

from common import html as h

BENCH = Path(__file__).parent
MANIFEST = json.loads((BENCH / "manifest.json").read_text())
CONTROLLI = json.loads((BENCH / "common" / "controlli.json").read_text())
e = h.e


def usd(v):
    return "" if v is None else f"{v:,.2f}".replace(",", " ")


def classe_stato(stato):
    return {"fatto": "status-fatto", "in corso": "status-corso"}.get(stato, "status-pianificato")


def ordine(r):
    n = r["numero"]
    return (0, str(n)) if isinstance(n, str) else (1, f"{n:02d}")


# ── sezioni ──────────────────────────────────────────────────────────────────

def cosa_verifichiamo():
    return (
        "<p><strong>Ipotesi generale.</strong> I modelli recenti hanno bisogno di meno harness di quanto ARchetipo oggi impone, "
        "e troppo harness li rallenta: ogni skill a valle del chiarimento va giustificata con un vantaggio misurato, non presunto.</p>"
        "<p>Gli esperimenti già fatti (report 0a, 0b, 0c) hanno tre limiti che i report successivi affrontano uno per uno:</p><ul>"
        "<li><strong>Rumore tra repliche grande quanto gli effetti.</strong> Con una replica per cella, differenze di 2–3 punti tra "
        "celle sono dello stesso ordine di quelle tra repliche della stessa cella (sonnet-PW: 90,7 e 88,2). Il report 1 misura il pavimento.</li>"
        "<li><strong>Oracolo saturo in alto.</strong> I punteggi stanno tra 82,8 e 90,7 e il tetto lo fissa il chiarimento: i controlli che "
        "falliscono (C2 in tutte le prove, concorrenza, visibilità) dipendono dalle storie, non dalla pipeline. Il report 6 lavora sulla fase spec.</li>"
        "<li><strong>Compiti facili su una codebase già piena delle convenzioni di ARchetipo.</strong> Una funzionalità media su un repository "
        "con Wiki, factory e2e, guardrail di lint e CI: il vantaggio di un processo si vede poco dove il terreno è già preparato. "
        "Il report 4 guarda almeno alla qualità tecnica di ciò che viene consegnato.</li></ul>")


def tabella_report():
    righe = []
    for r in sorted(MANIFEST["report"], key=ordine):
        link = f'<a href="{e(r["path"])}">{e(r["titolo"])}</a>' if r.get("path") and r["stato"] == "fatto" else e(r["titolo"])
        nota = f'<small>{e(r["note"])}</small>' if r.get("note") else ""
        budget = f'<small>budget ≤ {usd(r["budget_usd"])} USD</small>' if r.get("budget_usd") else ""
        righe.append(
            f'<tr><td class="num">{e(r["numero"])}</td><td>{link}{nota}</td><td>{e(r["domanda"])}</td><td>{e(r["disegno"])}</td>'
            f'<td class="{classe_stato(r["stato"])}"><strong>{e(r["stato"])}</strong></td>'
            f'<td class="num">{usd(r["costo_usd"])}{budget}</td><td>{e(r["data"] or "")}</td><td>{e(r["risultato"] or "")}</td></tr>')
    return ('<div class="scroll"><table><thead><tr><th class="num">N.</th><th>Report</th><th>Domanda</th><th>Disegno</th><th>Stato</th>'
            '<th class="num">Costo USD</th><th>Data</th><th>Risultato in una frase</th></tr></thead><tbody>' + "".join(righe) +
            '</tbody></table></div><p class="muted">I report 0a, 0b e 0c precedono l\'indice e i criteri comuni; sono stati prodotti con il banco '
            'in <code>bench/wiki-benchmark/</code>. I report senza link sono pianificati: titolo, domanda e disegno sono fissati qui prima di lanciarli.</p>')


def tabella_controlli():
    aree = CONTROLLI["aree"]
    righe, area_corrente = [], None
    for c in CONTROLLI["controlli"]:
        if c["area"] != area_corrente:
            area_corrente = c["area"]
            n = sum(1 for x in CONTROLLI["controlli"] if x["area"] == area_corrente)
            righe.append(f'<tr><th colspan="7">{e(aree[area_corrente]["titolo"])} <small>{aree[area_corrente]["punti"]} punti · {n} controlli</small></th></tr>')
        righe.append(f'<tr><td><strong>{e(c["codice"])}</strong></td><td>{e(c["verifica"])}</td><td>{e(c["livello"])}</td>'
                     f'<td>{e(c["tema"])}</td><td>{e(c["storie_sonnet"])}</td><td>{e(c["storie_opus"])}</td></tr>')
    righe.append(f'<tr><th colspan="7">{e(aree["regressioni"]["titolo"])} <small>{aree["regressioni"]["punti"]} punti · tutto o niente</small></th></tr>'
                 f'<tr><td>—</td><td>{e(CONTROLLI["regressioni"])}</td><td>gate CI</td><td>—</td><td>—</td><td>—</td></tr>')
    return ('<div class="scroll"><table><thead><tr><th>Codice</th><th>Che cosa verifica</th><th>Livello</th><th>Tema del committente</th>'
            '<th>Nelle storie Sonnet (D-sonnet-wiki)</th><th>Nelle storie Opus (D-opus-wiki)</th></tr></thead><tbody>' + "".join(righe) +
            '</tbody></table></div><p class="muted">Tabella copiata dal report «Wiki e qualità funzionale». Le ultime due colonne riportano il giudizio '
            'a checklist sulle storie di partenza: un controllo può fallire perché il tema non è mai entrato nelle storie (Non chiarito) oppure nonostante sia esplicito.</p>')


def criteri():
    tecnica = [
        ("Dimensione e focalizzazione", 20, "righe nette aggiunte in <code>src/</code> (esclusi test e migrazioni) rispetto alla mediana della coorte",
         "20 punti se ≤ mediana, decrescita lineare fino a 0 a 2× mediana"),
        ("Complessità", 15, "complessità ciclomatica delle funzioni nuove o modificate, via regola ESLint <code>complexity</code> con soglia 10 in modalità report",
         "15 × (1 − quota di funzioni oltre soglia); −3 se la massima supera 20"),
        ("Duplicazione", 10, "<code>jscpd</code> sui file toccati in <code>src/</code>, righe duplicate / righe toccate",
         "10 punti se &lt; 3 %, 0 se ≥ 15 %, lineare in mezzo"),
        ("Test: mutation score", 25, "StrykerJS con runner Vitest, mutanti sui soli file <code>src/</code> toccati, test unit della consegna",
         "25 × mutation score; se la suite non gira, 0 e nota"),
        ("Test: copertura dei percorsi", 5, "ogni controllo dell'oracolo (esclusi gate e U*) ha almeno un test unit o e2e della consegna che lo copre, giudicato per nome e contenuto",
         "5 × quota coperta"),
        ("Aderenza alle convenzioni del repo", 15, "checklist chiusa: lint e guardrail e2e puliti; factory e fixtures di <code>tests/e2e/support</code> usate invece delle entità seed; "
         "nessun <code>selectOption({index})</code>; nessun hard wait; blocco di dominio in una funzione condivisa chiamata da ogni server action; migrazione Prisma presente senza drift",
         "15 × voci rispettate / voci applicabili"),
        ("Tipi e sicurezza statica", 10, "<code>tsc --noEmit</code> senza errori nuovi; nessun <code>any</code>, <code>as unknown as</code>, <code>@ts-ignore</code> o <code>eslint-disable</code> nuovo",
         "10 se tutto vero; −2,5 per ogni voce violata"),
    ]
    righe_tecnica = "".join(f'<tr><td>{a}</td><td class="num">{p}</td><td>{m}</td><td>{c}</td></tr>' for a, p, m, c in tecnica)
    rubrica = "".join(f'<tr><td>{e(v["titolo"])}</td><td class="num">{v["punti"]}</td></tr>' for v in CONTROLLI["aree"].values())
    return (
        '<p>Questi criteri sono la base comune: tutti i report li usano identici. Dove un report ne usa solo una parte, lo dichiara. '
        'Se un report ha bisogno di un criterio nuovo, lo propone qui prima di usarlo; se un criterio si rivela inapplicabile, la modifica '
        'si annota nel registro e si applica a tutti i report già fatti.</p>'

        '<h3 id="criterio-funzionale">2.1 Qualità funzionale (oracolo esterno, 100 punti)</h3><ul>'
        '<li><strong>Che cosa misura:</strong> la distanza tra la consegna e il <strong>bisogno del committente</strong>, fissato prima delle prove in un profilo '
        'nascosto agli agenti. Non misura la distanza dalle storie: un controllo può fallire anche se la consegna rispetta le storie alla lettera, '
        'e l\'omissione è allora attribuita al chiarimento, non allo sviluppo.</li>'
        '<li><strong>Come:</strong> copia immutabile della prima consegna (hash dell\'albero verificato), database Postgres dedicati, server action invocate '
        'con sessioni firmate sintetiche, browser Chromium contro <code>next start</code> a 1440 e 390 px, gate di regressione della CI (lint con guardrail e2e, '
        'Vitest, build, e2e preesistenti, nessun test rimosso o disattivato).</li>'
        '<li><strong>Adattatore per consegna,</strong> generato da un agente fisso (Opus) e conservato: collega i controlli alle interfacce prodotte senza '
        'implementare capacità mancanti. Le correzioni agli adattatori si applicano a tutte le consegne con lo stesso criterio e si annotano in CORREZIONI.md.</li>'
        '<li><strong>Punteggio:</strong> aree con peso; punti area = peso × controlli superati / controlli eseguiti; regressioni tutto o niente; violazioni critiche '
        '(scrittura in mese chiuso, chiusura da non amministratore) riportate a parte e non assorbite dal totale.</li>'
        '<li><strong>Affidabilità dell\'oracolo:</strong> ogni consegna viene valutata <strong>tre volte</strong>; il punteggio è la mediana e l\'intervallo min–max va riportato. '
        'Una differenza tra due consegne sotto l\'intervallo di rivalutazione non è una differenza.</li></ul>'
        f'<h4>Aree e pesi per la funzionalità «chiusura del mese»</h4><table style="max-width:420px"><thead><tr><th>Area</th><th class="num">Punti</th></tr></thead><tbody>{rubrica}</tbody></table>'
        '<h4>I 27 controlli con codice e i gate</h4>' + tabella_controlli() +

        '<h3 id="criterio-tecnico">2.2 Qualità tecnica (100 punti, definita dal report 4)</h3>'
        '<p>Misurata sul diff della prima consegna rispetto alla baseline, esclusi <code>docs/wiki/</code>, <code>.archetipo/</code>, lockfile e file generati. '
        '«Coorte» = tutte le consegne che partono dalla stessa coppia di storie.</p>'
        '<div class="scroll"><table><thead><tr><th>Area</th><th class="num">Punti</th><th>Metrica</th><th>Come si calcola</th></tr></thead>'
        f'<tbody>{righe_tecnica}</tbody></table></div>'
        '<p class="muted">Le voci che richiedono lettura (copertura dei percorsi, due voci della checklist) le assegna un giudice Opus a checklist chiusa, senza strumenti, '
        'che legge il diff; il giudizio è ripetuto due volte e, se diverge, vale la mediana con nota. Tutto il resto è calcolato da script in '
        '<code>bench/common/tecnica.py</code> e deve essere riproducibile a partire dall\'archivio della consegna.</p>'
        '<p class="muted"><strong>Registro, 2026-10-21 (report 4).</strong> Il mutation score sui file src toccati è dominato dai componenti React, privi di test unit in ogni consegna: '
        'il report 4 riporta accanto, senza farlo entrare nel punteggio, lo score sui soli file <code>.ts</code>. Proposta per i report successivi: tenere il criterio così com\'è e '
        'riportare sempre anche lo score sui soli <code>.ts</code>. L\'hard wait è letto alla lettera (nessun <code>waitForTimeout</code>), più severo del guardrail del repository.</p>'

        '<p class="muted"><strong>Proposta registrata e applicata, 2026-10-22 (report 3).</strong> Il giudice tecnico riceve descrizione e controlli del compito corrente; '
        'la coorte resta l’insieme delle consegne delle stesse storie. Il diff parte dalla baseline effettiva del compito (in T4 include già il difetto e le rimozioni). '
        'Migrazione e blocco di dominio entrano nella checklist solo quando applicabili: una lettura senza modifica di schema non richiede una migrazione nuova, '
        'un difetto di calcolo senza transizioni di stato non richiede un blocco delle scritture. I controlli affidati a giudici sul riepilogo finale non sono percorsi eseguibili '
        'da coprire con unit o e2e. Pesi e formule non cambiano; i valori predefiniti conservano il comportamento dei report precedenti. '
        'Emendamento preregistrato il 23 ottobre, prima delle prove: quando la mediana delle righe nette della coorte è non positiva, il riferimento al suo doppio non definisce un intervallo ordinato. '
        'Solo in quel caso la dimensione usa le righe aggiunte più eliminate in src/, rispetto alla mediana della stessa misura nella coorte; peso 20 e formula lineare invariati. '
        'La regola vale per qualsiasi coorte, anche storica; le 40 consegne già archiviate hanno coorti con mediana netta positiva e mantengono gli stessi punteggi. '
        'Il report dichiara per ogni compito quale misura è stata usata.</p>'

        '<h3 id="criterio-scoperta">2.3 Qualità della scoperta (fase spec, 100 punti)</h3><ul>'
        '<li><strong>Profilo nascosto</strong> del committente con 11 temi: decisione precedente RF-15, chi, granularità, quali mesi, effetto su tutte le scritture, '
        'riapertura con motivazione, storico, visibilità, concorrenza, schede aperte, dati invariati. Il committente simulato risponde solo a ciò che gli viene chiesto e, '
        'in approvazione, segnala solo contraddizioni esplicite.</li>'
        '<li><strong>Giudice Opus a checklist chiusa,</strong> senza strumenti, che legge il dialogo e le storie finali e assegna a ogni tema '
        '<strong>Esplicito</strong> (2), <strong>Parziale</strong> (1), <strong>Non chiarito</strong> (0).</li>'
        '<li><strong>Punteggio</strong> = somma / 22 × 100. Il giudizio è ripetuto due volte per ogni chiarimento; si riporta l\'accordo tra le due letture '
        '(quota di temi con lo stesso valore) e, in caso di disaccordo, vale la lettura più bassa.</li>'
        '<li><strong>Indicatori di processo,</strong> riportati accanto al punteggio: conflitto con RF-15 sollevato (sì/no, fonte); bozza completa mostrata al committente '
        'prima del salvataggio (sì/no); temi esclusi dichiarati in un «Fuori perimetro» visibile (conteggio); numero di storie; numero di scambi; minuti; USD; operazioni Wiki.</li></ul>'

        '<h3 id="criterio-costo">2.4 Costo e tempo</h3><ul>'
        '<li><strong>Minuti attivi:</strong> lavoro fino alla prima consegna, strumenti e subagenti inclusi, attese del committente simulato e pause del banco escluse e riportate a parte.</li>'
        '<li><strong>Token:</strong> totale = input non in cache + cache read + cache creation + output, dal <code>modelUsage</code> di Claude Code, subagenti inclusi, verificato contro i transcript.</li>'
        '<li><strong>USD:</strong> costo riportato da Claude Code a listino. Il chiarimento condiviso si aggiunge una volta a ogni percorso che lo riusa; non sommare le righe.</li>'
        '<li><strong>Operazioni Wiki:</strong> chiamate <code>archetipo wiki …</code> più letture e scritture sotto <code>docs/wiki/</code>, contate dai transcript.</li></ul>'

        '<h3 id="criterio-statistica">2.5 Regole statistiche</h3><ul>'
        '<li>Una cella con una sola replica è un\'osservazione, non una stima. Si riportano sempre mediana, minimo e massimo per cella.</li>'
        '<li>Per ogni differenza tra celle: intervallo di confidenza al 95 % via bootstrap (10 000 ricampionamenti) sulle repliche appaiate per storia; '
        'la differenza è «osservata» solo se l\'intervallo non contiene lo zero.</li>'
        '<li>Il <strong>pavimento di rumore</strong> (report 1) è la deviazione standard pooled tra repliche della stessa cella; dal report 1 in poi, '
        'ogni differenza sotto 2 deviazioni pooled si scrive «entro il rumore».</li>'
        '<li>Le ipotesi, le metriche di decisione e le soglie si scrivono in questo indice prima di lanciare le prove.</li></ul>')


def stile():
    fasi = "".join(f'<tr><td>{e(et)}</td><td>{e(sk)}</td><td><i style="display:inline-block;width:11px;height:11px;background:{c};margin-right:6px"></i><code>{c}</code></td></tr>'
                   for et, sk, c in h.FASI.values())
    diff = "".join(f'<tr><td>{e(et)}</td><td><i style="display:inline-block;width:11px;height:11px;background:{c};margin-right:6px"></i><code>{c}</code></td></tr>'
                   for et, c in h.CATEGORIE_DIFF.values())
    return (
        '<p>Tutti i report e l\'indice usano lo stesso foglio di stile <code>bench/common/style.css</code> e lo stesso generatore di barre e pagine '
        '<code>bench/common/html.py</code>. Nessuna libreria esterna, tutto inline: la pagina funziona aperta da file system. Lingua: italiano; numeri con '
        'punto decimale nelle tabelle e virgola nel testo; USD a prezzi di listino riportati da Claude Code; token in milioni con tre decimali. '
        'Ogni report ha una sezione «Limiti» scritta prima delle conclusioni.</p>'
        '<h3>Struttura di ogni report</h3><ol>'
        '<li><code>&lt;header&gt;</code> scuro: tag in maiuscolo con progetto, tipo di esperimento e numero di prove; <code>h1</code> con la domanda; un paragrafo con richiesta iniziale, configurazioni e modelli.</li>'
        '<li>«Cosa emerge»: da 3 a 5 tile (numero grande + spiegazione) e 3–5 paragrafi di sintesi. Ogni affermazione cita una cella o un controllo.</li>'
        '<li>«Overview delle run»: tabella con filtro per modello (<code>select#model</code>), colonne Percorso · Modello · Prima consegna min · Qualità /100 · Token totali M · '
        'Skill / processo eseguito · Distribuzione del tempo e skill per fase (barra + caption). Ogni riga ha <code>data-model</code>, <code>data-arm</code>, <code>data-tokens</code>; '
        'il nome del percorso è un link all\'anchor del dettaglio.</li>'
        '<li>«Quanti token e quanto costo»: Totale M · Input non cache M · Cache read M · Cache creation M · Output k · USD, con nota sul metodo di conteggio.</li>'
        '<li>«Tempi e consumi per skill e per singola fase»: un <code>&lt;details&gt;</code> per prova.</li>'
        '<li>«Come è stata verificata la qualità»: solo un richiamo ai <a href="#criteri">criteri comuni</a>, più ciò che è specifico del report.</li>'
        '<li>«Come interpretare i risultati» e «Limiti», con <code>div.callout</code> per le avvertenze.</li>'
        '<li>«Costo dell\'esperimento»: tabella delle voci, incluse prove scartate e giudici.</li>'
        '<li><code>&lt;footer&gt;</code>: «Generato da bench/… (matrice) · valutazione con l\'oracolo comune · prove in …» e link all\'indice.</li></ol>'
        '<h3>Barre di fase e colori</h3>'
        '<p>La barra è un <code>div.bar</code> con uno <code>span</code> per fase, larghezza in percentuale dei minuti attivi del percorso, <code>title</code> «Etichetta · skill · n.n min», '
        'seguita da <code>div.phase-caption</code> con un rigo per fase e il quadratino colorato. Le fasi ripetute (rework) usano il colore della skill e compaiono come righe separate. '
        'I colori sono fissi per tutto il banco:</p>'
        f'<div class="scroll"><table style="max-width:900px"><thead><tr><th>Fase</th><th>Skill</th><th>Colore</th></tr></thead><tbody>{fasi}</tbody></table></div>'
        + h.legenda_fasi() +
        '<p>Per il report 4 la stessa barra rappresenta la <strong>composizione del diff</strong> per categoria (stessa grafica, legenda dedicata, dichiarata nel report). '
        'La categoria «Mockup» (<code>docs/mockups/</code>, colore di archetipo-design) è stata aggiunta alle otto originali il 2026-10-21, prima di generare il report 4, perché la classificazione del diff la prevede.</p>'
        f'<div class="scroll"><table style="max-width:600px"><thead><tr><th>Categoria</th><th>Colore</th></tr></thead><tbody>{diff}</tbody></table></div>'
        + h.legenda_diff() +
        '<h3>Esempio di barra</h3>' + h.barra([("Chiarimento · archetipo-spec", h.FASI["spec"][2], 3.2), ("Piano · archetipo-plan", h.FASI["plan"][2], 6.1),
                                            ("Implementazione · archetipo-implement", h.FASI["implement"][2], 18.4), ("Accettazione · archetipo-review", h.FASI["review"][2], 5.0)]))


def ipotesi():
    blocchi = []
    for r in sorted(MANIFEST["report"], key=ordine):
        ip = r.get("ipotesi")
        if not ip:
            continue
        esito = (f'<p><strong>Esito:</strong> {e(ip["esito"])}</p>' if ip.get("esito")
                 else '<p class="muted">Esito: non ancora disponibile (report ' + e(r["stato"]) + ').</p>')
        emendamento = (f'<p class="callout"><strong>Emendamento autorizzato prima delle prove.</strong> {e(ip["disegno_ridotto"])} '
                       f'{e(ip.get("metrica_ridotta", ""))}</p>' if ip.get('disegno_ridotto') else '')
        blocchi.append(
            f'<h3>{e(ip["id"])} · Report {e(r["numero"])} · {e(r["titolo"])}</h3>'
            f'<p><strong>Ipotesi.</strong> {e(ip["testo"])}</p><p><strong>Metrica di decisione.</strong> {e(ip["metrica"])}</p>'
            f'<p><strong>Soglia.</strong> {e(ip["soglia"])}</p>{emendamento}{esito}')
    return ('<p class="callout">Scritte prima dell\'esecuzione. Quando il report è fatto, accanto alla soglia compare l\'esito, nella stessa forma.</p>'
            + "".join(blocchi))


def registro():
    fatti = [r for r in MANIFEST["report"] if r["costo_usd"] is not None]
    totale = sum(r["costo_usd"] for r in fatti)
    return (
        f'<p>Ultimo aggiornamento: <strong>{e(MANIFEST["aggiornato"])}</strong>. Costo cumulato registrato dei report con costo noto ({len(fatti)}): '
        f'<strong>{usd(totale)} USD</strong>. Prove in <code>{e(MANIFEST["prove"])}</code>.</p>'
        '<ul><li>Correzioni al banco, prove scartate e anomalie: <a href="wiki-benchmark/CORREZIONI.md">bench/wiki-benchmark/CORREZIONI.md</a>.</li>'
        '<li>Registro 2026-10-22, report 1: SD pooled 0,775; soglia «entro il rumore» 1,550 punti; MDE 1,569. Range delle tre letture zero su venti consegne; differenza fra adattatori zero sulle quattro prove designate dopo audit. Le serie con errori di adattamento sono archiviate ed escluse. Report 4 rigenerato su quaranta consegne, narrative e H4 aggiornate; giudici nuovi conteggiati solo nel report 1. Verifica browser file:// bloccata dalla policy; verifica visiva ancora da completare.</li>'
        '<li>Registro 2026-10-22, report 3: H3 preregistrata; baseline main 157ea55367ec940b464d9ad2c64789b73535b463; quattro compiti, variante spec baseline V0 (emendamento 23 ottobre prima dei chiarimenti: V1 era adottabile, non adottata), SD pooled 0,774919 e soglia 1,549839 dal solo compito chiusura mese. Preparazione entro 120 USD e report entro 750 USD; le 40 prove richiedono conferma umana dopo gli indicatori misurati. Artefatti e costi in bench/gradiente-difficolta/.</li>'
        '<li>Emendamento 2026-10-23, report 3, approvato prima delle prove: 8 prove Sonnet su T1/T3, 2 repliche diretto/completo; una lettura funzionale, metriche tecniche automatiche senza score /100, un rework. Tetto aggiuntivo 80 USD, totale 121,1195528 USD. Disegno originale conservato; H3 integrale non verificabile con il set ridotto.</li>'
        '<li>Rigenerare questa pagina: <code>python3 bench/index.py</code> (legge <code>bench/manifest.json</code> e <code>bench/common/controlli.json</code>).</li>'
        '<li>Vincoli validi per tutti i report: sessioni agente isolate (<code>claude -p</code> nel clone, <code>--setting-sources project,local</code>, budget per fase 25 USD Sonnet e 60 USD Opus, '
        'scarto delle fasi con skill o plugin estranei); precondizioni verificate dal banco e registrate in <code>metrics.json</code> (presenza di <code>docs/wiki/</code>, skill <code>archetipo-wiki</code>, '
        '<code>wiki.enabled</code>, hash delle skill copiate); una fase che dichiara «non abilitato» su una risorsa disponibile è invalida e va rifatta; '
        'idempotenza e ripresa; ordine randomizzato con seme salvato nella matrice; nessuna modifica al codice delle consegne.</li></ul>')


def genera():
    corpo = (
        f'<header><div class="tag">Coaching Planner · Banco di prova ARchetipo · {len(MANIFEST["report"])} report</div>'
        f'<h1>{e(MANIFEST["titolo"])}</h1><p>{e(MANIFEST["domanda_guida"])}</p>'
        '<p>I report sulla chiusura del mese partono da: «Quando ho mandato le fatture di un mese vorrei poterlo chiudere, così nessuno mi cambia più le ore sotto i piedi.» Il report 3 esegue il set ridotto T1/T3 con Sonnet, dopo aver preparato quattro compiti di difficoltà diversa. '
        'Modelli nei diversi studi: Sonnet e Opus, effort medium.</p></header>'
        + h.sezione("Cosa stiamo verificando", cosa_verifichiamo())
        + h.sezione("Report", tabella_report(), "report")
        + h.sezione("Criteri di valutazione comuni", criteri(), "criteri")
        + h.sezione("Convenzioni di stile e legenda dei colori", stile(), "stile")
        + h.sezione("Ipotesi pre-registrate", ipotesi(), "ipotesi")
        + h.sezione("Stato e registro", registro(), "registro"))
    footer = f'Generato da bench/index.py da bench/manifest.json · aggiornato il {e(MANIFEST["aggiornato"])}'
    documento = h.pagina(MANIFEST["titolo"], corpo, footer)
    documento = documento.replace('</head>', '<style>p,li,h3,footer,code{overflow-wrap:anywhere}</style></head>')
    (BENCH / "index.html").write_text(documento)
    print(BENCH / "index.html")


if __name__ == "__main__":
    genera()
