import { describe, expect, it } from "vitest";
import { destinazioneDelClic } from "@/app/navigazione-dal-menu";

function clic(href: string, extra: Partial<Parameters<typeof destinazioneDelClic>[0]> = {}) {
  return {
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    currentTarget: { getAttribute: () => href } as unknown as HTMLAnchorElement,
    ...extra,
  };
}

const SU_CLIENTI = {
  href: "http://localhost/anagrafiche/clienti",
  pathname: "/anagrafiche/clienti",
  search: "",
};

describe("destinazione di un clic sul menu", () => {
  it("un clic su un'altra voce porta alla sua pagina", () => {
    expect(destinazioneDelClic(clic("/offerte"), SU_CLIENTI)).toEqual({
      pathname: "/offerte",
      ricerca: "",
    });
    expect(destinazioneDelClic(clic("/attivita?mese=2026-11"), SU_CLIENTI)).toEqual({
      pathname: "/attivita",
      ricerca: "mese=2026-11",
    });
  });

  it("la voce della pagina corrente non mostra alcuno scheletro", () => {
    expect(destinazioneDelClic(clic("/anagrafiche/clienti"), SU_CLIENTI)).toBeNull();
  });

  it("nuova scheda, nuova finestra o clic già gestito non cambiano questa pagina", () => {
    expect(destinazioneDelClic(clic("/offerte", { metaKey: true }), SU_CLIENTI)).toBeNull();
    expect(destinazioneDelClic(clic("/offerte", { ctrlKey: true }), SU_CLIENTI)).toBeNull();
    expect(destinazioneDelClic(clic("/offerte", { shiftKey: true }), SU_CLIENTI)).toBeNull();
    expect(destinazioneDelClic(clic("/offerte", { button: 1 }), SU_CLIENTI)).toBeNull();
    expect(destinazioneDelClic(clic("/offerte", { defaultPrevented: true }), SU_CLIENTI)).toBeNull();
  });
});
