import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { AssistantError, runTurn, saveSystemNote } from "@/lib/assistant/agent";
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
  .inputValidator((data: { conversationId?: string | null; text: string }) => {
    const text = typeof data?.text === "string" ? data.text.trim().slice(0, 4000) : "";
    const conversationId =
      typeof data?.conversationId === "string" && UUID_RE.test(data.conversationId) ? data.conversationId : null;
    return { text, conversationId };
  })
  .handler(async ({ data, context }): Promise<AssistantReply> => {
    const { supabase: db, userId } = context;
    if (!data.text) return { ok: false, conversationId: data.conversationId, error: "Mensagem vazia." };

    let conversationId = data.conversationId;
    if (conversationId) {
      const { data: conv } = await db
        .from("assistant_conversations")
        .select("id")
        .eq("id", conversationId)
        .maybeSingle();
      if (!conv) conversationId = null;
    }
    if (!conversationId) {
      const { data: conv, error } = await db
        .from("assistant_conversations")
        .insert({ user_id: userId, title: data.text.slice(0, 80) })
        .select("id")
        .single();
      if (error || !conv) return { ok: false, conversationId: null, error: "Não consegui abrir a conversa." };
      conversationId = conv.id;
    } else {
      // Sobe a conversa pro topo da lista (o gatilho atualiza updated_at).
      await db.from("assistant_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    }

    const ctx = { db, userId, conversationId };
    const { error: insErr } = await db.from("assistant_messages").insert({
      conversation_id: conversationId,
      user_id: userId,
      role: "user",
      content: [{ type: "text", text: data.text }] as Json,
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
  .inputValidator((data: { actionId: string; decision: "confirm" | "cancel" }) => {
    if (typeof data?.actionId !== "string" || !UUID_RE.test(data.actionId)) throw new Error("Ação inválida");
    if (data.decision !== "confirm" && data.decision !== "cancel") throw new Error("Decisão inválida");
    return data;
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
      const out = await tool.commit(parsed.data, ctx);
      await db.from("assistant_actions").update({ status: "done", summary: out.summary }).eq("id", action.id);
      await saveSystemNote(db, ctx, `O usuário CONFIRMOU e foi executado: ${action.summary}.`);
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
