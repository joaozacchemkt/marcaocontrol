import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OutlookError, buildAuthUrl, finishConnect, outlookConfigured } from "@/lib/outlook/graph";

/** Status da conexão do Outlook do usuário logado. */
export const getOutlookStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("outlook_connections")
      .select("email, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { configured: outlookConfigured(), connected: Boolean(data), email: data?.email ?? null };
  });

/** Devolve a URL de login da Microsoft (state assinado com o usuário). */
export const startOutlookConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; url?: string; error?: string }> => {
    try {
      return { ok: true, url: buildAuthUrl(context.userId) };
    } catch (err) {
      return { ok: false, error: err instanceof OutlookError ? err.message : "Não consegui iniciar a conexão." };
    }
  });

/** Volta do login: troca o código pelos tokens e guarda criptografado. */
export const finishOutlookConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string; state: string }) => {
    if (typeof data?.code !== "string" || typeof data?.state !== "string") throw new Error("Retorno inválido");
    return { code: data.code.slice(0, 4000), state: data.state.slice(0, 500) };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; email?: string | null; error?: string }> => {
    try {
      const email = await finishConnect(context.supabase, context.userId, data.code, data.state);
      return { ok: true, email };
    } catch (err) {
      if (!(err instanceof OutlookError)) console.error("[outlook] finish:", err);
      return { ok: false, error: err instanceof OutlookError ? err.message : "Não consegui concluir a conexão." };
    }
  });

/** Desconecta: apaga os tokens (o acesso pode ser revogado também na Microsoft). */
export const disconnectOutlook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("outlook_connections").delete().eq("user_id", context.userId);
    return { ok: true };
  });
