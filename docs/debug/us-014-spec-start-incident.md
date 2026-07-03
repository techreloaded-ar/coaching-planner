# Indagine: `archetipo spec start US-014`

## Obiettivo
Capire perché durante l'implementazione di `US-014` il comando:

```bash
archetipo spec start US-014
```

ha portato la spec in `IN PROGRESS` ma **non ha materializzato subito la worktree attesa** in:

```text
.archetipo/worktrees/US-014
```

## Evidenze raccolte

### 1) Configurazione progetto
File: `/Users/smarello/repo/coaching-planner/.archetipo/config.yaml`

```yaml
worktree:
  enabled: true
  base: main
  dir: .archetipo/worktrees
  branch_prefix: archetipo/
```

Quindi `spec start` **doveva** creare branch + worktree.

---

### 2) Runtime usato
`archetipo` risolve a:

```text
/Users/smarello/repo/ARchetipo/.dev/bin/archetipo
```

Versione:

```text
archetipo dev-local
```

Quindi non stiamo usando una release remota/packaged, ma il checkout locale di `ARchetipo`.

---

### 3) Osservazione chiave durante il run
Durante la sessione di implementazione è stato osservato questo comportamento:

1. `archetipo spec next --status PLANNED` ha restituito per `US-014`:
   - `branch: archetipo/US-014`
   - `worktree: .archetipo/worktrees/US-014`
   - `fork_base: 66dd145...`
2. subito dopo `archetipo spec start US-014`, un nuovo `spec show` riportava ancora:
   - `workdir: /Users/smarello/repo/coaching-planner/.archetipo/worktrees/US-014`
3. però il path **non esisteva sul filesystem** in quel momento.

In pratica:

- lo stato workflow è avanzato;
- i metadati branch/worktree risultavano presenti;
- la directory della worktree però non era stata creata.

---

### 4) La worktree `US-014` è stata poi creata manualmente
Reflog del branch:

```text
17f71e0 archetipo/US-014@{2026-07-03 16:19:04 +0200}: commit: feat(US-014): add monthly invoice summary
66dd145 archetipo/US-014@{2026-07-03 15:27:29 +0200}: branch: Created from 66dd145d8ddb1c16997f450be587ecbd012cbf8b
```

Questo è importante perché mostra che il branch `archetipo/US-014` è stato creato alle **15:27:29 local time**, cioè quando è stato eseguito manualmente:

```bash
git worktree add -b archetipo/US-014 .archetipo/worktrees/US-014 66dd145...
```

Quindi la branch/worktree effettiva **non risulta creata prima** da `archetipo spec start`.

---

### 5) Stato Git attuale
Attualmente il repo mostra:

```text
/Users/smarello/repo/coaching-planner                              66dd145 [main]
/Users/smarello/repo/coaching-planner/.archetipo/worktrees/US-014  17f71e0 [archetipo/US-014]
/Users/smarello/repo/coaching-planner/.archetipo/worktrees/US-015  66dd145 [archetipo/US-015]
```

Questo però riflette lo stato **dopo** la creazione manuale della worktree `US-014`.

---

### 6) Evidenza sui file `.env*`
Nel worktree `US-014` oggi troviamo:

- presente: `.env.example`
- assente: `.env`

Confronto filesystem:

```text
worktree:
- /Users/smarello/repo/coaching-planner/.archetipo/worktrees/US-014/.env        -> assente
- /Users/smarello/repo/coaching-planner/.archetipo/worktrees/US-014/.env.example -> presente

root:
- /Users/smarello/repo/coaching-planner/.env         -> presente
- /Users/smarello/repo/coaching-planner/.env.example -> presente
```

Interpretazione:

- `.env.example` è un file tracciato da git, quindi compare normalmente in una worktree creata con `git worktree add`;
- `.env` è ignorato da git, quindi compare **solo** se qualche logica applicativa lo copia esplicitamente;
- l'assenza di `.env` è coerente con il fatto che la worktree `US-014` sia stata creata manualmente via git, non tramite la logica completa di `archetipo spec start`.

---

## Codice rilevante in `ARchetipo`

### `spec start` prova a fare setup worktree, ma come step non fatale
File: `/Users/smarello/repo/ARchetipo/cli/internal/cli/spec_cmd.go`

Punti chiave:

- `newSpecStartCmd(...)` chiama `setupWorktree(...)` se `cfg.Worktree.Enabled`
- se `setupWorktree(...)` fallisce, stampa solo warning su stderr:

```go
if cfg.Worktree.Enabled {
    if wt, werr := setupWorktree(ctx, cfg, c, ref); werr != nil {
        fmt.Fprintf(s.err, "warning: worktree setup skipped: %v\n", werr)
    } else {
        res.Refs = append(res.Refs, domain.Ref{Code: ref, Path: wt})
    }
}
```

### Il punto sospetto: early-return se `spec.Branch != ""`
Sempre in `spec_cmd.go`:

```go
spec, err := c.ReadSpecDetail(ctx, ref)
...
if spec.Branch != "" {
    // Already set up on a previous start.
    return spec.Worktree, nil
}
```

Questo significa:

- se i metadati della spec riportano già un branch,
- `setupWorktree(...)` **non verifica** più se la branch esiste davvero,
- **non verifica** se la worktree esiste davvero,
- **non richiama** `gitwt.Ensure(...)`,
- e quindi non copia neppure i file `.env*`.

Questo è il candidato n.1 per spiegare l'incidente.

---

### La copia dei `.env*` avviene solo dentro `gitwt.Ensure(...)`
File: `/Users/smarello/repo/ARchetipo/cli/internal/gitwt/gitwt.go`

La funzione che copia gli env è:

```go
func copyRootEnvFiles(repoRoot, worktreeAbs string) error {
    matches, err := filepath.Glob(filepath.Join(repoRoot, ".env*"))
    ...
}
```

Viene chiamata solo qui:

```go
if _, statErr := os.Stat(worktreeAbs); statErr != nil {
    ...
    if _, err := runGit(ctx, repoRoot, "worktree", "add", worktreeAbs, branch); err != nil {
        return "", "", "", err
    }
    if err := copyRootEnvFiles(repoRoot, worktreeAbs); err != nil {
        return "", "", "", err
    }
}
```

Quindi se `setupWorktree(...)` esce prima per `spec.Branch != ""`, la copia degli env **non parte proprio**.

---

### `spec show` può restituire un `workdir` non esistente
File: `/Users/smarello/repo/ARchetipo/cli/internal/cli/spec_cmd.go`

```go
func resolveWorkdir(cfg config.Config, st domain.Spec) string {
    if cfg.Worktree.Enabled {
        if rel, exists := gitwt.Resolve(cfg.ProjectRoot, cfg.Worktree, st.Code); exists {
            return filepath.Join(cfg.ProjectRoot, rel)
        }
    }
    if st.Worktree != "" {
        return filepath.Join(cfg.ProjectRoot, st.Worktree)
    }
    return cfg.ProjectRoot
}
```

Se la directory convenzionale non esiste sul disco, ma `st.Worktree` è valorizzato nei metadati, `spec show` restituisce comunque quel path assoluto.

Quindi uno skill può ricevere:

- `workdir=/.../.archetipo/worktrees/US-014`
- ma la directory non esiste davvero.

Anche questo è coerente con quanto osservato.

---

## Test già presenti nel CLI

### Test per la copia `.env.local`
File: `/Users/smarello/repo/ARchetipo/cli/internal/cli/cli_test.go`

Esiste già un test che verifica che, quando la worktree viene creata correttamente, `.env.local` venga copiato:

```go
gotEnv, err := os.ReadFile(filepath.Join(wantWorkdir, ".env.local"))
if err != nil {
    t.Fatalf("expected .env.local copied into worktree: %v", err)
}
```

Quindi il comportamento desiderato esiste ed è testato.

### Test per un altro bug di stale metadata
Sempre in `cli_test.go` esiste:

```text
TestSpecStart_AfterIntegrateDependency_CreatesWorktree
```

che copre stale metadata **di un blocker integrato**.

Non ho trovato invece un test che copra questo caso specifico:

> la spec stessa ha `branch/worktree` valorizzati nei metadati, ma la branch/worktree reale non esiste.

---

## Ipotesi più probabile

### Ipotesi A — stale metadata sulla spec stessa (più probabile)
`US-014` aveva già `branch/worktree/fork_base` nei metadati letti da `spec show`, ma la branch/worktree reale non esisteva.

Effetto:

1. `archetipo spec start US-014` fa la transizione di stato;
2. `setupWorktree(...)` legge la spec;
3. vede `spec.Branch != ""`;
4. ritorna immediatamente `spec.Worktree`;
5. non crea la worktree;
6. non copia `.env*`;
7. `spec show` continua a esporre un `workdir` apparentemente valido ma inesistente.

### Ipotesi B — warning emesso ma non notato
Meno probabile in questo caso, perché se `setupWorktree(...)` avesse fallito davvero durante `gitwt.Ensure(...)`, il codice avrebbe stampato:

```text
warning: worktree setup skipped: ...
```

Nel run non abbiamo un warning del genere come evidenza forte.

---

## Cosa approfondire in una sessione pulita

### Domande da verificare
1. **Perché `US-014` risultava già con `branch/worktree/fork_base` prima di `spec start`?**
2. **Quei metadati erano davvero persistiti sul file spec, o arrivavano da altra fonte?**
3. **`setupWorktree(...)` dovrebbe verificare l'esistenza reale della branch/worktree anche quando `spec.Branch != ""`?**
4. **`resolveWorkdir(...)` dovrebbe evitare di restituire un path inesistente?**

### Comandi utili
```bash
# 1. vedere cosa legge il connector oggi
archetipo spec show US-014

# 2. controllare branch e worktree reali
git branch --list 'archetipo/*'
git worktree list --porcelain

# 3. controllare il reflog della branch
git reflog show --date=iso archetipo/US-014

# 4. verificare il contenuto persistito della spec nel commit base
git show 66dd145:.archetipo/specs/US-014.yaml

# 5. ispezionare i punti del CLI
# /Users/smarello/repo/ARchetipo/cli/internal/cli/spec_cmd.go
# /Users/smarello/repo/ARchetipo/cli/internal/gitwt/gitwt.go
```

### Repro minimo da costruire nel CLI
Costruire un test o una repro manuale in cui:

1. una spec è `PLANNED`;
2. i metadati spec contengono già:
   - `branch: archetipo/US-XXX`
   - `worktree: .archetipo/worktrees/US-XXX`
3. la branch git reale non esiste;
4. la directory worktree reale non esiste;
5. si lancia `archetipo spec start US-XXX`.

Atteso ideale:

- il comando dovrebbe ricreare/verificare la worktree reale, oppure fallire con errore chiaro.

Atteso attuale probabile:

- il comando ritorna successo e lascia `workdir` puntato a un path inesistente.

---

## Conclusione operativa
La pista più forte è questa:

> `archetipo spec start` ha trovato `spec.Branch` già valorizzato e ha saltato del tutto la creazione/verifica della worktree, restituendo solo il path registrato nei metadati. Per questo non è partita neanche la copia dei file `.env*`.

Questa ipotesi è coerente con:

- l'assenza iniziale della directory worktree sul filesystem;
- il fatto che la branch `archetipo/US-014` risulti creata solo manualmente alle 15:27;
- l'assenza di `.env` nel worktree finale;
- il codice attuale di `setupWorktree(...)` e `resolveWorkdir(...)`.
