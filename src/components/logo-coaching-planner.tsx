import Image from "next/image";

interface LogoCoachingPlannerProps {
  mostraNome?: boolean;
  grande?: boolean;
  compattoSuMobile?: boolean;
}

/** Il calendario con la freccia è il marchio condiviso da tutte le aree. */
export function LogoCoachingPlanner({
  mostraNome = true,
  grande = false,
  compattoSuMobile = false,
}: LogoCoachingPlannerProps) {
  return (
    <span data-testid="logo-coaching-planner" className="inline-flex shrink-0 items-center gap-2.5">
      <span
        data-testid="simbolo-coaching-planner"
        className={`inline-flex shrink-0 items-center justify-center bg-white ${grande ? "rounded-2xl" : "rounded-lg"}`}
      >
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
          className={`whitespace-nowrap text-[15px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100 ${compattoSuMobile ? "max-sm:hidden" : ""}`}
        >
          Coaching Planner
        </span>
      )}
    </span>
  );
}
