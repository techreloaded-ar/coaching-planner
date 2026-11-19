import type { CSSProperties } from "react";

const NUMERO_FIOCCHI = 28;
const SEZIONE_AUREA = 0.618033988749895;

/**
 * Fiocchi con parametri deterministici (niente casualità: server e client
 * producono lo stesso markup), distribuiti in modo uniforme sulla larghezza.
 */
const FIOCCHI = Array.from({ length: NUMERO_FIOCCHI }, (_, indice) => {
  const quota = (indice * SEZIONE_AUREA) % 1;
  const durata = 16 + ((indice * 7) % 13);
  return {
    sinistra: `${(quota * 100).toFixed(2)}%`,
    dimensione: 2 + (indice % 4),
    opacita: 0.35 + ((indice * 3) % 5) * 0.09,
    durata: `${durata}s`,
    // Ritardo negativo: all'apertura i fiocchi sono già sparsi su tutto lo schermo.
    ritardo: `${(-((indice * 0.37) % 1) * durata).toFixed(2)}s`,
    deriva: `${((indice % 2 === 0 ? 1 : -1) * (12 + (indice % 5) * 6)).toString()}px`,
    posizione: `${((indice * 0.37) % 1 * 100).toFixed(1)}vh`,
  };
});

/**
 * Neve del tema Natale: decorazione fissa dietro i contenuti, presente solo
 * quando `<html data-tema="natale">`. Lo stile (caduta, «riduci movimento»,
 * stampa) è in globals.css.
 */
export function NeveNatale() {
  return (
    <div aria-hidden="true" data-testid="neve-natale" className="neve-natale hidden natale:block">
      {FIOCCHI.map((fiocco, indice) => (
        <span
          key={indice}
          style={
            {
              left: fiocco.sinistra,
              width: fiocco.dimensione,
              height: fiocco.dimensione,
              opacity: fiocco.opacita,
              "--durata-fiocco": fiocco.durata,
              "--ritardo-fiocco": fiocco.ritardo,
              "--deriva-fiocco": fiocco.deriva,
              "--posizione-fiocco": fiocco.posizione,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
