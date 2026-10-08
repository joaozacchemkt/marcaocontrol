import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { AssistantError, runTurn, saveSystemNote, summarizeConversation } from "@/lib/assistant/agent";
import { AUTO_CONTEXT_PREFIX, pageName } from "@/lib/assistant/snapshot";
import { ToolError, getTool, parseToolInput, runUndo, type UndoSpec } from "@/lib/assistant/tools";

/**
 * Endpoints do assistente. A leitura do chat (mensagens/ações) é feita direto
 * pelo navegador via RLS; aqui ficam só as operações que precisam do
 * servidor (chave da API) ou que executam ações.
 */

export interface AssistantReply {
  ok: boolean;
  conversationId: string | null;
  error?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const sendAssistantMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      conversationId?: string | null;
      text: string;
      page?: string | null;
      images?: { path: string; mediaType: string }[];
    }) => {
      const text = typeof data?.text === "string" ? data.text.trim().slice(0, 4000) : "";
      const conversationId =
        typeof data?.conversationId === "string" && UUID_RE.test(data.conversationId) ? data.conversationId : null;
      const page = typeof data?.page === "string" ? data.page.slice(0, 200) : null;
      const images = (Array.isArray(data?.images) ? data.images : [])
        .filter(
          (i) =>
            typeof i?.path === "string" &&
            /^[0-9a-f-]{36}\/[\w.-]{1,120}$/i.test(i.path) &&
            ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(i.mediaType),
        )
        .slice(0, 4);
      return { text, conversationId, page, images };
    },
  )
  .handler(async ({ data, context }): Promise<AssistantReply> => {
    const { supabase: db, userId } = context;
    // Só aceita imagem da própria pasta (o RLS do Storage também garante).
    const images = data.images.filter((i) => i.path.startsWith(`${userId}/`));
    if (!data.text && images.length === 0) return { ok: false, conversationId: data.conversationId, error: "Mensagem vazia." };
    const text = data.text || (images.length > 1 ? "(enviou imagens)" : "(enviou uma imagem)");

    let conversationId = data.conversationId;
    if (conversationId) {
      const { data: conv } = await db
        .from("assistant_conversations")
        .select("id, archived_at")
        .eq("id", conversationId)
        .maybeSingle();
      // Conversa limpa (arquivada) não recebe mensagem nova: abre outra.
      if (!conv || conv.archived_at) conversationId = null;
    }
    if (!conversationId) {
      const { data: conv, error } = await db
        .from("assistant_conversations")
        .insert({ user_id: userId, title: (data.text || "Imagem").slice(0, 80) })
        .select("id")
        .single();
      if (error || !conv) return { ok: false, conversationId: null, error: "Não consegui abrir a conversa." };
      conversationId = conv.id;
    } else {
      // Sobe a conversa pro topo da lista (o gatilho atualiza updated_at).
      await db.from("assistant_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    }

    const ctx = { db, userId, conversationId };
    // Contexto automático gravado junto com a mensagem (fica fixo no
    // histórico: o modelo vê a situação daquele momento e o cache não quebra).
    // Contexto automático: só a tela de onde a pessoa abriu o chat. A
    // situação (contas, agenda...) NÃO vai junto — o modelo tendia a recitar
    // pendência fora de assunto; ele consulta com ver_situacao quando precisa.
    let auto = AUTO_CONTEXT_PREFIX;
    const page = pageName(data.page);
    if (page) auto += `\nAbriu o chat a partir da tela: ${page}.`;
    const { error: insErr } = await db.from("assistant_messages").insert({
      conversation_id: conversationId,
      user_id: userId,
      role: "user",
      content: [
        ...images.map((i) => ({ type: "image_ref", path: i.path, media_type: i.mediaType })),
        { type: "text", text },
        ...(auto === AUTO_CONTEXT_PREFIX ? [] : [{ type: "text", text: auto }]),
      ] as Json,
    });
    if (insErr) return { ok: false, conversationId, error: "Não consegui salvar sua mensagem." };

    try {
      await runTurn(db, ctx);
      return { ok: true, conversationId };
    } catch (err) {
      const msg = err instanceof AssistantError ? err.message : "Algo deu errado do meu lado. Tente de novo.";
      if (!(err instanceof AssistantError)) console.error("[assistente] turno falhou:", err);
      // Deixa a falha visível no próprio chat (e no histórico do modelo).
      await db.from("assistant_messages").insert({
        conversation_id: conversationId,
        user_id: userId,
        role: "assistant",
        content: [{ type: "text", text: `⚠️ ${msg}` }] as Json,
      });
      return { ok: false, conversationId, error: msg };
    }
  });

type ActionRow = {
  id: string;
  conversation_id: string;
  tool: string;
  kind: string;
  status: string;
  summary: string;
  input: Json;
  undo: Json | null;
};

/** Confirmar/cancelar uma ação pendente. Executa exatamente o que o cartão mostrou. */
export const resolveAssistantAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { actionId: string; decision: "confirm" | "cancel"; scope?: "one" | "following" }) => {
    if (typeof data?.actionId !== "string" || !UUID_RE.test(data.actionId)) throw new Error("Ação inválida");
    if (data.decision !== "confirm" && data.decision !== "cancel") throw new Error("Decisão inválida");
    const scope = data.scope === "following" ? "following" : "one";
    return { actionId: data.actionId, decision: data.decision, scope } as const;
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string }> => {
    const { supabase: db, userId } = context;
    // Trava atômica: só um clique passa de pending → executing/cancelled.
    const { data: claimed } = await db
      .from("assistant_actions")
      .update({ status: data.decision === "confirm" ? "executing" : "cancelled" })
      .eq("id", data.actionId)
      .eq("status", "pending")
      .eq("kind", "confirm")
      .select("id, conversation_id, tool, kind, status, summary, input, undo")
      .maybeSingle();
    const action = claimed as ActionRow | null;
    if (!action) return { ok: false, message: "Essa ação já foi resolvida." };
    const ctx = { db, userId, conversationId: action.conversation_id };

    if (data.decision === "cancel") {
      await saveSystemNote(db, ctx, `O usuário CANCELOU a ação: ${action.summary}. Nada foi alterado.`);
      return { ok: true, message: "Cancelado." };
    }

    const tool = getTool(action.tool);
    const parsed = tool && tool.kind === "confirm" ? parseToolInput(tool, action.input) : null;
    try {
      if (!tool || tool.kind !== "confirm" || !parsed?.ok) throw new ToolError("Ação inválida ou desatualizada.");
      const out = await tool.commit(parsed.data, ctx, { scope: data.scope });
      await db.from("assistant_actions").update({ status: "done", summary: out.summary }).eq("id", action.id);
      await saveSystemNote(db, ctx, `O usuário CONFIRMOU e foi executado: ${out.summary}.`);
      return { ok: true, message: out.summary };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!(err instanceof ToolError)) console.error("[assistente] commit falhou:", err);
      await db.from("assistant_actions").update({ status: "failed", error: msg }).eq("id", action.id);
      await saveSystemNote(db, ctx, `O usuário confirmou, mas a execução FALHOU (${msg}): ${action.summary}.`);
      return { ok: false, message: `Não deu certo: ${msg}` };
    }
  });

/** Desfaz uma ação já executada (criação/quitação). */
export const undoAssistantAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { actionId: string }) => {
    if (typeof data?.actionId !== "string" || !UUID_RE.test(data.actionId)) throw new Error("Ação inválida");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string }> => {
    const { supabase: db, userId } = context;
    const { data: claimed } = await db
      .from("assistant_actions")
      .update({ status: "executing" })
      .eq("id", data.actionId)
      .eq("status", "done")
      .eq("kind", "write")
      .not("undo", "is", null)
      .select("id, conversation_id, tool, kind, status, summary, input, undo")
      .maybeSingle();
    const action = claimed as ActionRow | null;
    if (!action) return { ok: false, message: "Essa ação não pode mais ser desfeita." };
    const ctx = { db, userId, conversationId: action.conversation_id };
    try {
      await runUndo(action.undo as unknown as UndoSpec, ctx);
      await db.from("assistant_actions").update({ status: "undone" }).eq("id", action.id);
      await saveSystemNote(db, ctx, `O usuário DESFEZ a ação: ${action.summary}. Ela não vale mais.`);
      return { ok: true, message: "Desfeito." };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[assistente] desfazer falhou:", err);
      await db.from("assistant_actions").update({ status: "done", error: msg }).eq("id", action.id);
      return { ok: false, message: `Não consegui desfazer: ${msg}` };
    }
  });

/**
 * "Limpar conversa": arquiva com um resumo (que entra no contexto das
 * próximas conversas) e o chat recomeça limpo, sem perder o fio.
 */
export const archiveAssistantConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { conversationId: string }) => {
    if (typeof data?.conversationId !== "string" || !UUID_RE.test(data.conversationId)) throw new Error("Conversa inválida");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; summary: string | null }> => {
    const { supabase: db } = context;
    const { data: conv } = await db
      .from("assistant_conversations")
      .select("id, archived_at")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv) return { ok: false, summary: null };
    if (conv.archived_at) return { ok: true, summary: null };
    let summary: string | null = null;
    try {
      summary = await summarizeConversation(db, data.conversationId);
    } catch (err) {
      // Sem resumo não trava: a conversa é arquivada mesmo assim.
      console.error("[assistente] resumo falhou:", err);
    }
    await db
      .from("assistant_conversations")
      .update({ archived_at: new Date().toISOString(), summary })
      .eq("id", data.conversationId);
    return { ok: true, summary };
  });
