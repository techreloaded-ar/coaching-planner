/* ============================================================
   US-016 — Vista avanzamento offerte con residuo giornate
   Back office · ruolo AMMINISTRATORE.
   Route /amministrazione/avanzamento-offerte
   Prototipo: per ogni offerta previste / erogate / residuo, barra di
   avanzamento, stato visivo di allerta, dettaglio per collaboratore.
   Vista CUMULATIVA (nessuna navigazione mensile). Le giornate erogate
   derivano dalle ore consuntivate: 1 giornata = 8 ore. Tutto è calcolato
   a runtime sui dati correnti — nessun valore precalcolato memorizzato.
   ============================================================ */

/* ---------- Tema chiaro/scuro (coerente con i mockup back office) ---------- */
(function initTheme(){
  const saved = localStorage.getItem('cp-mockup-tema');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
})();
function applyTheme(tema){
  if (tema === 'dark') document.documentElement.setAttribute('data-theme','dark');
  else document.documentElement.removeAttribute('data-theme');
}
function toggleTheme(){
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('cp-mockup-tema', next);
}

/* ---------- Costanti di business ---------- */
const ORE_PER_GIORNATA = 8; // conversione fissa: 1 giornata = 8 ore

/* ---------- Soglia di allerta residuo ---------- */
const SOGLIA_ALLERTA = 0.85; // erogato ≥ 85% del previsto ⇒ "Quasi esaurita"

/* ---------- Formattazione ---------- */
function fmtGiornate(n){
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString('it-IT', { minimumFractionDigits:1, maximumFractionDigits:2 });
}
function fmtGiornateSigned(n){
  const s = fmtGiornate(Math.abs(n));
  if (n > 0) return '+' + s;
  if (n < 0) return '−' + s; // meno tipografico
  return '0';
}
function fmtPct(n){
  return n.toLocaleString('it-IT', { minimumFractionDigits:0, maximumFractionDigits:0 }) + '%';
}
function iniziali(nome){
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase();
}

/* ============================================================
   Dataset demo — offerte con giornate previste (vendute) e attività
   dei collaboratori espresse in ORE consuntivate. Le giornate erogate
   e il residuo sono derivati a runtime.
   ============================================================ */
let OFFERTE = datiDemo();

function datiDemo(){
  return [
    {
      codice: 'OFF-2026-014',
      descrizione: 'Coaching team Pagamenti digitali',
      cliente: 'Banca Sella S.p.A.',
      giornatePreviste: 10,
      collaboratori: [
        { nome:'Marco Bianchi', ruolo:'Coach senior',  ore:52 },
        { nome:'Laura Verdi',   ruolo:'Facilitatrice', ore:40 },
      ],
    },
    {
      codice: 'OFF-2026-009',
      descrizione: 'Facilitazione PI planning trimestrale',
      cliente: 'Lavazza Group S.p.A.',
      giornatePreviste: 8,
      collaboratori: [
        { nome:'Giulia Neri',   ruolo:'Agile coach',   ore:40 },
        { nome:'Marco Bianchi', ruolo:'Coach senior',  ore:24 },
      ],
    },
    {
      codice: 'OFF-2026-021',
      descrizione: 'Percorso Agile leadership 2026',
      cliente: 'Reale Mutua Assicurazioni S.p.A.',
      giornatePreviste: 20,
      collaboratori: [
        { nome:'Andrea Colombo', ruolo:'Lead coach',     ore:80 },
        { nome:'Laura Verdi',    ruolo:'Facilitatrice',  ore:40 },
        { nome:'Giulia Neri',    ruolo:'Agile coach',    ore:24 },
      ],
    },
    {
      codice: 'OFF-2026-024',
      descrizione: 'Coaching individuale dirigenti',
      cliente: 'Reale Mutua Assicurazioni S.p.A.',
      giornatePreviste: 12,
      collaboratori: [
        { nome:'Andrea Colombo', ruolo:'Lead coach',    ore:60 },
        { nome:'Marco Bianchi',  ruolo:'Coach senior',  ore:24 },
      ],
    },
    {
      codice: 'OFF-2026-031',
      descrizione: 'Percorso team leadership area Reti',
      cliente: 'Iren S.p.A.',
      giornatePreviste: 15,
      collaboratori: [
        { nome:'Giulia Neri',    ruolo:'Agile coach', ore:32 },
        { nome:'Andrea Colombo', ruolo:'Lead coach',  ore:16 },
      ],
    },
    {
      codice: 'OFF-2026-011',
      descrizione: 'Workshop OKR trimestrale',
      cliente: 'Lavazza Group S.p.A.',
      giornatePreviste: 6,
      collaboratori: [
        { nome:'Laura Verdi', ruolo:'Facilitatrice', ore:8 },
      ],
    },
  ];
}

/* ============================================================
   Calcolo (sempre a runtime, sul dato corrente)
   ============================================================ */
function calcolaOfferta(o){
  const collaboratori = o.collaboratori.map(c => ({
    ...c,
    giornate: c.ore / ORE_PER_GIORNATA,
  }));
  const giornateErogate = collaboratori.reduce((s, c) => s + c.giornate, 0);
  const residuo = o.giornatePreviste - giornateErogate;
  const perc = o.giornatePreviste > 0 ? giornateErogate / o.giornatePreviste : 0;

  let stato;             // 'ok' | 'warning' | 'danger'
  if (residuo < 0)          stato = 'danger';   // oltre budget
  else if (residuo === 0)   stato = 'danger';   // esaurita
  else if (perc >= SOGLIA_ALLERTA) stato = 'warning'; // quasi esaurita
  else                      stato = 'ok';       // in corso

  const etichettaStato =
    residuo < 0  ? 'Oltre budget' :
    residuo === 0 ? 'Esaurita' :
    perc >= SOGLIA_ALLERTA ? 'Quasi esaurita' : 'In corso';

  return { ...o, collaboratori, giornateErogate, residuo, perc, stato, etichettaStato };
}

/* Ordina per criticità: percentuale di utilizzo decrescente
   (le più vicine all'esaurimento / oltre budget in cima). */
function calcolaTutte(){
  return OFFERTE.map(calcolaOfferta).sort((a, b) => b.perc - a.perc);
}

/* ============================================================
   Render
   ============================================================ */
const ICON = {
  ok:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 6 9 17l-5-5"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
  danger:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>',
};
const STATO_CLASSE = { ok:'', warning:'is-warning', danger:'is-danger' };
const BADGE_CLASSE  = { ok:'s-ok', warning:'s-soon', danger:'s-err' };

function renderCollaboratori(o){
  const righe = o.collaboratori
    .slice()
    .sort((a, b) => b.giornate - a.giornate)
    .map(c => {
      const quota = o.giornateErogate > 0 ? (c.giornate / o.giornateErogate) * 100 : 0;
      return '' +
      '<tr>' +
        '<td class="left">' +
          '<div class="collab-cell">' +
            '<span class="collab-ava">' + iniziali(c.nome) + '</span>' +
            '<span class="cc-nm"><b>' + c.nome + '</b><span>' + c.ruolo + '</span></span>' +
          '</div>' +
        '</td>' +
        '<td class="num-hours">' + fmtGiornate(c.ore) + ' h</td>' +
        '<td class="num-days">' + fmtGiornate(c.giornate) + ' gg</td>' +
        '<td class="num-quota">' + fmtPct(quota) + '</td>' +
      '</tr>';
    }).join('');

  return '' +
  '<div class="collab-block">' +
    '<div class="collab-head">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="9" cy="8" r="3.2"/><path d="M2.8 19a6.2 6.2 0 0 1 12.4 0"/><circle cx="17.2" cy="9.2" r="2.4"/><path d="M15.5 14.3a5 5 0 0 1 5.7 4.7"/></svg>' +
      'Giornate erogate per collaboratore' +
    '</div>' +
    '<table class="collab-table">' +
      '<thead><tr>' +
        '<th class="left">Collaboratore</th>' +
        '<th>Ore consuntivate</th>' +
        '<th>Giornate erogate</th>' +
        '<th>Quota</th>' +
      '</tr></thead>' +
      '<tbody>' + righe + '</tbody>' +
    '</table>' +
  '</div>';
}

function renderOfferta(o){
  const cls = STATO_CLASSE[o.stato];
  const pctVis = Math.min(o.perc * 100, 100);         // riempimento visibile (max 100%)
  const pctReale = Math.round(o.perc * 100);          // percentuale reale (può superare 100)
  const oltre = o.residuo < 0;

  // tacca del 100% quando la barra non è satura (offerte in corso / in allerta)
  const mark100 = (!oltre && o.perc < 1)
    ? '<span class="mark-100" style="left:calc(100% - 1px);"></span>'
    : '';

  const overFlag = oltre
    ? '<span class="over-flag">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12l7-7 7 7"/></svg>' +
        fmtGiornateSigned(o.residuo) + ' gg oltre il venduto</span>'
    : '<span>Budget venduto: ' + fmtGiornate(o.giornatePreviste) + ' gg</span>';

  const residuoTxt = oltre ? fmtGiornateSigned(o.residuo) : fmtGiornate(o.residuo);

  return '' +
  '<div class="offer-card ' + cls + '" data-stato="' + o.stato + '">' +

    '<div class="oc-head">' +
      '<div class="oc-ident">' +
        '<div class="oc-logo">' + ICON_LOGO + '</div>' +
        '<div class="oc-name">' +
          '<span class="oc-code">' + o.codice + '</span>' +
          '<b>' + o.descrizione + '</b>' +
          '<span class="client">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 21V8.5L9 4l6 4.5V21"/><path d="M15 21h6V11l-6-3"/></svg>' +
            o.cliente +
          '</span>' +
        '</div>' +
      '</div>' +
      '<span class="status-badge ' + BADGE_CLASSE[o.stato] + '">' + ICON[o.stato] + o.etichettaStato + '</span>' +
    '</div>' +

    '<div class="oc-body">' +
      '<div class="kpi-grid">' +
        '<div class="kpi">' +
          '<span class="k-label">Previste</span>' +
          '<span class="k-val">' + fmtGiornate(o.giornatePreviste) + '<span class="k-unit">gg</span></span>' +
        '</div>' +
        '<div class="kpi">' +
          '<span class="k-label">Erogate</span>' +
          '<span class="k-val">' + fmtGiornate(o.giornateErogate) + '<span class="k-unit">gg</span></span>' +
          '<span class="k-sub">' + fmtGiornate(o.giornateErogate * ORE_PER_GIORNATA) + ' ore</span>' +
        '</div>' +
        '<div class="kpi k-residuo">' +
          '<span class="k-label">Residuo</span>' +
          '<span class="k-val">' + residuoTxt + '<span class="k-unit">gg</span></span>' +
          '<span class="k-sub">' + (oltre ? 'oltre il venduto' : (o.residuo === 0 ? 'nessun giorno' : 'ancora disponibili')) + '</span>' +
        '</div>' +
      '</div>' +

      '<div class="progress-block">' +
        '<div class="progress-meta">' +
          '<span class="pm-label">Avanzamento erogato sul previsto</span>' +
          '<span class="pm-pct">' + pctReale + '%</span>' +
        '</div>' +
        '<div class="progress-track">' +
          '<div class="progress-fill" style="width:' + pctVis + '%"></div>' +
          mark100 +
        '</div>' +
        '<div class="progress-foot">' +
          '<span>' + fmtGiornate(o.giornateErogate) + ' di ' + fmtGiornate(o.giornatePreviste) + ' gg erogate</span>' +
          overFlag +
        '</div>' +
      '</div>' +
    '</div>' +

    renderCollaboratori(o) +
  '</div>';
}

const ICON_LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:18px;height:18px;stroke-width:1.9;"><path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>';

function renderPortfolio(offerte){
  const previsteTot = offerte.reduce((s, o) => s + o.giornatePreviste, 0);
  const erogateTot  = offerte.reduce((s, o) => s + o.giornateErogate, 0);
  const residuoTot  = previsteTot - erogateTot;
  const neg = residuoTot < 0;

  return '' +
  '<div class="portfolio">' +
    '<div class="pf-head">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 20V10M10 20V4M16 20v-7M4 20h16"/></svg>' +
      'Riepilogo del portafoglio offerte' +
    '</div>' +
    '<div class="pf-row">' +
      '<div class="pf-breakdown">' +
        '<div class="pf-item">' +
          '<div class="pi-label">Giornate previste</div>' +
          '<div class="pi-val">' + fmtGiornate(previsteTot) + ' gg</div>' +
        '</div>' +
        '<div class="pf-item">' +
          '<div class="pi-label">Giornate erogate</div>' +
          '<div class="pi-val">' + fmtGiornate(erogateTot) + ' gg</div>' +
        '</div>' +
      '</div>' +
      '<div class="pf-total">' +
        '<div class="pfl">Residuo complessivo</div>' +
        '<div class="pfv' + (neg ? ' neg' : '') + '">' + (neg ? fmtGiornateSigned(residuoTot) : fmtGiornate(residuoTot)) + ' gg</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/* ---------- Stato UI: filtro attivo ---------- */
let filtro = 'all'; // 'all' | 'ok' | 'warning' | 'danger'

function renderAll(){
  const tutte = calcolaTutte();
  const lista = document.getElementById('offersList');
  const pfMount = document.getElementById('portfolioMount');
  const empty = document.getElementById('emptyState');

  // conteggi per filtro
  const nDanger = tutte.filter(o => o.stato === 'danger').length;
  const nWarn   = tutte.filter(o => o.stato === 'warning').length;
  const nOk     = tutte.filter(o => o.stato === 'ok').length;
  const residuoTot = tutte.reduce((s, o) => s + o.residuo, 0);

  document.getElementById('cntAll').textContent = tutte.length;
  document.getElementById('cntDanger').textContent = nDanger;
  document.getElementById('cntWarning').textContent = nWarn;
  document.getElementById('cntOk').textContent = nOk;

  // pill di riepilogo (rossa se ci sono offerte critiche)
  const pill = document.getElementById('summaryPill');
  document.getElementById('pillOffers').textContent = tutte.length;
  document.getElementById('pillResiduo').textContent = fmtGiornate(residuoTot);
  document.getElementById('pillCritiche').textContent = nDanger;
  pill.classList.toggle('is-alert', nDanger > 0);
  pill.hidden = tutte.length === 0;

  if (!tutte.length){
    lista.innerHTML = '';
    pfMount.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const visibili = filtro === 'all' ? tutte : tutte.filter(o => o.stato === filtro);
  lista.innerHTML = visibili.map(renderOfferta).join('');
  pfMount.innerHTML = renderPortfolio(tutte); // il riepilogo resta sul totale
}

/* ---------- Bind filtro ---------- */
function setFiltro(f, botoni){
  filtro = f;
  botoni.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === f)));
  renderAll();
}

/* ---------- Demo: alterna vista popolata / stato vuoto ---------- */
let vuoto = false;
function toggleEmpty(btn){
  vuoto = !vuoto;
  OFFERTE = vuoto ? [] : datiDemo();
  btn.innerHTML = vuoto
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 3v6h6"/></svg> Ripristina dati'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg> Svuota dati';
  renderAll();
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  const botoni = Array.from(document.querySelectorAll('.filter-seg button'));
  botoni.forEach(b => b.addEventListener('click', () => setFiltro(b.dataset.filter, botoni)));

  document.getElementById('btnToggleEmpty')
    .addEventListener('click', (e) => toggleEmpty(e.currentTarget));

  renderAll();
});
