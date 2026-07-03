/* ============================================================
   US-015 — Report mensile degli importi da fatturare per cliente
   Back office · ruolo AMMINISTRATORE.
   Route /amministrazione/report-fatturazione?mese=YYYY-MM
   Prototipo: navigazione mese, schede per cliente con dettaglio
   per offerta, rimborsi trasferta ribaltati, totale complessivo,
   stato vuoto. Il report ricalcola sempre i dati correnti.
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

/* ---------- Formattazione ---------- */
const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

function fmtEur(n){
  return '€ ' + n.toLocaleString('it-IT', { minimumFractionDigits:2, maximumFractionDigits:2 });
}
function fmtGiornate(n){
  /* interi senza decimali, altrimenti fino a 2 decimali con virgola */
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString('it-IT', { minimumFractionDigits:1, maximumFractionDigits:2 });
}
function chiaveMese(y, m){ return y + '-' + String(m + 1).padStart(2, '0'); }

/* ============================================================
   Dataset demo — importi da fatturare per mese.
   Ogni offerta porta: codice, descrizione, tariffa giornaliera,
   giornate fatturabili erogate. L'imponibile e i totali sono
   calcolati a runtime (nessun valore precalcolato memorizzato).
   ============================================================ */
const REPORT_PER_MESE = {
  '2026-06': [
    {
      ragioneSociale: 'Reale Mutua Assicurazioni S.p.A.',
      partitaIva: '00875360018',
      offerte: [
        { codice:'OFF-2026-021', desc:'Percorso Agile leadership 2026',   tariffaGiornaliera:900, giornateFatturabili:4 },
        { codice:'OFF-2026-024', desc:'Coaching individuale dirigenti',    tariffaGiornaliera:1100, giornateFatturabili:1.5 },
      ],
      rimborsiTrasferta: 170,
    },
    {
      ragioneSociale: 'Banca Sella S.p.A.',
      partitaIva: '02224410023',
      offerte: [
        { codice:'OFF-2026-014', desc:'Coaching team Pagamenti digitali',  tariffaGiornaliera:850, giornateFatturabili:5 },
      ],
      rimborsiTrasferta: 85,
    },
    {
      ragioneSociale: 'Lavazza Group S.p.A.',
      partitaIva: '00470550013',
      offerte: [
        { codice:'OFF-2026-009', desc:'Facilitazione PI planning',          tariffaGiornaliera:1000, giornateFatturabili:3 },
        { codice:'OFF-2026-011', desc:'Workshop OKR trimestrale',           tariffaGiornaliera:950, giornateFatturabili:2 },
      ],
      rimborsiTrasferta: 240,
    },
    {
      ragioneSociale: 'Iren S.p.A.',
      partitaIva: '07129470014',
      offerte: [
        { codice:'OFF-2026-031', desc:'Percorso team leadership area Reti', tariffaGiornaliera:800, giornateFatturabili:0.5 },
      ],
      rimborsiTrasferta: 0,
    },
  ],
  '2026-05': [
    {
      ragioneSociale: 'Reale Mutua Assicurazioni S.p.A.',
      partitaIva: '00875360018',
      offerte: [
        { codice:'OFF-2026-021', desc:'Percorso Agile leadership 2026',   tariffaGiornaliera:900, giornateFatturabili:6 },
      ],
      rimborsiTrasferta: 340,
    },
    {
      ragioneSociale: 'Lavazza Group S.p.A.',
      partitaIva: '00470550013',
      offerte: [
        { codice:'OFF-2026-009', desc:'Facilitazione PI planning',          tariffaGiornaliera:1000, giornateFatturabili:2 },
      ],
      rimborsiTrasferta: 0,
    },
  ],
  // Gli altri mesi non hanno attività → stato vuoto
};

/* ---------- Stato: mese corrente visualizzato ---------- */
let mese = { y:2026, m:5 }; // 0-indexed: 5 = Giugno 2026

/* ============================================================
   Calcolo (sempre a runtime, sul dato corrente)
   ============================================================ */
function calcolaCliente(cliente){
  const offerte = cliente.offerte.map(o => ({
    ...o,
    imponibile: o.giornateFatturabili * o.tariffaGiornaliera,
  }));
  const imponibileManodopera = offerte.reduce((s, o) => s + o.imponibile, 0);
  const totale = imponibileManodopera + cliente.rimborsiTrasferta;
  const giornate = offerte.reduce((s, o) => s + o.giornateFatturabili, 0);
  return { ...cliente, offerte, imponibileManodopera, totale, giornate };
}

function calcolaReport(){
  const chiave = chiaveMese(mese.y, mese.m);
  const clientiRaw = REPORT_PER_MESE[chiave] || [];
  const clienti = clientiRaw.map(calcolaCliente);
  const imponibileTot = clienti.reduce((s, c) => s + c.imponibileManodopera, 0);
  const rimborsiTot = clienti.reduce((s, c) => s + c.rimborsiTrasferta, 0);
  const totaleTot = imponibileTot + rimborsiTot;
  const giornateTot = clienti.reduce((s, c) => s + c.giornate, 0);
  return { clienti, imponibileTot, rimborsiTot, totaleTot, giornateTot };
}

/* ============================================================
   Render
   ============================================================ */
function iniziali(ragioneSociale){
  const parole = ragioneSociale.replace(/S\.p\.A\.|S\.r\.l\.|Group/gi, '').trim().split(/\s+/);
  return (parole[0]?.[0] || '') + (parole[1]?.[0] || '');
}

function renderCliente(c){
  const righeOfferte = c.offerte.map(o =>
    '<tr>' +
      '<td class="left">' +
        '<div class="off-cell">' +
          '<span class="code-chip">' + o.codice + '</span>' +
          '<span class="off-desc">' + o.desc + '</span>' +
        '</div>' +
      '</td>' +
      '<td class="num-muted">' + fmtEur(o.tariffaGiornaliera) + '</td>' +
      '<td class="num-days">' + fmtGiornate(o.giornateFatturabili) + '</td>' +
      '<td class="num-imp">' + fmtEur(o.imponibile) + '</td>' +
    '</tr>'
  ).join('');

  return '' +
  '<div class="client-card">' +
    '<div class="cc-head">' +
      '<div class="cc-ident">' +
        '<div class="cc-logo">' + iniziali(c.ragioneSociale).toUpperCase() + '</div>' +
        '<div class="cc-name">' +
          '<b>' + c.ragioneSociale + '</b>' +
          '<span>P. IVA ' + c.partitaIva + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="cc-amount">' +
        '<span class="lbl">Da fatturare</span>' +
        '<span class="val">' + fmtEur(c.totale) + '</span>' +
      '</div>' +
    '</div>' +

    '<table class="cc-table">' +
      '<thead><tr>' +
        '<th class="left">Offerta</th>' +
        '<th>Tariffa giornaliera</th>' +
        '<th>Giornate fatturabili</th>' +
        '<th>Imponibile</th>' +
      '</tr></thead>' +
      '<tbody>' + righeOfferte + '</tbody>' +
    '</table>' +

    '<div class="cc-refunds">' +
      '<div class="rf-label">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 17h12l1.5-5.5A2 2 0 0 0 17.6 9H6.4a2 2 0 0 0-1.9 2.5L6 17Z"/><path d="M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM17 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/></svg>' +
        '<span>Rimborsi trasferta ribaltati</span>' +
        (c.rimborsiTrasferta > 0 ? '' : '<span class="rf-note">nessuna trasferta nel mese</span>') +
      '</div>' +
      '<span class="rf-val">' + fmtEur(c.rimborsiTrasferta) + '</span>' +
    '</div>' +

    '<div class="cc-total">' +
      '<span class="tt-label">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 14l2 2 4-4"/></svg>' +
        'Totale da fatturare' +
      '</span>' +
      '<span class="tt-val">' + fmtEur(c.totale) + '</span>' +
    '</div>' +
  '</div>';
}

function renderGrandTotal(r){
  return '' +
  '<div class="grand-total">' +
    '<div class="gt-head">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 3v18h18"/><path d="M18.5 8.5 13 14l-3-3-4 4"/></svg>' +
      'Totale complessivo del mese' +
    '</div>' +
    '<div class="gt-row">' +
      '<div class="gt-breakdown">' +
        '<div class="gt-item">' +
          '<div class="gi-label">Imponibile manodopera</div>' +
          '<div class="gi-val">' + fmtEur(r.imponibileTot) + '</div>' +
        '</div>' +
        '<div class="gt-item">' +
          '<div class="gi-label">Totale rimborsi trasferta</div>' +
          '<div class="gi-val">' + fmtEur(r.rimborsiTot) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="gt-total">' +
        '<div class="gtl">Importo totale da fatturare</div>' +
        '<div class="gtv">' + fmtEur(r.totaleTot) + '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function renderAll(){
  const r = calcolaReport();
  const lista = document.getElementById('clientsList');
  const gtMount = document.getElementById('grandTotalMount');
  const empty = document.getElementById('emptyState');

  if (!r.clienti.length){
    lista.innerHTML = '';
    gtMount.innerHTML = '';
    empty.hidden = false;
  } else {
    empty.hidden = true;
    lista.innerHTML = r.clienti.map(renderCliente).join('');
    gtMount.innerHTML = renderGrandTotal(r);
  }

  // pill riepilogo del mese
  document.getElementById('pillClients').textContent = r.clienti.length;
  document.getElementById('pillDays').textContent = fmtGiornate(r.giornateTot);
}

/* ---------- Navigazione mese ---------- */
function renderMonthLabel(){
  document.getElementById('monthLabel').innerHTML =
    '<span class="m">' + MESI[mese.m] + '</span> <span class="yr">' + mese.y + '</span>';
}
function mesePrec(){
  mese.m--; if (mese.m < 0){ mese.m = 11; mese.y--; }
  renderMonthLabel(); renderAll();
}
function meseSucc(){
  mese.m++; if (mese.m > 11){ mese.m = 0; mese.y++; }
  renderMonthLabel(); renderAll();
}
function meseOggi(){
  const now = new Date();
  mese = { y: now.getFullYear(), m: now.getMonth() };
  renderMonthLabel(); renderAll();
}

/* ---------- Bind ---------- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('btnPrev').addEventListener('click', mesePrec);
  document.getElementById('btnNext').addEventListener('click', meseSucc);
  document.getElementById('btnOggi').addEventListener('click', meseOggi);

  renderMonthLabel();
  renderAll();
});
