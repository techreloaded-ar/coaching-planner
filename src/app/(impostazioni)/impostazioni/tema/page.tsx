import { temaPreferito } from "@/lib/tema-preferito";
import { SelettoreTema } from "@/components";

export default async function ImpostazioniTemaPage() {
  const tema = await temaPreferito();

  return (
    <section aria-labelledby="titolo-tema" className="flex flex-col gap-3">
      <div>
        <h2 id="titolo-tema" className="text-[15px] font-semibold text-testo-principale">
          Tema
        </h2>
        <p className="text-sm text-testo-metadati">
          Aspetto dell&apos;interfaccia su questo browser. «Browser» segue l&apos;impostazione del sistema.
        </p>
      </div>
      <SelettoreTema temaIniziale={tema} />
    </section>
  );
}
