/* ============================================================
   US-011 — Calendario mensile delle attività (front office)
   Prototipo di sola consultazione e navigazione fra i mesi.
   Locale italiano, settimana che inizia di LUNEDÌ.
   ============================================================ */

/* ---------- Tema chiaro/scuro ---------- */
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

/* ---------- Dati demo: attività della collaboratrice (solo le proprie) ----------
   Data di riferimento del prototipo: oggi = 15 giugno 2026 (coerente con il progetto).
   Le chiavi sono "AAAA-MM-GG". Ogni voce è una riga di consuntivo. */
const OGGI = new Date(2026, 5, 15); // mese 5 = giugno

const ATTIVITA = {
  '2026-06-01': [
    { cliente:'Banca Sella',   offerta:'OFF-2026-014', ore:4,   desc:'Coaching team Pagamenti — sprint review' },
    { cliente:'Banca Sella',   offerta:'OFF-2026-014', ore:2,   desc:'Preparazione retrospettiva' },
  ],
  '2026-06-03': [
    { cliente:'Reale Mutua',   offerta:'OFF-2026-021', ore:7.5, desc:'Workshop Agile leadership' },
  ],
  '2026-06-04': [
    { cliente:'Reale Mutua',   offerta:'OFF-2026-021', ore:3,   desc:'Follow-up individuale capi team' },
    { cliente:'Lavazza',       offerta:'OFF-2026-009', ore:2,   desc:'Call di allineamento product' },
  ],
  '2026-06-09': [
    { cliente:'Lavazza',       offerta:'OFF-2026-009', ore:6,   desc:'Facilitazione PI planning' },
  ],
  '2026-06-10': [
    { cliente:'Lavazza',       offerta:'OFF-2026-009', ore:4,   desc:'Coaching Scrum Master' },
    { cliente:'Banca Sella',   offerta:'OFF-2026-014', ore:1.5, desc:'Allineamento sponsor' },
    { cliente:'Intesa',        offerta:'OFF-2026-030', ore:2,   desc:'Scoping nuova iniziativa' },
  ],
  '2026-06-11': [
    { cliente:'Intesa',        offerta:'OFF-2026-030', ore:7,   desc:'Assessment maturità agile' },
  ],
  '2026-06-12': [
    { cliente:'Intesa',        offerta:'OFF-2026-030', ore:3.5, desc:'Restituzione assessment' },
  ],
  // oggi: giornata in corso, già consuntivata in parte
  '2026-06-15': [
    { cliente:'Reale Mutua',   offerta:'OFF-2026-021', ore:4,   desc:'Coaching team Sinistri' },
    { cliente:'Reale Mutua',   offerta:'OFF-2026-021', ore:1,   desc:'Sync settimanale' },
  ],
  '2026-06-17': [
    { cliente:'Banca Sella',   offerta:'OFF-2026-014', ore:6.5, desc:'Workshop OKR' },
    { cliente:'Lavazza',       offerta:'OFF-2026-009', ore:1,   desc:'Call rapida product owner' },
  ],
  '2026-06-18': [
    { cliente:'Lavazza',       offerta:'OFF-2026-009', ore:8,   desc:'Giornata on-site facilitazione' },
  ],
  '2026-06-23': [
    { cliente:'Intesa',        offerta:'OFF-2026-030', ore:5,   desc:'Coaching wave 2' },
    { cliente:'Intesa',        offerta:'OFF-2026-030', ore:2,   desc:'Preparazione materiali' },
  ],
  // esempio nel mese PRECEDENTE, per mostrare che la navigazione popola altri mesi
  '2026-05-27': [
    { cliente:'Banca Sella',   offerta:'OFF-2026-014', ore:7,   desc:'Avvio percorso coaching' },
  ],
  '2026-05-28': [
    { cliente:'Banca Sella',   offerta:'OFF-2026-014', ore:3,   desc:'Kick-off team' },
    { cliente:'Lavazza',       offerta:'OFF-2026-009', ore:4,   desc:'Discovery' },
  ],
};

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
              'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const GIORNI_SET = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
const GIORNI_SET_BREVI = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

function chiave(d){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function stessoGiorno(a,b){
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function fmtOre(n){
  // 7.5 -> "7,5", 4 -> "4"
  return (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')).replace(/,0$/,'');
}

/* stato di navigazione */
let meseCorrente = new Date(OGGI.getFullYear(), OGGI.getMonth(), 1);

function render(){
  const anno = meseCorrente.getFullYear();
  const mese = meseCorrente.getMonth();

  document.getElementById('calMonth').innerHTML =
    MESI[mese] + ' <span class="yr">' + anno + '</span>';

  // pulsante "Mese corrente" attivo solo se non siamo già sul mese di oggi
  const suMeseOggi = (anno === OGGI.getFullYear() && mese === OGGI.getMonth());
  document.getElementById('btnOggi').disabled = suMeseOggi;

  // giorno della settimana del 1° (0=lun ... 6=dom)
  const primo = new Date(anno, mese, 1);
  let offset = (primo.getDay() + 6) % 7; // JS: 0=dom -> vogliamo lun=0
  const giorniMese = new Date(anno, mese+1, 0).getDate();
  const giorniMesePrec = new Date(anno, mese, 0).getDate();

  const celle = [];
  // celle del mese precedente per riempire la prima settimana
  for (let i = offset; i > 0; i--){
    celle.push({ d: new Date(anno, mese-1, giorniMesePrec - i + 1), outside:true });
  }
  // giorni del mese
  for (let g = 1; g <= giorniMese; g++){
    celle.push({ d: new Date(anno, mese, g), outside:false });
  }
  // completa l'ultima settimana col mese successivo
  while (celle.length % 7 !== 0){
    const last = celle[celle.length-1].d;
    celle.push({ d: new Date(last.getFullYear(), last.getMonth(), last.getDate()+1), outside:true });
  }

  const ultimaRigaInizio = celle.length - 7;

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  let totRigheMese = 0, totOreMese = 0, totGiorniMese = 0;

  celle.forEach((c, idx) => {
    const k = chiave(c.d);
    const att = ATTIVITA[k] || [];
    const isToday = stessoGiorno(c.d, OGGI);
    const isWeekend = (c.d.getDay() === 0 || c.d.getDay() === 6);

    const cell = document.createElement(att.length && !c.outside ? 'button' : 'div');
    cell.className = 'day';
    if (c.outside) cell.classList.add('outside');
    if (isWeekend) cell.classList.add('weekend');
    if (isToday) cell.classList.add('today');
    if (idx >= ultimaRigaInizio) cell.classList.add('last-row');

    let inner = '<span class="dnum">' + c.d.getDate() + '</span>';

    if (att.length && !c.outside){
      cell.classList.add('has');
      cell.type = 'button';
      cell.setAttribute('data-key', k);

      const ore = att.reduce((s,a)=>s+a.ore, 0);
      const righe = att.length;
      totRigheMese += righe; totOreMese += ore; totGiorniMese += 1;

      // codici offerta unici, max 2 + "+n"
      const codici = [...new Set(att.map(a=>a.offerta))];
      let chips = codici.slice(0,2).map(co => '<span class="code-chip">'+co+'</span>').join('');
      if (codici.length > 2) chips += '<span class="code-more">+'+(codici.length-2)+'</span>';

      inner += '<div class="day-summary">' +
                 '<div class="day-stats">' +
                   '<span class="stat rows"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 6h16M4 12h16M4 18h10"/></svg>' + righe + (righe===1?' riga':' righe') + '</span>' +
                   '<span class="stat hours"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' + fmtOre(ore) + ' h</span>' +
                 '</div>' +
                 '<div class="day-codes">' + chips + '</div>' +
               '</div>';

      cell.addEventListener('click', () => apriDettaglio(c.d, att));
    }

    cell.innerHTML = inner;
    grid.appendChild(cell);
  });

  // riepilogo del mese in toolbar
  const ms = document.getElementById('monthSummary');
  if (totGiorniMese > 0){
    ms.style.display = '';
    ms.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>' +
      '<span><b>' + totGiorniMese + '</b> giorni</span><span class="ms-sep"></span>' +
      '<span><b>' + totRigheMese + '</b> righe</span><span class="ms-sep"></span>' +
      '<span><b>' + fmtOre(totOreMese) + '</b> ore</span>';
  } else {
    ms.style.display = '';
    ms.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>' +
      '<span>Nessuna attività registrata in questo mese</span>';
  }
}

/* ---------- Dettaglio giornata (sola lettura) ---------- */
function apriDettaglio(d, att){
  const ore = att.reduce((s,a)=>s+a.ore, 0);
  document.getElementById('drawerDow').textContent = GIORNI_SET[(d.getDay()+6)%7];
  document.getElementById('drawerDate').textContent = d.getDate() + ' ' + MESI[d.getMonth()] + ' ' + d.getFullYear();
  document.getElementById('drawerRows').textContent = att.length;
  document.getElementById('drawerHours').textContent = fmtOre(ore);

  const body = document.getElementById('drawerActs');
  body.innerHTML = att.map(a =>
    '<div class="act-row">' +
      '<div class="ar-top"><span class="ar-cli">'+a.cliente+'</span><span class="ar-h">'+fmtOre(a.ore)+' h</span></div>' +
      '<div class="ar-meta"><span class="code-chip">'+a.offerta+'</span></div>' +
      '<div class="ar-desc">'+a.desc+'</div>' +
    '</div>'
  ).join('');

  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBackdrop').classList.add('open');
}
function chiudiDettaglio(){
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerBackdrop').classList.remove('open');
}

/* ---------- Navigazione mesi ---------- */
function mesePrec(){ meseCorrente = new Date(meseCorrente.getFullYear(), meseCorrente.getMonth()-1, 1); render(); }
function meseSucc(){ meseCorrente = new Date(meseCorrente.getFullYear(), meseCorrente.getMonth()+1, 1); render(); }
function meseOggi(){ meseCorrente = new Date(OGGI.getFullYear(), OGGI.getMonth(), 1); render(); }

/* ---------- Bind ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // intestazioni giorni settimana
  const wk = document.getElementById('calWeekdays');
  GIORNI_SET_BREVI.forEach((g, i) => {
    const cell = document.createElement('div');
    if (i >= 5) cell.className = 'we';
    cell.textContent = g;
    wk.appendChild(cell);
  });

  document.getElementById('btnPrev').addEventListener('click', mesePrec);
  document.getElementById('btnNext').addEventListener('click', meseSucc);
  document.getElementById('btnOggi').addEventListener('click', meseOggi);
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('drawerClose').addEventListener('click', chiudiDettaglio);
  document.getElementById('drawerBackdrop').addEventListener('click', chiudiDettaglio);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') chiudiDettaglio();
    if (e.key === 'ArrowLeft') mesePrec();
    if (e.key === 'ArrowRight') meseSucc();
  });

  render();
});
