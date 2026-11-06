import { analizzaAction } from "./actions";
import Submit from "./submit";

export default function AnalizzaForm({ disabilitato }: {
  disabilitato: boolean;
}) {
  return <form action={analizzaAction}>
    <input type="hidden" name="modalita" value="INCREMENTALE" />
    <Submit attesa="Lettura e analisi in corso…" disabilitato={disabilitato}>Analizza foglio</Submit>
  </form>;
}
