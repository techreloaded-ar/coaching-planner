import Image from "next/image";

interface LogoCoachingPlannerProps {
  mostraNome?: boolean;
  grande?: boolean;
  compattoSuMobile?: boolean;
}

/**
 * Il calendario con la freccia è il marchio condiviso da tutte le aree.
 * Con il tema Natale porta una stella dorata sull'angolo in alto a destra.
 */
export function LogoCoachingPlanner({
  mostraNome = true,
  grande = false,
  compattoSuMobile = false,
}: LogoCoachingPlannerProps) {
  return (
    <span data-testid="logo-coaching-planner" className="inline-flex shrink-0 items-center gap-2.5">
      <span
        data-testid="simbolo-coaching-planner"
        className={`relative inline-flex shrink-0 items-center justify-center bg-white ${grande ? "rounded-2xl" : "rounded-lg"}`}
      >
        <svg
          aria-hidden="true"
          data-testid="stella-natale"
          viewBox="0 0 24 24"
          className={`absolute hidden fill-[#f0c95e] stroke-[#0b1320] drop-shadow-[0_0_3px_rgba(240,201,94,0.6)] natale:block ${grande ? "-right-3 -top-3 h-8 w-8" : "-right-1.5 -top-1.5 h-4 w-4"}`}
          strokeWidth={1.5}
          strokeLinejoin="round"
        >
          <path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.1l-6.2 3.8 1.6-7L2 9.2l7.1-.6Z" />
        </svg>
        <Image
          src="/coaching-planner-logo.svg"
          alt="Coaching Planner"
          width={grande ? 96 : 36}
          height={grande ? 96 : 36}
          className={grande ? "h-24 w-24" : "h-9 w-9"}
          loading="eager"
          unoptimized
        />
      </span>
      {mostraNome && (
        <span
          aria-hidden="true"
          className={`whitespace-nowrap text-[15px] font-semibold tracking-tight text-testo-principale ${compattoSuMobile ? "max-sm:hidden" : ""}`}
        >
          Coaching Planner
        </span>
      )}
    </span>
  );
}
