import { useCallback, useEffect, useRef } from "react";

/**
 * Evita envio duplicado de formulário. Dois Enter (autorepeat da tecla) ou
 * dois clicks rápidos no "Salvar" disparam o onSubmit de novo antes de o
 * `isPending` da mutação — e o `disabled` do botão — entrarem no próximo
 * render. Uma trava síncrona por ref barra a segunda chamada até a mutação
 * terminar (sucesso ou erro), quando `isPending` volta a `false`.
 *
 * Uso:
 *   const submit = useGuardedSubmit(() => save.mutate(), save.isPending);
 *   <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
 */
export function useGuardedSubmit(run: () => void, isPending: boolean): () => void {
  const locked = useRef(false);

  useEffect(() => {
    if (!isPending) locked.current = false;
  }, [isPending]);

  return useCallback(() => {
    if (locked.current) return;
    locked.current = true;
    run();
  }, [run]);
}
