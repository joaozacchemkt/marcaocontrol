import { useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "theme";

/**
 * Script que roda no <head> antes da página pintar: aplica a classe `dark`
 * já na primeira renderização (sem "flash" branco ao abrir no escuro).
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function systemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && systemDark());
  const el = document.documentElement;
  el.classList.toggle("dark", dark);
  el.style.colorScheme = dark ? "dark" : "light";
  window.dispatchEvent(new CustomEvent("themechange"));
}

/** Escolha atual + tema efetivo (resolvido) + setter. Reage ao sistema no modo automático. */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    setChoice(readChoice());
    const sync = () => setResolved(document.documentElement.classList.contains("dark") ? "dark" : "light");
    sync();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => {
      if (readChoice() === "system") apply("system");
    };
    mq.addEventListener("change", onSystem);
    window.addEventListener("themechange", sync);
    return () => {
      mq.removeEventListener("change", onSystem);
      window.removeEventListener("themechange", sync);
    };
  }, []);

  const set = (next: ThemeChoice) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* sem storage: vale só nesta aba */
    }
    setChoice(next);
    apply(next);
  };

  return { choice, resolved, setTheme: set };
}
