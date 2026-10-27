/* ============================================================
   US-017 — Analisi della marginalità per cliente e offerta
   Prototipo: il form GET (?dal=YYYY-MM&al=YYYY-MM) filtra un dataset
   demo di attività; ricavi = giornate fatturabili × tariffa offerta,
   costi = giornate fatturabili × tariffa collaboratore. Rimborsi
   trasferta esclusi. Tutti i totali sono calcolati a runtime.
   ============================================================ */

/* ---------- Selettore tema Chiaro / Scuro / Browser ---------- */
const CHIAVE_TEMA = 'cp-mockup-preferenza-tema';
const mediaScuro = window.matchMedia('(prefers-color-scheme: dark)');

function applicaTema(preferenza){
  const scuro = preferenza === 'scuro' || (preferenza === 'browser' && mediaScuro.matches);
  if (scuro) document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  document.querySelectorAll('[data-tema]').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.tema === preferenza)));
}
const preferenzaTema = () => localStorage.getItem(CHIAVE_TEMA) || 'browser';
applicaTema(preferenzaTema());
mediaScuro.addEventListener('change', () => applicaTema(preferenzaTema()));

document.addEventListener('DOMContentLoaded', () => {
  const pulsante = document.getElementById('pulsanteTema');
  const menu = document.getElementById('menuTema');
  applicaTema(preferenzaTema());
  pulsante.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    pulsante.setAttribute('aria-expanded', String(!menu.hidden));
  });
  menu.addEventListener('click', e => {
    const scelta = e.target.closest('[data-tema]');
    if (!scelta) return;
    localStorage.setItem(CHIAVE_TEMA, scelta.dataset.tema);
    applicaTema(scelta.dataset.tema);
    menu.hidden = true;
    pulsante.setAttribute('aria-expanded', 'false');
  });

  renderReportMarginalita();
});

/* ---------- Formattazione (come formattaEuro reale, it-IT) ---------- */
const formatoEuro = new Intl.NumberFormat('it-IT', { style:'currency', currency:'EUR' });
const formatoGiornate = new Intl.NumberFormat('it-IT', { maximumFractionDigits:1 });
const formatoPercentuale = new Intl.NumberFormat('it-IT', { style:'percent', minimumFractionDigits:1, maximumFractionDigits:1 });
const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];

const euro = n => formatoEuro.format(n);
const percentualeMargine = (margine, ricavi) => ricavi === 0 ? '—' : formatoPercentuale.format(margine / ricavi);
function etichettaMese(token){
  const [anno, mese] = token.split('-').map(Number);
  return MESI[mese - 1] + ' ' + anno;
}
const iniziali = ragioneSociale => ragioneSociale.split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

/* ============================================================
   Dataset demo
   ============================================================ */
const OFFERTE = {
  'OFF-2026-014': { cliente:'Banca Sella S.p.A.',               descrizione:'Coaching team Pagamenti digitali', tariffaGiornaliera:850 },
  'OFF-2026-021': { cliente:'Reale Mutua Assicurazioni S.p.A.', descrizione:'Percorso Agile leadership 2026',   tariffaGiornaliera:900 },
  'OFF-2026-024': { cliente:'Reale Mutua Assicurazioni S.p.A.', descrizione:'Coaching individuale dirigenti',   tariffaGiornaliera:1100 },
  'OFF-2026-009': { cliente:'Lavazza Group S.p.A.',             descrizione:'Facilitazione PI planning',        tariffaGiornaliera:1000 },
  'OFF-2026-011': { cliente:'Lavazza Group S.p.A.',             descrizione:'Workshop OKR trimestrale',         tariffaGiornaliera:600 },
  'OFF-2026-017': { cliente:'Iren S.p.A.',                      descrizione:'Coaching team Smart grid',         tariffaGiornaliera:700 },
  'OFF-2026-018': { cliente:'Iren S.p.A.',                      descrizione:'Retrospettive facilitate',         tariffaGiornaliera:650 },
};

/* tariffa giornaliera di costo dei collaboratori */
const TARIFFE_COLLABORATORI = {
  'Luca Bassi':    520,
  'Sara Valli':    560,
  'Marco Rinaldi': 780,
  'Paolo Gatti':   600,
  'Elena Ferri':   650,
};

/* [mese, offerta, collaboratore, giornate fatturabili (ore / 8)] */
const ATTIVITA = [
  ['2025-12','OFF-2026-014','Luca Bassi',2],   ['2025-12','OFF-2026-009','Paolo Gatti',1],

  ['2026-01','OFF-2026-014','Luca Bassi',4],   ['2026-01','OFF-2026-021','Sara Valli',3],
  ['2026-01','OFF-2026-021','Luca Bassi',1],   ['2026-01','OFF-2026-024','Marco Rinaldi',1.5],
  ['2026-01','OFF-2026-009','Paolo Gatti',2],  ['2026-01','OFF-2026-011','Elena Ferri',1],
  ['2026-01','OFF-2026-017','Marco Rinaldi',2],['2026-01','OFF-2026-018','Paolo Gatti',1],

  ['2026-02','OFF-2026-014','Luca Bassi',3.5], ['2026-02','OFF-2026-021','Sara Valli',2.5],
  ['2026-02','OFF-2026-024','Marco Rinaldi',1],['2026-02','OFF-2026-009','Paolo Gatti',1.5],
  ['2026-02','OFF-2026-011','Elena Ferri',1],  ['2026-02','OFF-2026-017','Marco Rinaldi',2.5],
  ['2026-02','OFF-2026-018','Paolo Gatti',0.5],

  ['2026-03','OFF-2026-014','Luca Bassi',4],   ['2026-03','OFF-2026-021','Sara Valli',3],
  ['2026-03','OFF-2026-021','Luca Bassi',0.5], ['2026-03','OFF-2026-024','Marco Rinaldi',2],
  ['2026-03','OFF-2026-009','Paolo Gatti',2],  ['2026-03','OFF-2026-011','Elena Ferri',0.5],
  ['2026-03','OFF-2026-017','Marco Rinaldi',3],['2026-03','OFF-2026-018','Paolo Gatti',1],

  ['2026-04','OFF-2026-017','Marco Rinaldi',4],
];

/* ---------- Aggregazione per cliente e offerta ---------- */
function calcolaMarginalita(dal, al){
  const clienti = new Map();
  for (const [mese, codice, collaboratore, giornate] of ATTIVITA){
    if (mese < dal || mese > al) continue;
    const offerta = OFFERTE[codice];
    if (!clienti.has(offerta.cliente)) clienti.set(offerta.cliente, new Map());
    const offerteCliente = clienti.get(offerta.cliente);
    if (!offerteCliente.has(codice)) offerteCliente.set(codice, { codice, descrizione:offerta.descrizione, giornate:0, ricavi:0, costi:0 });
    const voce = offerteCliente.get(codice);
    voce.giornate += giornate;
    voce.ricavi += giornate * offerta.tariffaGiornaliera;
    voce.costi += giornate * TARIFFE_COLLABORATORI[collaboratore];
  }
  return [...clienti].map(([ragioneSociale, offerte]) => {
    const perOfferta = [...offerte.values()]
      .map(o => ({ ...o, margine:o.ricavi - o.costi }))
      .sort((a, b) => a.codice.localeCompare(b.codice));
    const somma = campo => perOfferta.reduce((t, o) => t + o[campo], 0);
    const ricavi = somma('ricavi'), costi = somma('costi');
    return { ragioneSociale, perOfferta, giornate:somma('giornate'), ricavi, costi, margine:ricavi - costi };
  }).sort((a, b) => a.ragioneSociale.localeCompare(b.ragioneSociale, 'it'));
}

/* ---------- Frammenti HTML ---------- */
const ICONA_CALO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m3 7 6 6 4-4 8 8"/><path d="M21 11v6h-6"/></svg>';
const badgeMargineNegativo = () => `<span class="badge-neg">${ICONA_CALO}Margine negativo</span>`;

function barraRicaviCosti(ricavi, costi){
  if (ricavi >= costi){
    const quotaCosti = ricavi ? costi / ricavi * 100 : 0;
    return `<div class="mbar" aria-hidden="true">
      <div class="mbar-track"><span class="mbar-cost" style="width:${quotaCosti}%"></span><span class="mbar-margin" style="width:${100 - quotaCosti}%"></span></div>
      <div class="mbar-legend"><span><i class="k-cost"></i>Costi ${formatoPercentuale.format(quotaCosti / 100)} dei ricavi</span><span><i class="k-margin"></i>Margine</span></div>
    </div>`;
  }
  const quotaCoperta = ricavi / costi * 100;
  return `<div class="mbar" aria-hidden="true">
    <div class="mbar-track"><span class="mbar-cost" style="width:${quotaCoperta}%"></span><span class="mbar-loss" style="width:${100 - quotaCoperta}%"></span></div>
    <div class="mbar-legend"><span><i class="k-cost"></i>Costi coperti dai ricavi</span><span><i class="k-loss"></i>Costi eccedenti i ricavi</span></div>
  </div>`;
}

function schedaCliente(c, indice){
  const negativo = c.margine < 0;
  const righe = c.perOfferta.map(o => {
    const neg = o.margine < 0;
    return `<tr class="${neg ? 'neg' : ''}">
      <td class="left"><span class="code-chip">${o.codice}</span></td>
      <td class="left desc-cell">${o.descrizione}</td>
      <td class="strong">${formatoGiornate.format(o.giornate)}</td>
      <td>${euro(o.ricavi)}</td>
      <td>${euro(o.costi)}</td>
      <td><span class="m-cell">${neg ? badgeMargineNegativo() : ''}<span class="${neg ? 'm-neg' : 'm-pos'}">${euro(o.margine)}</span></span></td>
      <td class="${neg ? 'm-neg' : ''}">${percentualeMargine(o.margine, o.ricavi)}</td>
    </tr>`;
  }).join('');

  return `<section class="client-card${negativo ? ' is-negative' : ''}" aria-labelledby="cli-${indice}">
    <div class="cc-head">
      <div class="cc-ident">
        <div class="cc-logo" aria-hidden="true">${iniziali(c.ragioneSociale)}</div>
        <div class="cc-name">
          <b id="cli-${indice}">${c.ragioneSociale}</b>
          <span class="num">${c.perOfferta.length} ${c.perOfferta.length === 1 ? 'offerta' : 'offerte'} · ${formatoGiornate.format(c.giornate)} giornate fatturabili</span>
        </div>
      </div>
      <div class="figures">
        <div class="figure"><span class="lbl">Ricavi</span><span class="val num">${euro(c.ricavi)}</span></div>
        <div class="figure"><span class="lbl">Costi</span><span class="val num">${euro(c.costi)}</span></div>
        <div class="figure margin${negativo ? ' neg' : ''}">
          <span class="lbl">Margine</span><span class="val num">${euro(c.margine)}</span>
          <span class="pct num">${percentualeMargine(c.margine, c.ricavi)} dei ricavi</span>
          ${negativo ? badgeMargineNegativo() : ''}
        </div>
      </div>
    </div>
    ${barraRicaviCosti(c.ricavi, c.costi)}
    <div class="table-wrap">
      <table class="cc-table">
        <caption class="sr-only">Marginalità per offerta di ${c.ragioneSociale}</caption>
        <thead><tr>
          <th class="left" scope="col">Codice</th><th class="left" scope="col">Descrizione</th>
          <th scope="col">Giornate</th><th scope="col">Ricavi</th><th scope="col">Costi</th>
          <th scope="col">Margine</th><th scope="col">Margine %</th>
        </tr></thead>
        <tbody>${righe}</tbody>
      </table>
    </div>
  </section>`;
}

function barraTotali(clienti){
  const ricavi = clienti.reduce((t, c) => t + c.ricavi, 0);
  const costi = clienti.reduce((t, c) => t + c.costi, 0);
  const margine = ricavi - costi, neg = margine < 0;
  return `<section class="totals${neg ? ' neg' : ''}" aria-label="Totali del periodo">
    <div class="t-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7.5 15.5v-4M12 15.5V7.5M16.5 15.5v-6"/></svg>
      <div>Totali del periodo<small>Tutti i clienti e tutte le offerte</small></div>
    </div>
    <div class="t-item"><span class="lbl">Ricavi totali</span><span class="val num">${euro(ricavi)}</span></div>
    <div class="t-item"><span class="lbl">Costi totali</span><span class="val num">${euro(costi)}</span></div>
    <div class="t-item margin${neg ? ' neg' : ''}">
      <span class="lbl">Margine totale</span><span class="val num">${euro(margine)}</span>
      <span class="pct num">${percentualeMargine(margine, ricavi)} dei ricavi</span>
      ${neg ? badgeMargineNegativo() : ''}
    </div>
  </section>`;
}

const STATO_VUOTO = `<div class="empty-state">
  <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7.5 15.5v-4M12 15.5V7.5M16.5 15.5v-6"/></svg></div>
  <h3>Nessuna attività fatturabile nel periodo selezionato.</h3>
  <p>Non risultano ore fatturabili registrate dai collaboratori tra i mesi indicati. Modifica il periodo e premi Applica.</p>
</div>`;

/* ---------- Render ---------- */
function renderReportMarginalita(){
  const form = document.getElementById('formPeriodo');
  const params = new URLSearchParams(location.search);
  let dal = params.get('dal') || form.dal.value;
  let al = params.get('al') || form.al.value;
  if (dal > al) [dal, al] = [al, dal]; // ponytail: inversione silenziosa; il server potrebbe invece mostrare un errore di validazione
  form.dal.value = dal;
  form.al.value = al;

  document.getElementById('etichettaPeriodo').innerHTML =
    'Periodo: <b>' + (dal === al ? etichettaMese(dal) : etichettaMese(dal) + ' – ' + etichettaMese(al)) + '</b>';

  const clienti = calcolaMarginalita(dal, al);
  const mount = document.getElementById('reportMount');
  if (clienti.length === 0){ mount.innerHTML = STATO_VUOTO; return; }

  const offerte = clienti.reduce((t, c) => t + c.perOfferta.length, 0);
  const giornate = clienti.reduce((t, c) => t + c.giornate, 0);
  const inPerdita = clienti.filter(c => c.margine < 0).length;
  mount.innerHTML = `
    <p class="summary-line"><b>${clienti.length}</b> clienti · <b>${offerte}</b> offerte · <b>${formatoGiornate.format(giornate)}</b> giornate fatturabili${inPerdita ? ` · <b>${inPerdita}</b> ${inPerdita === 1 ? 'cliente' : 'clienti'} con margine negativo` : ''}</p>
    <div class="clients">${clienti.map(schedaCliente).join('')}</div>
    ${barraTotali(clienti)}`;
}
