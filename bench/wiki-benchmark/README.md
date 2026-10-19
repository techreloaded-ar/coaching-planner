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
