import { useEffect, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { finishOutlookConnect } from "@/lib/outlook.functions";

/** Volta do login da Microsoft (redirect URI registrado no Entra ID). */
export const Route = createFileRoute("/_authenticated/outlook-callback")({
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s["code"] === "string" ? s["code"] : undefined,
    state: typeof s["state"] === "string" ? s["state"] : undefined,
    error_description: typeof s["error_description"] === "string" ? s["error_description"] : undefined,
    // Volta do link de aprovação do administrador (não traz código de login).
    admin_consent: typeof s["admin_consent"] === "string" ? s["admin_consent"] : undefined,
  }),
  component: OutlookCallback,
});

function OutlookCallback() {
  const { code, state, error_description, admin_consent } = Route.useSearch();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    error_description
      ? { ok: false, text: error_description }
      : admin_consent
        ? { ok: true, text: "Aprovação do administrador concedida. Agora é só conectar o Outlook em Configurações." }
        : !code
          ? { ok: false, text: "A Microsoft não devolveu a autorização. Tente conectar de novo em Configurações." }
          : null,
  );
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || result || !code || !state) return;
    ran.current = true; // o código só vale uma vez (StrictMode roda o efeito 2x)
    void finishOutlookConnect({ data: { code, state } }).then((r) =>
      setResult(
        r.ok
          ? { ok: true, text: `Outlook conectado${r.email ? ` (${r.email})` : ""}. Agora é só pedir no assistente: "tem algo pendente no meu e-mail?"` }
          : { ok: false, text: r.error ?? "Não deu certo." },
      ),
    );
  }, [code, state, result]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-md space-y-4 pt-16 text-center">
        {!result ? (
          <p className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Conectando o Outlook…
          </p>
        ) : (
          <>
            {result.ok ? (
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            ) : (
              <XCircle className="mx-auto h-10 w-10 text-destructive" />
            )}
            <p className="text-sm">{result.text}</p>
            <div className="flex justify-center gap-2">
              <Button asChild variant="outline">
                <Link to="/configuracoes">Configurações</Link>
              </Button>
              {result.ok && (
                <Button asChild>
                  <Link to="/assistente">Abrir o assistente</Link>
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
