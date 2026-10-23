| Compito | Moduli | Call site esistenti | Migrazione | Concorrenza | File test cambiati; unit baseline che falliscono | Pagine Wiki | File test unit | Informazione |
|---|---:|---:|---|---|---:|---:|---:|---|
| T1 | 9 | 11 | additiva | no | 4 file; 2 unit | 12 | 3 | posizione indicata dalle storie |
| T2 | 5 | 0 | nessuna | no | 1 file; 0 unit | 5 | 0 | posizione indicata dalle storie |
| T3 | 11 | 33 | con backfill | sì | 20 file; 45 unit | 16 | 9 | posizione indicata dalle storie |
| T4 | 3 | 2 | nessuna | no | 0 file; 0 unit | 0 | 1 | posizione da scoprire |

Difficoltà attesa: T1 < T2 < T3; T4 è di natura diversa. Il controllo di manipolazione stabilirà se il gradiente ha retto. Wiki: citazioni testuali di moduli/funzioni. File unit: chiamate alle funzioni toccate osservate con Profiler Node, un file Vitest per processo sulla baseline. Call site: funzioni applicative esistenti con corpo AST diverso (spazi normalizzati). Moduli: directory di primo e secondo livello sotto src/, prisma/, tests/.
