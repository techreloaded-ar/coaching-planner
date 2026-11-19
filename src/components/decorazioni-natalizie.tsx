/*
 * Decorazioni del tema Natalizio. Sono sempre nel markup ma visibili solo
 * quando <html> porta `data-tema="natalizio"` (variante `natalizio:` di
 * globals.css): così compaiono e spariscono subito al cambio di tema, senza
 * ricaricare. Puramente ornamentali: nascoste ai lettori di schermo, non
 * intercettano i clic e non vanno in stampa.
 */

/** Rametto di agrifoglio appoggiato all'angolo del logo. */
export function AgrifoglioNatalizio() {
  return (
    <span
      aria-hidden="true"
      data-decorazione-natalizia=""
      data-testid="decorazione-agrifoglio"
      className="pointer-events-none absolute -right-3 -top-2.5 hidden natalizio:block"
    >
      <svg viewBox="0 0 34 22" className="h-[18px] w-[28px]">
        <path d="M2 12c4-8 10-9 14-3-5 1-6 5-4 9-4-3-7-4-10-6Z" fill="#16a34a" />
        <path d="M32 12c-4-8-10-9-14-3 5 1 6 5 4 9 4-3 7-4 10-6Z" fill="#15803d" />
        <circle cx="15" cy="11" r="3" fill="#dc2626" />
        <circle cx="19" cy="12.5" r="3" fill="#b91c1c" />
        <circle cx="17" cy="8" r="2.6" fill="#ef4444" />
      </svg>
    </span>
  );
}

/** Ghirlanda di lucine appesa al bordo inferiore dell'elemento che la contiene (posizionato). */
export function GhirlandaNatalizia() {
  return (
    <span
      aria-hidden="true"
      data-decorazione-natalizia=""
      data-testid="decorazione-ghirlanda"
      className="ghirlanda-natalizia pointer-events-none absolute inset-x-0 -bottom-[14px] hidden h-4 natalizio:block"
    />
  );
}
