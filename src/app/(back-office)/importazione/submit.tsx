"use client";
import { useFormStatus } from "react-dom";

export default function Submit({ children, attesa, disabilitato = false, pericolo = false }: {
  children: React.ReactNode; attesa: string; disabilitato?: boolean; pericolo?: boolean;
}) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending || disabilitato} className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${pericolo ? "bg-red-700 hover:bg-red-800" : "bg-indigo-600 hover:bg-indigo-700"}`}>
    {pending ? attesa : children}
  </button>;
}
