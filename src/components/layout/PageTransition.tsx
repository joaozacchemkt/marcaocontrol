import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Transição de rota fluida: fade + deslocamento sutil, trocando somente
 * quando o pathname muda. Respeita `prefers-reduced-motion`.
 */
export const PageTransition = ({ children }: PageTransitionProps) => {
  const { pathname } = useLocation();
  const reduced = useReducedMotion();

  if (reduced) return <div>{children}</div>;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
