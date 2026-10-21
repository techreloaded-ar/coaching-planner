# Benchmark ARchetipo × Wiki

Piano completo: [docs/benchmark/piano-benchmark-wiki.md](../../docs/benchmark/piano-benchmark-wiki.md).

## Prerequisiti

- Postgres del progetto attivo (`docker compose up -d`), porta 3000 libera.
- `claude` autenticato, `archetipo` nel PATH.
- Le prove girano in `../coaching-planner-bench-runs/` (sovrascrivibile con `BENCH_RUNS`).

## Comandi

```bash
python3 bench/wiki-benchmark/run.py preflight
```

```bash
python3 bench/wiki-benchmark/run.py run sonnet-C3
```

```bash
python3 bench/wiki-benchmark/run.py all
```

```bash
python3 bench/wiki-benchmark/run.py status
```

`run` esegue anche il chiarimento del modello se manca. Ogni fase è idempotente: dopo un'interruzione si rilancia lo stesso comando.

## Cosa fa per ogni prova

1. Clone baseline senza storia Git e senza `bench/` (`git archive`), con il worktree ARchetipo disabilitato.
2. Skill copiate dall'installazione corrente (sono gitignored); nelle prove senza Wiki si rimuovono `docs/wiki/` e `archetipo-wiki`.
3. Database `cpb_<prova>` e `cpb_<prova>_e2e` dedicati, `.env` con segreti sintetici, migrazioni e seed.
4. Ogni fase è una sessione `claude -p` nuova: `--setting-sources project,local` (niente plugin, hook e memoria utente), lettura del repo originale negata, budget per fase. Le fasi con plugin estranei vengono scartate.
5. Dopo ogni fase: commit del banco, stream e transcript (anche dei subagenti) copiati in `phases/<fase>/`, `metrics.json` con tempi, token, costo USD e attribuzione delle operazioni Wiki.

## Struttura di una prova

```
<prova>/repo/                 clone su cui lavorano gli agenti
<prova>/phases/<fase>/        prompt.txt, stream-*.jsonl, transcript/, result.txt, metrics.json
<prova>/run.json              esito per storia, hash dell'albero consegnato, diffstat
<prova>/diff.patch            diff rispetto al chiarimento
D-<modello>-<wiki|nowiki>/    chiarimento condiviso: dialogo.md, committente.jsonl, discovery.json
```

## Valutazione e report

```bash
python3 bench/wiki-benchmark/valuta.py all
```

```bash
python3 bench/wiki-benchmark/report.py
```

- `valuta.py`: copia immutabile della consegna (hash dell'albero verificato), DB dedicati, gate di regressione (migrazione nuova + drift, lint, unit, build, e2e preesistenti, test conservati), adattatore generato una volta da Opus e conservato in `valutazione/adattatore/`, oracolo `oracolo/` (integrazione Vitest + browser Playwright), punteggio per area da `matrice.json` → `valutazione/evaluation.json`. Per le prove con Wiki anche `wiki.json` (validate, pagine candidate non aggiornate, giudice).
- Taratura: `valuta.py baseline` deve dare 8/100 (solo regressioni).
- `report.py`: `report-dati.json` → narrativa Opus (`narrativa.json`, solo numeri dai dati) → `report.html` con lo stile del report RideAtlas.
- Lancio completo autonomo: [PROMPT-lancio.md](PROMPT-lancio.md).

## Esperimento sull'incidenza della Wiki a storie uguali

`matrice-wiki.json` (selezionata con `BENCH_MATRICE=matrice-wiki.json`) riusa i chiarimenti della matrice principale e
isola la Wiki nella fase di sviluppo: le storie vengono sempre da `D-<modello>-wiki`, cambia solo la Wiki disponibile.

- `PW` / `PN`: pipeline `piano` (archetipo-plan → archetipo-implement per storia, senza accettazione) con e senza Wiki, 2 repliche.
- `DN`: sviluppo diretto senza Wiki a storie uguali, da confrontare con `<modello>-C2` della matrice principale.
- `storie_da_wiki: true` su una prova senza Wiki clona il chiarimento con Wiki e rimuove `docs/wiki` e la skill
  (`storie_da_wiki: false` su una prova con Wiki ripristina la Wiki della baseline).
- `chiarimenti_extra`: repliche indipendenti dei chiarimenti (`D-<modello>-<wiki>-r<N>`, anche `run.py discover sonnet wiki 2`).

```bash
BENCH_MATRICE=matrice-wiki.json python3 bench/wiki-benchmark/run.py all
```

```bash
BENCH_MATRICE=matrice-wiki.json python3 bench/wiki-benchmark/valuta.py all
```
