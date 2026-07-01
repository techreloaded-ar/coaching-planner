/* ============================================================
   US-014 — Riepilogo mensile del collaboratore con importo fattura
   Route /attivita/riepilogo?mese=YYYY-MM
   Prototipo interattivo: navigazione mese, schede riepilogo,
   tabella per-offerta, dimostrazione aggiornamento automatico.
   Riferimento: giugno 2026 — collaboratrice Giulia Conti.
   ============================================================ */

/* ---------- Tema chiaro/scuro (coerente con US-011/012/013) ---------- */
(function initTheme(){
  const saved = localStorage.getItem('cp-theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
})();
function toggleTheme(){
  const el = document.documentElement;
  const next = el.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  el.setAttribute('data-theme', next);
  localStorage.setItem('cp-theme', next);
}

/* ---------- Costanti di business ---------- */
const ORE_PER_GIORNATA = 8;
const TARIFFA_GIORNALIERA = 450; // €

/* ---------- Catalogo demo: offerte attive ---------- */
const OFFERTE = {
  'OFF-2026-021': { codice:'OFF-2026-021', desc:'Percorso Agile leadership 2026', cliente:'Reale Mutua' },
  'OFF-2026-014': { codice:'OFF-2026-014', desc:'Coaching team Pagamenti',       cliente:'Banca Sella' },
  'OFF-2026-009': { codice:'OFF-2026-009', desc:'Facilitazione PI planning',      cliente:'Lavazza' },
};

/* ---------- Dati del mese (demo in memoria) ----------
   Ogni riga: offerta + ore + fatturabile.
   Le trasferte (rimborsi) sono aggregate per offerta. */
let righe = [
  // Reale Mutua — OFF-2026-021
  { offerta:'OFF-2026-021', ore:8,  fatturabile:true },
  { offerta:'OFF-2026-021', ore:8,  fatturabile:true },
  { offerta:'OFF-2026-021', ore:8,  fatturabile:true },
  { offerta:'OFF-2026-021', ore:8,  fatturabile:true },
  { offerta:'OFF-2026-021', ore:4,  fatturabile:false },
  // Banca Sella — OFF-2026-014
  { offerta:'OFF-2026-014', ore:8,  fatturabile:true },
  { offerta:'OFF-2026-014', ore:8,  fatturabile:true },
  { offerta:'OFF-2026-014', ore:8,  fatturabile:true },
  // Lavazza — OFF-2026-009 (non fatturabile)
  { offerta:'OFF-2026-009', ore:8,  fatturabile:false },
];

/* Rimborsi trasferta per offerta (€) — derivano dalle trasferte del mese */
let rimborsi = {
  'OFF-2026-021': 170,   // 2 trasferte
  'OFF-2026-014': 85,    // 1 trasferta
  'OFF-2026-009': 0,
};

/* ---------- Navigazione del mese ---------- */
const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
let meseCorrente = { y:2026, m:5 }; // 0-indexed: 5 = Giugno

/* ---------- Utilità di formattazione ---------- */
function fmtOre(n){
  /* mostra interi senza decimali, altrimenti 1 decimale con virgola */
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1).replace('.', ',');
}
function fmtGiornate(ore){
  const g = ore / ORE_PER_GIORNATA;
  return fmtOre(g);
}
function fmtEur(n){
  return '€ ' + n.toLocaleString('it-IT', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

/* ---------- Aggregazione dati per offerta ---------- */
function aggregaOfferte(){
  const map = {};
  righe.forEach(r => {
    if (!map[r.offerta]) {
      const o = OFFERTE[r.offerta];
      map[r.offerta] = {
        codice: o.codice, desc: o.desc, cliente: o.cliente,
        oreTotali: 0, oreFatturabili: 0, rimborsi: rimborsi[r.offerta] || 0,
      };
    }
    map[r.offerta].oreTotali += r.ore;
    if (r.fatturabile) map[r.offerta].oreFatturabili += r.ore;
  });
  return Object.values(map);
}

/* ---------- Calcolo totali ---------- */
function calcolaTotali(){
  const offerte = aggregaOfferte();
  let oreTot = 0, oreBill = 0, rimborsiTot = 0;
  offerte.forEach(o => {
    oreTot += o.oreTotali;
    oreBill += o.oreFatturabili;
    rimborsiTot += o.rimborsi;
  });
  const giornateTot = oreTot / ORE_PER_GIORNATA;
  const giornateBill = oreBill / ORE_PER_GIORNATA;
  const importoFattura = (giornateBill * TARIFFA_GIORNALIERA) + rimborsiTot;
  return {
    offerte,
    oreTot, giornateTot,
    oreBill, giornateBill,
    rimborsiTot, importoFattura,
    righeCount: righe.length,
  };
}

/* ---------- Render schede riepilogo ---------- */
function renderStats(t){
  const grid = document.getElementById('statGrid');
  const cards = [
    {
      label:'Ore totali', icon:'<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 0v10l4.5 4.5"/>',
      value: fmtOre(t.oreTot), sub: fmtGiornate(t.oreTot) + ' giornate',
    },
    {
      label:'Giornate totali', icon:'<rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M3 9h18M8 2v4M16 2v4"/>',
      value: fmtOre(t.giornateTot), sub: fmtOre(t.oreTot) + ' ore · 1g = 8h',
    },
    {
      label:'Ore fatturabili', icon:'<path d="M20 6 9 17l-5-5"/>',
      value: fmtOre(t.oreBill), sub: fmtGiornate(t.oreBill) + ' giornate',
    },
    {
      label:'Giornate fatturabili', icon:'<rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="M20 6 9 17l-5-5"/>',
      value: fmtOre(t.giornateBill), sub: fmtOre(t.oreBill) + ' ore',
    },
    {
      label:'Totale rimborsi trasferta', icon:'<path d="M6 17h12l1.5-5.5A2 2 0 0 0 17.6 9H6.4a2 2 0 0 0-1.9 2.5L6 17Z"/><path d="M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM17 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>',
      value: fmtEur(t.rimborsiTot), sub: ' Trasferte del mese',
    },
  ];

  let html = cards.map(c =>
    '<div class="stat-card">' +
      '<div class="sc-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">' + c.icon + '</svg>' + c.label + '</div>' +
      '<div class="sc-value">' + c.value + '</div>' +
      '<div class="sc-sub">' + c.sub + '</div>' +
    '</div>'
  ).join('');

  /* Scheda IMPORTO FATTURA in evidenza */
  const onoreFattura = fmtOre(t.giornateBill);
  const compenso = t.giornateBill * TARIFFA_GIORNALIERA;
  html +=
    '<div class="stat-card invoice">' +
      '<div class="sc-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 14l2 2 4-4"/></svg>Importo fattura da emettere</div>' +
      '<div class="invoice-row">' +
        '<div class="sc-value">' + fmtEur(t.importoFattura) + '</div>' +
        '<div class="invoice-breakdown">' +
          '<span class="bd-item"><b>' + onoreFattura + '</b> giornate × <b>' + fmtEur(TARIFFA_GIORNALIERA) + '</b></span>' +
          '<span class="bd-sep"></span>' +
          '<span class="bd-item">Compenso <b>' + fmtEur(compenso) + '</b></span>' +
          '<span class="bd-sep"></span>' +
          '<span class="bd-item">Rimborsi <b>' + fmtEur(t.rimborsiTot) + '</b></span>' +
        '</div>' +
      '</div>' +
    '</div>';

  grid.innerHTML = html;
}

/* ---------- Render tabella per-offerta ---------- */
function renderTable(t){
  const body = document.getElementById('tableBody');

  body.innerHTML = t.offerte.map(o => {
    const giornateTot = o.oreTotali / ORE_PER_GIORNATA;
    const giornateBill = o.oreFatturabili / ORE_PER_GIORNATA;
    const isNoBill = o.oreFatturabili === 0;
    const trClass = isNoBill ? ' class="nobill-row"' : '';

    const billBadge = isNoBill
      ? '<span class="badge nobill">Non fatturabile</span>'
      : '';

    return '<tr' + trClass + '>' +
      '<td class="td-cli">' + o.cliente + '</td>' +
      '<td>' +
        '<div class="td-offer">' +
          '<span class="code-chip">' + o.codice + '</span>' +
          '<span class="off-desc">' + o.desc + '</span>' +
          (billBadge ? '<span style="margin-top:4px">' + billBadge + '</span>' : '') +
        '</div>' +
      '</td>' +
      '<td class="num"><span class="num-val">' + fmtOre(o.oreTotali) + '</span> <span class="num-sub">h</span></td>' +
      '<td class="num"><span class="num-val">' + fmtGiornate(o.oreTotali) + '</span></td>' +
      '<td class="num">' + (o.oreFatturabili > 0
        ? '<span class="num-val">' + fmtOre(o.oreFatturabili) + '</span> <span class="num-sub">h</span>'
        : '<span class="num-val num-zero">—</span>') + '</td>' +
      '<td class="num">' + (giornateBill > 0
        ? '<span class="num-val">' + fmtOre(giornateBill) + '</span>'
        : '<span class="num-val num-zero">—</span>') + '</td>' +
      '<td class="num">' + (o.rimborsi > 0
        ? '<span class="refund-val">' + fmtEur(o.rimborsi) + '</span>'
        : '<span class="num-zero">—</span>') + '</td>' +
    '</tr>';
  }).join('');

  /* Footer totali */
  const foot = document.getElementById('tableFoot');
  foot.innerHTML =
    '<tr>' +
      '<td class="left">Totale</td>' +
      '<td></td>' +
      '<td class="num">' + fmtOre(t.oreTot) + ' h</td>' +
      '<td class="num">' + fmtOre(t.giornateTot) + '</td>' +
      '<td class="num">' + (t.oreBill > 0 ? fmtOre(t.oreBill) + ' h' : '—') + '</td>' +
      '<td class="num">' + (t.giornateBill > 0 ? fmtOre(t.giornateBill) : '—') + '</td>' +
      '<td class="num">' + fmtEur(t.rimborsiTot) + '</td>' +
    '</tr>';

  document.getElementById('offersCount').textContent = t.offerte.length;
}

/* ---------- Render riepilogo mese (toolbar pill) ---------- */
function renderMonthSummary(t){
  document.getElementById('msRows').textContent = t.righeCount;
  document.getElementById('msDays').textContent = fmtOre(t.giornateTot);
}

/* ---------- Render completo ---------- */
function renderAll(){
  const t = calcolaTotali();
  renderStats(t);
  renderTable(t);
  renderMonthSummary(t);
}

/* ---------- Navigazione mese ---------- */
function updateMonthLabel(){
  const label = MESI[meseCorrente.m] + ' ' + meseCorrente.y;
  document.getElementById('calMonth').innerHTML =
    '<span class="m">' + MESI[meseCorrente.m] + '</span> <span class="yr">' + meseCorrente.y + '</span>';
  document.getElementById('summaryTitle').textContent = label;
}
function mesePrec(){
  meseCorrente.m--;
  if (meseCorrente.m < 0){ meseCorrente.m = 11; meseCorrente.y--; }
  updateMonthLabel();
}
function meseSucc(){
  meseCorrente.m++;
  if (meseCorrente.m > 11){ meseCorrente.m = 0; meseCorrente.y++; }
  updateMonthLabel();
}
function meseOggi(){
  const now = new Date();
  meseCorrente = { y: now.getFullYear(), m: now.getMonth() };
  updateMonthLabel();
}

/* ---------- Demo: simula inserimento riga ---------- */
let demoBill = true;
function toggleDemoBill(){
  demoBill = !demoBill;
  document.getElementById('demoToggleBill').textContent = 'Fatturabile: ' + (demoBill ? 'Sì' : 'No');
}

function demoAddRow(){
  const offertaId = document.getElementById('demoOffer').value;
  righe.push({ offerta: offertaId, ore: 4, fatturabile: demoBill });
  renderAll();
}

/* ---------- Bind ---------- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('btnPrev').addEventListener('click', mesePrec);
  document.getElementById('btnNext').addEventListener('click', meseSucc);
  document.getElementById('btnOggi').addEventListener('click', meseOggi);
  document.getElementById('demoToggleBill').addEventListener('click', toggleDemoBill);
  document.getElementById('demoAdd').addEventListener('click', demoAddRow);

  updateMonthLabel();
  renderAll();
});
