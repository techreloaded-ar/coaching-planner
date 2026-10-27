import Image from "next/image";

// Il PNG non ha trasparenza (fondo bianco, scritta nera): la targa bianca lo
// rende leggibile anche in tema scuro, come nella pagina di accesso.
// Sotto `lg` si mostra solo la mascotte (ritaglio via CSS, nessun asset in più):
// le intestazioni sono già piene e il logo completo le farebbe andare a capo.
export function LogoAgileReloaded() {
  return (
    <span
      data-testid="logo-agile-reloaded"
      className="inline-flex shrink-0 items-center overflow-hidden rounded-[8px] border border-zinc-200 bg-white px-2 py-0.5 max-sm:border-0 max-sm:px-0 dark:border-white/15"
    >
      <span className="block overflow-hidden max-lg:w-[23px]">
        <Image
          src="/agile-reloaded-logo.png"
          alt="Agile Reloaded"
          width={1000}
          height={290}
          className="h-6 w-auto max-w-none shrink-0"
          priority
        />
      </span>
    </span>
  );
}
