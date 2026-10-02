import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  OutlookError,
  buildAuthUrl,
  finishConnect,
  listCalendar,
  listInbox,
  outlookConfigured,
  type InboxItem,
  type OutlookEvent,
} from "@/lib/outlook/graph";
import { getTool, parseToolInput } from "@/lib/assistant/tools";

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

// ---------------------------------------------------------------------------
// Tela "E-mail" e Agenda
// ---------------------------------------------------------------------------


/** Caixa de entrada pra tela. Nunca lança: devolve o motivo pra tela mostrar. */
export const getOutlookInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { days?: number }) => ({ days: Math.min(30, Math.max(1, Number(data?.days) || 7)) }))
  .handler(async ({ data, context }): Promise<{ ok: boolean; items: InboxItem[]; error?: string; connected: boolean }> => {
    const { data: conn } = await context.supabase
      .from("outlook_connections")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!conn) return { ok: false, items: [], connected: false };
    try {
      return { ok: true, items: await listInbox(context.supabase, context.userId, { days: data.days }), connected: true };
    } catch (err) {
      return { ok: false, items: [], connected: true, error: err instanceof OutlookError ? err.message : "Falha ao ler o e-mail." };
    }
  });

/** Compromissos do Outlook no intervalo (pra Agenda). Sem conexão = lista vazia. */
export const getOutlookEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { from: string; to: string }) => {
    const from = new Date(data?.from);
    const to = new Date(data?.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new Error("Período inválido");
    return { from: from.toISOString(), to: to.toISOString() };
  })
  .handler(async ({ data, context }): Promise<{ events: OutlookEvent[]; error?: string }> => {
    const { data: conn } = await context.supabase
      .from("outlook_connections")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!conn) return { events: [] };
    try {
      return { events: await listCalendar(context.supabase, context.userId, data.from, data.to) };
    } catch (err) {
      return { events: [], error: err instanceof OutlookError ? err.message : "Falha ao ler a agenda do Outlook." };
    }
  });

/** "Virar tarefa": mesma regra do assistente (criar_tarefa com origem no e-mail). */
export const createTaskFromEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { emailId: string; emailLink: string; titulo: string; prazo?: string; prioridade?: string; projetoId?: string }) =>
      data,
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string }> => {
    const tool = getTool("criar_tarefa")!;
    const parsed = parseToolInput(tool, {
      titulo: data.titulo,
      email_id: data.emailId,
      email_link: data.emailLink,
      ...(data.prazo ? { prazo: data.prazo } : {}),
      ...(data.prioridade ? { prioridade: data.prioridade } : {}),
      ...(data.projetoId ? { projeto_id: data.projetoId } : {}),
      responsavel_id: context.userId,
    });
    if (!parsed.ok || tool.kind !== "write") return { ok: false, message: parsed.ok ? "Erro interno." : parsed.error };
    try {
      const out = await tool.run(parsed.data, { db: context.supabase, userId: context.userId, conversationId: "" });
      return { ok: true, message: out.summary };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Não consegui criar a tarefa." };
    }
  });

/** Ignorar / voltar a mostrar um e-mail (não mexe no Outlook). */
export const setEmailIgnored = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { emailId: string; ignored: boolean }) => {
    if (typeof data?.emailId !== "string" || data.emailId.length < 10) throw new Error("E-mail inválido");
    return { emailId: data.emailId.slice(0, 500), ignored: Boolean(data.ignored) };
  })
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    if (data.ignored) {
      await db
        .from("outlook_seen_messages")
        .upsert({ user_id: context.userId, message_id: data.emailId, decision: "ignorado" }, { ignoreDuplicates: true });
    } else {
      await db
        .from("outlook_seen_messages")
        .delete()
        .eq("user_id", context.userId)
        .eq("message_id", data.emailId)
        .eq("decision", "ignorado");
    }
    return { ok: true };
  });
