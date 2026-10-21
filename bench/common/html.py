"""Pezzi HTML condivisi da indice e report del banco: stile, colori, barre, legenda, pagina.

Tutti i report e l'indice usano questo modulo invece di ridefinire lo stile (vedi indice, sezione
«Convenzioni di stile»). Nessuna libreria esterna: la pagina deve funzionare aperta da file system.
"""
from pathlib import Path

CSS = (Path(__file__).parent / "style.css").read_text()


def e(testo):
    """Escape HTML. Non importa il modulo stdlib `html`, che questo file ombreggia quando è in sys.path."""
    return (str(testo).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#x27;"))

# Colori fissi per tutto il banco: fase → (etichetta, skill o metodo, colore).
FASI = {
    "spec": ("Chiarimento", "archetipo-spec", "#d49d32"),
    "plan": ("Piano", "archetipo-plan (anche con design)", "#8164c6"),
    "design": ("Mockup standalone", "archetipo-design", "#a98ad8"),
    "implement": ("Implementazione", "archetipo-implement (review interna inclusa)", "#3e8ac7"),
    "diretto": ("Sviluppo diretto", "nessuna skill ARchetipo", "#5aa9d6"),
    "review": ("Accettazione", "archetipo-review", "#3c9c85"),
    "wiki": ("Manutenzione Wiki", "archetipo-wiki refresh", "#c96a5a"),
    "avversario": ("Revisione avversaria delle storie (report 6)", "sessione separata", "#9c6b3c"),
    "valutazione": ("Valutazione, giudici, oracolo (se mostrati)", "fuori dal percorso", "#8a9a9f"),
}
# Report 4: la stessa barra mostra la composizione del diff per categoria.
CATEGORIE_DIFF = {
    "applicativo": ("Codice applicativo", "#3e8ac7"),
    "test_unit": ("Test unit", "#3c9c85"),
    "test_e2e": ("Test e2e", "#6fbfa8"),
    "migrazioni": ("Migrazioni Prisma", "#8164c6"),
    "ui": ("Componenti UI", "#5aa9d6"),
    "wiki": ("docs/wiki", "#c96a5a"),
    "archetipo": (".archetipo (piani e stato)", "#d49d32"),
    "mockup": ("Mockup (docs/mockups)", "#a98ad8"),
    "altro": ("Altro", "#8a9a9f"),
}
SKILL_FASE = {"archetipo-spec": "spec", "archetipo-plan": "plan", "archetipo-design": "design",
              "archetipo-implement": "implement", "archetipo-review": "review", "archetipo-wiki": "wiki",
              "diretto": "diretto"}


def mln(token):
    """Token in milioni con tre decimali, punto decimale (convenzione delle tabelle)."""
    return f"{token / 1e6:.3f}"


def barra(segmenti, unita="min"):
    """segmenti: lista di (etichetta, colore, valore). Barra con width in percentuale + caption, un rigo per segmento."""
    totale = sum(v for _, _, v in segmenti) or 1
    spans = "".join(f'<span title="{e(et)} · {v:.1f} {unita}" style="background:{c};width:{100 * v / totale:.2f}%"></span>'
                    for et, c, v in segmenti if v > 0)
    caption = "".join(f'<div><i style="background:{c}"></i>{e(et)} · {v:.1f} {unita}</div>' for et, c, v in segmenti if v > 0)
    return f'<div class="bar">{spans}</div><div class="phase-caption">{caption}</div>'


def legenda(voci):
    """voci: lista di (etichetta, colore)."""
    return '<div class="legend">' + "".join(f'<span><i style="background:{c}"></i>{e(et)}</span>' for et, c in voci) + "</div>"


def legenda_fasi():
    return legenda([(f"{et} · {skill}", c) for et, skill, c in FASI.values()])


def legenda_diff():
    return legenda(list(CATEGORIE_DIFF.values()))


def sezione(titolo, corpo, id_=None):
    attr = f' id="{id_}"' if id_ else ""
    return f"<section{attr}><h2>{e(titolo)}</h2>{corpo}</section>"


def tile(numero, spiegazione):
    return f"<div class='tile'><b>{numero}</b><small>{spiegazione}</small></div>"


SCRIPT = (
    "<script>"
    "var f=document.getElementById('model');if(f){f.addEventListener('change',function(){var v=this.value;"
    "document.querySelectorAll('#results tbody tr').forEach(function(r){r.hidden=!!v&&r.dataset.model!==v;});});}"
    "function apri(){var h=location.hash&&document.getElementById(location.hash.slice(1));"
    "if(h&&h.tagName==='DETAILS'){h.open=true;h.scrollIntoView();}}"
    "window.addEventListener('hashchange',apri);apri();"
    "</script>")


def pagina(titolo, corpo, footer):
    return (f'<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{e(titolo)}</title><style>{CSS}</style></head><body><main>{corpo}<footer>{footer}</footer></main>{SCRIPT}</body></html>')
