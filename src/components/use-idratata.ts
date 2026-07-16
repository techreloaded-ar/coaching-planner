"use client";

import { useSyncExternalStore } from "react";

// Store immutabile: non emette mai notifiche, servono solo gli snapshot.
function subscribe(): () => void {
  return () => {};
}

/**
 * Vale `true` solo dopo l'idratazione del componente, quando i gestori di
 * eventi client sono agganciati. È il contratto osservabile usato dai test
 * e2e tramite l'attributo `data-idratata` sulle tabelle interattive.
 * Con useSyncExternalStore lo snapshot server (`false`) è usato nell'HTML
 * SSR e durante l'idratazione, poi React ri-renderizza con lo snapshot
 * client (`true`): il marker non può mai mentire dichiarandosi idratato
 * nell'HTML statico.
 */
export function useIdratata(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
