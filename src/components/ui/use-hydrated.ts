"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * true só depois da hidratação no navegador. Formulários de autenticação
 * mantêm o botão de envio desativado até lá: sem isso, um envio antes do
 * JavaScript carregar vira um submit nativo da página (com o HTML padrão,
 * GET com os campos na URL).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
