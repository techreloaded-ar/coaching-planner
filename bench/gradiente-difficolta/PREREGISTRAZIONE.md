# H3 · Preregistrazione, 22 ottobre 2026

 (da scrivere nell'indice prima di lanciare)

**Contesto.** Nei report 0a–0c il percorso completo costa da 3 a 9 volte il diretto senza guadagno misurabile, ma tutti i compiti erano funzionalità CRUD su una codebase già piena delle convenzioni di ARchetipo, e tutte le consegne stavano tra 88 e 90 con il tetto fissato dal chiarimento. Il dato di Luna in RideAtlas (60 → 77 con la sola spec) è l'unico in cui l'harness fa differenza, e lì il guadagno viene dalla spec, non da plan e implement.

**Ipotesi H3.** Il vantaggio di plan → implement → review sul diretto, a storie uguali, cresce con la difficoltà del compito: nullo sui compiti locali, misurabile su quelli trasversali e con migrazione di dati.

**Metriche di decisione.** Per ogni compito T1–T4 e per ogni modello: Δ = mediana(completo) − mediana(diretto) sul punteggio funzionale (§2.1 dell'indice) e sul punteggio tecnico (§2.2), con intervallo bootstrap al 95 % sulle repliche; il pavimento di rumore è la deviazione standard pooled fissata dal report 1 (se il report 1 l'ha misurata solo su un compito, scrivilo come limite).

**Soglie, scritte prima.**

- **H3 confermata**: su T3 e T4 Δ funzionale ≥ 2 SD pooled con intervallo sopra zero per almeno un modello, e su T1 Δ entro il rumore. Conseguenza: l'harness a valle della spec va reso adattivo alla difficoltà, non eliminato.
- **H3 respinta**: Δ entro il rumore su tutti e quattro i compiti per entrambi i modelli. Conseguenza: plan e implement non si giustificano a nessuna delle difficoltà provate; resta aperto solo il valore della review come rete di sicurezza (vedi §6, cosa ha intercettato).
- **Esito ambiguo**: Δ sopra il rumore solo sul tecnico, o solo per un modello, o non monotono nella difficoltà. Si riporta così, senza forzare la lettura.
- **Controllo di manipolazione** (obbligatorio, prima di leggere Δ): la mediana di «Sonnet diretto» deve decrescere da T1 a T4 di almeno 2 SD pooled tra T1 e T4. Se non decresce, il gradiente di difficoltà non ha funzionato e H3 non è verificabile con questi compiti: il report lo dice in «Cosa emerge» e le conclusioni si limitano al confronto per compito.

**Secondarie, dichiarate ma non decisive**: costo per punto funzionale per compito e cella; cicli di rework per compito; cosa ha intercettato la review (per compito); dimensione del diff rispetto alla soluzione di riferimento; punteggio tecnico per compito.

---



Baseline main: `157ea55367ec940b464d9ad2c64789b73535b463`. SD pooled 0,775; soglia 1,550 punti, da un solo compito (chiusura mese). Variante baseline V0: il report 6 dichiara V1 adottabile, ma non ne registra l’adozione e la skill installata è baseline. Il fallback V0 è quello richiesto dal prompt in assenza di adozione. Emendamento del 23 ottobre, prima di qualsiasi chiarimento e prova sperimentale; la prima registrazione aveva indicato V1 interpretando erroneamente «adottabile» come «adottata». Riferimenti e oracoli non usano le skill ARchetipo e non sono influenzati.

Le condizioni di conferma e ambiguità si sovrappongono per un solo modello: si riporterà la condizione di conferma letterale e, insieme, il limite della mancata replica sul secondo modello senza cambiarne le soglie.


## Applicabilità della dimensione tecnica · 23 ottobre, prima delle prove

Quando la mediana delle righe nette src della coorte è non positiva, la dimensione tecnica usa righe aggiunte + eliminate src e la mediana della stessa misura. Peso 20, soglie mediana/2×mediana e formula lineare invariati. Altrimenti resta sulle righe nette. Vale per qualsiasi coorte, non soltanto T4; i confronti e i report dichiarano la misura. Le 40 consegne storiche hanno coorti con mediana netta positiva, quindi i punteggi non cambiano. La prima proposta di limitarsi a segnalare il problema senza adattamento è sostituita da questa regola prima di osservare risultati sperimentali.
