/* ============================================================
   US-012 — Inserimento delle righe di attività giornaliere
   Schermata di dettaglio di una giornata (route /attivita/[data]).
   Prototipo interattivo: aggiunta, modifica, eliminazione righe,
   select offerta dipendente dal cliente, validazione ore.
   Riferimento: lunedì 15 giugno 2026 — collaboratrice Giulia Conti.
   ============================================================ */

/* ---------- Tema chiaro/scuro (coerente con US-011) ---------- */
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

/* ---------- Catalogo demo: SOLO clienti e offerte ATTIVI ----------
   Le offerte sono dipendenti dal cliente scelto. */
const CLIENTI = {
  reale:   { nome:'Reale Mutua',     offerte:[
    { id:'OFF-2026-021', desc:'Percorso Agile leadership 2026' },
    { id:'OFF-2026-024', desc:'Coaching team Sinistri' },
  ]},
  sella:   { nome:'Banca Sella',     offerte:[
    { id:'OFF-2026-014', desc:'Coaching team Pagamenti' },
    { id:'OFF-2026-018', desc:'Workshop OKR' },
  ]},
  lavazza: { nome:'Lavazza',         offerte:[
    { id:'OFF-2026-009', desc:'Facilitazione PI planning' },
  ]},
  intesa:  { nome:'Intesa Sanpaolo', offerte:[
    { id:'OFF-2026-030', desc:'Assessment maturità agile' },
    { id:'OFF-2026-031', desc:'Coaching wave 2' },
  ]},
};

/* ---------- Stato delle righe della giornata (demo in memoria) ---------- */
let righe = [
  { id:1, clienteKey:'reale', cliente:'Reale Mutua', offerta:'OFF-2026-021',
    offertaDesc:'Percorso Agile leadership 2026', ore:4, fatturabile:true,
    nota:'Coaching team Sinistri — facilitazione retrospettiva e definizione action item.' },
  { id:2, clienteKey:'reale', cliente:'Reale Mutua', offerta:'OFF-2026-021',
    offertaDesc:'Percorso Agile leadership 2026', ore:1, fatturabile:false, nota:'' },
];
let prossimoId = 3;
let inModifica = null; // id della riga in modifica, oppure null

/* ---------- Utilità ---------- */
function fmtOre(n){
  return (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/,'')).replace('.', ',');
}
/* "3,5" / "3.5" -> 3.5 ; ritorna NaN se non valido */
function parseOre(raw){
  const s = String(raw).trim().replace(',', '.');
  if (s === '') return NaN;
  if (!/^\d*\.?\d+$/.test(s)) return NaN;
  return parseFloat(s);
}

/* ---------- Render dell'elenco righe + riepilogo ---------- */
function renderRighe(){
  const list = document.getElementById('rowsList');
  list.innerHTML = '';

  if (righe.length === 0){
    list.innerHTML =
      '<div class="empty-rows">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 6h16M4 12h16M4 18h10"/></svg>' +
        '<div>Nessuna riga registrata per questa giornata. Aggiungi la prima qui sotto.</div>' +
      '</div>';
  } else {
    righe.forEach(r => list.appendChild(cardRiga(r)));
  }

  document.getElementById('rowsCount').textContent = righe.length;

  const oreTot  = righe.reduce((s,r)=>s+r.ore, 0);
  const oreBill = righe.filter(r=>r.fatturabile).reduce((s,r)=>s+r.ore, 0);
  document.getElementById('sumRows').textContent  = righe.length;
  document.getElementById('sumHours').textContent = fmtOre(oreTot);
  document.getElementById('sumBill').textContent  = fmtOre(oreBill);
}

function cardRiga(r){
  const el = document.createElement('article');
  el.className = 'row-card' + (inModifica === r.id ? ' editing' : '');
  el.dataset.row = r.id;

  const badge = r.fatturabile
    ? '<span class="badge bill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 6 9 17l-5-5"/></svg>Fatturabile</span>'
    : '<span class="badge nobill">Non fatturabile</span>';

  const nota = r.nota
    ? '<div class="row-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><span>'+r.nota+'</span></div>'
    : '';

  el.innerHTML =
    '<div class="row-main">' +
      '<div class="row-top"><span class="row-cli">'+r.cliente+'</span>'+badge+'</div>' +
      '<div class="row-offer"><span class="code-chip">'+r.offerta+'</span><span>'+r.offertaDesc+'</span></div>' +
      nota +
    '</div>' +
    '<div class="row-side">' +
      '<div class="row-hours">'+fmtOre(r.ore)+' <small>h</small></div>' +
      '<div class="row-actions">' +
        '<button class="btn btn-ghost btn-sm" type="button" data-edit="'+r.id+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>Modifica</button>' +
        '<button class="btn btn-danger-ghost btn-icon" type="button" aria-label="Elimina riga" title="Elimina riga" data-del="'+r.id+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>' +
      '</div>' +
    '</div>';

  el.querySelector('[data-edit]').addEventListener('click', () => avviaModifica(r.id));
  el.querySelector('[data-del]').addEventListener('click', () => eliminaRiga(r.id));
  return el;
}

/* ---------- Select offerta dipendente dal cliente ---------- */
function popolaOfferte(clienteKey, selezionata){
  const sel = document.getElementById('fOfferta');
  sel.innerHTML = '';
  if (!clienteKey || !CLIENTI[clienteKey]){
    sel.disabled = true;
    sel.innerHTML = '<option value="" selected disabled>Scegli prima il cliente…</option>';
    return;
  }
  sel.disabled = false;
  const ph = document.createElement('option');
  ph.value = ''; ph.disabled = true; ph.textContent = 'Seleziona un\'offerta…';
  if (!selezionata) ph.selected = true;
  sel.appendChild(ph);

  CLIENTI[clienteKey].offerte.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.id;
    opt.textContent = o.id + ' — ' + o.desc;
    if (o.id === selezionata) opt.selected = true;
    sel.appendChild(opt);
  });
}

/* ---------- Validazione ore ---------- */
function mostraErroreOre(msg){
  document.getElementById('oreErrorMsg').textContent = msg;
  document.getElementById('fieldOre').classList.add('has-error');
}
function pulisciErroreOre(){
  document.getElementById('fieldOre').classList.remove('has-error');
}

/* ---------- Submit del form (aggiungi o salva modifica) ---------- */
function onSubmit(e){
  e.preventDefault();
  const clienteKey = document.getElementById('fCliente').value;
  const offertaId  = document.getElementById('fOfferta').value;
  const oreRaw     = document.getElementById('fOre').value;
  const fatturabile= document.getElementById('fBill').checked;
  const nota       = document.getElementById('fNota').value.trim();

  // validazione ore
  const ore = parseOre(oreRaw);
  if (Number.isNaN(ore)){
    mostraErroreOre('Le ore devono essere un numero (es. 1,5).');
    document.getElementById('fOre').focus();
    return;
  }
  if (ore <= 0){
    mostraErroreOre('Inserisci un numero di ore maggiore di zero.');
    document.getElementById('fOre').focus();
    return;
  }
  pulisciErroreOre();

  if (!clienteKey || !offertaId){
    // nel mockup ci limitiamo a evidenziare; in produzione validazione dedicata
    return;
  }

  const cli = CLIENTI[clienteKey];
  const off = cli.offerte.find(o => o.id === offertaId);
  const dati = {
    clienteKey, cliente:cli.nome,
    offerta:off.id, offertaDesc:off.desc,
    ore, fatturabile, nota,
  };

  if (inModifica){
    const r = righe.find(x => x.id === inModifica);
    Object.assign(r, dati);
  } else {
    righe.push(Object.assign({ id:prossimoId++ }, dati));
  }

  resetForm();
  renderRighe();
}

/* ---------- Avvio modifica (form inline evidenziato) ---------- */
function avviaModifica(id){
  const r = righe.find(x => x.id === id);
  if (!r) return;
  inModifica = id;

  document.getElementById('fCliente').value = r.clienteKey;
  popolaOfferte(r.clienteKey, r.offerta);
  document.getElementById('fOre').value  = fmtOre(r.ore);
  document.getElementById('fBill').checked = r.fatturabile;
  document.getElementById('fNota').value = r.nota || '';
  pulisciErroreOre();

  // riconfigura header e pulsanti del form in modalità modifica
  document.getElementById('formCard').classList.add('is-edit');
  document.getElementById('formTitle').textContent = 'Modifica riga di attività';
  document.getElementById('formSub').textContent = r.cliente + ' · ' + r.offerta;
  document.getElementById('editTag').style.display = '';
  document.getElementById('formIcon').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  document.getElementById('submitIcon').innerHTML = '<path d="M20 6 9 17l-5-5"/>';
  document.getElementById('submitLabel').textContent = 'Salva modifiche';
  document.getElementById('btnReset').style.display = '';

  renderRighe(); // applica evidenziazione .editing alla riga
  document.getElementById('formCard').scrollIntoView({ behavior:'smooth', block:'center' });
}

/* ---------- Eliminazione ---------- */
function eliminaRiga(id){
  if (inModifica === id) resetForm();
  righe = righe.filter(r => r.id !== id);
  renderRighe();
}

/* ---------- Reset del form (torna in modalità "aggiungi") ---------- */
function resetForm(){
  inModifica = null;
  document.getElementById('actForm').reset();
  document.getElementById('fCliente').value = '';
  popolaOfferte('', null);
  document.getElementById('fBill').checked = true;
  pulisciErroreOre();

  document.getElementById('formCard').classList.remove('is-edit');
  document.getElementById('formTitle').textContent = 'Aggiungi riga di attività';
  document.getElementById('formSub').textContent = 'Registra il lavoro svolto in pochi secondi';
  document.getElementById('editTag').style.display = 'none';
  document.getElementById('formIcon').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14"/></svg>';
  document.getElementById('submitIcon').innerHTML = '<path d="M12 5v14M5 12h14"/>';
  document.getElementById('submitLabel').textContent = 'Aggiungi riga';
  document.getElementById('btnReset').style.display = 'none';

  renderRighe();
}

/* ---------- Bind ---------- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  document.getElementById('fCliente').addEventListener('change', e => {
    popolaOfferte(e.target.value, null);
  });

  // pulizia errore mentre l'utente corregge il valore
  document.getElementById('fOre').addEventListener('input', () => {
    const ore = parseOre(document.getElementById('fOre').value);
    if (!Number.isNaN(ore) && ore > 0) pulisciErroreOre();
  });

  document.getElementById('actForm').addEventListener('submit', onSubmit);
  document.getElementById('btnReset').addEventListener('click', resetForm);

  // i pulsanti Modifica/Elimina presenti nell'HTML statico iniziale
  document.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => avviaModifica(parseInt(b.dataset.edit,10))));
  document.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => eliminaRiga(parseInt(b.dataset.del,10))));

  renderRighe();
});
