/**
 * Area di testo «Note» per le anagrafiche: testo libero su più righe,
 * facoltativo, riservato agli amministratori.
 */
export function CampoNote({ defaultValue, className = "" }: { defaultValue: string; className?: string }) {
  return (
    <div className={`mb-[18px] flex min-w-0 flex-col gap-[6px] text-left ${className}`} data-campo="note">
      <label htmlFor="note" className="text-[12.5px] font-semibold tracking-[.01em] text-zinc-600 dark:text-zinc-400">
        Note <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">(facoltativo)</span>
      </label>
      <textarea
        id="note"
        name="note"
        rows={4}
        defaultValue={defaultValue}
        placeholder="Informazioni utili che non hanno un campo dedicato"
        className="w-full resize-y rounded-[10px] border border-zinc-200 bg-white px-[13px] py-[10px] font-[inherit] text-[14px] leading-[1.5] text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-indigo-300 focus:shadow-[0_0_0_3px_rgb(99_102_241_/_0.12)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-indigo-500/50"
      />
    </div>
  );
}

/** Note in sola lettura, con gli a capo preservati; nulla se vuote. */
export function NoteAnagrafica({ note, className = "" }: { note: string | null; className?: string }) {
  if (!note) return null;
  return (
    <div className={className} data-testid="note-anagrafica">
      <div className="mb-[5px] text-[10.5px] font-bold uppercase tracking-[.07em] text-zinc-400 dark:text-zinc-500">Note</div>
      <p className="m-0 whitespace-pre-wrap break-words text-[13.5px] leading-[1.5] text-zinc-700 dark:text-zinc-300">{note}</p>
    </div>
  );
}

