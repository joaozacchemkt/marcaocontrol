import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  resolveAssistantAction,
  sendAssistantMessage,
  undoAssistantAction,
} from "@/lib/assistant.functions";

type Block = { type: string; text?: string };

export type ActionStatus = "pending" | "executing" | "done" | "cancelled" | "failed" | "undone";
export interface AssistantAction {
  id: string;
  tool: string;
  kind: "write" | "confirm";
  status: ActionStatus;
  summary: string;
  input: Json;
  undo: Json | null;
  created_at: string;
}
export interface ConversationSummary {
  id: string;
  title: string | null;
  updated_at: string;
}
export type ChatItem =
  | { kind: "message"; id: string; at: string; role: "user" | "assistant"; text: string }
  | { kind: "action"; id: string; at: string; action: AssistantAction };

function textOf(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return (content as Block[])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text!.trim())
    .filter(Boolean)
    .join("\n\n");
}

const CONV_LIST_KEY = ["assistant-conversations"] as const;

/**
 * Estado do chat do assistente: conversa atual, histórico, ações e as
 * mutações (enviar, confirmar, desfazer). As leituras vão direto ao banco
 * pelo RLS; as escritas passam pelas server functions.
 */
export function useAssistantChat() {
  const queryClient = useQueryClient();
  // undefined = ainda decidindo (vai abrir a mais recente); null = conversa nova.
  const [conversationId, setConversationId] = useState<string | null | undefined>(undefined);
  const [pendingText, setPendingText] = useState<string | null>(null);

  const conversations = useQuery({
    queryKey: CONV_LIST_KEY,
    queryFn: async (): Promise<ConversationSummary[]> => {
      const { data, error } = await supabase
        .from("assistant_conversations")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (conversationId === undefined && conversations.isSuccess) {
      setConversationId(conversations.data[0]?.id ?? null);
    }
  }, [conversationId, conversations.isSuccess, conversations.data]);

  const thread = useQuery({
    queryKey: ["assistant-conversation", conversationId],
    enabled: Boolean(conversationId),
    queryFn: async () => {
      const [msgs, acts] = await Promise.all([
        supabase
          .from("assistant_messages")
          .select("id, role, content, created_at")
          .eq("conversation_id", conversationId!)
          .eq("hidden", false)
          .order("created_at")
          .limit(400),
        supabase
          .from("assistant_actions")
          .select("id, tool, kind, status, summary, input, undo, created_at")
          .eq("conversation_id", conversationId!)
          .neq("status", "failed")
          .order("created_at"),
      ]);
      if (msgs.error) throw msgs.error;
      if (acts.error) throw acts.error;
      const actions = (acts.data ?? []) as AssistantAction[];
      const items: ChatItem[] = [];
      for (const m of msgs.data ?? []) {
        const text = textOf(m.content);
        if (text) items.push({ kind: "message", id: m.id, at: m.created_at, role: m.role as "user" | "assistant", text });
      }
      for (const a of actions) items.push({ kind: "action", id: a.id, at: a.created_at, action: a });
      items.sort((a, b) => a.at.localeCompare(b.at));
      return { items, actions };
    },
  });

  /** Depois de qualquer ação, o chat e as telas do app mostram o dado novo. */
  const refreshAll = () => void queryClient.invalidateQueries();

  const send = useMutation({
    mutationFn: (text: string) => sendAssistantMessage({ data: { conversationId: conversationId ?? null, text } }),
    onMutate: (text) => setPendingText(text),
    onSuccess: (res) => {
      if (res.conversationId) setConversationId(res.conversationId);
      if (!res.ok && res.error && !res.conversationId) toast.error(res.error);
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message || "Não consegui enviar. Tente de novo."),
    onSettled: () => setPendingText(null),
  });

  const resolve = useMutation({
    mutationFn: (v: { actionId: string; decision: "confirm" | "cancel" }) => resolveAssistantAction({ data: v }),
    onSuccess: (res) => {
      (res.ok ? toast.success : toast.error)(res.message);
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const undo = useMutation({
    mutationFn: (actionId: string) => undoAssistantAction({ data: { actionId } }),
    onSuccess: (res) => {
      (res.ok ? toast.success : toast.error)(res.message);
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    conversationId,
    selectConversation: (id: string | null) => setConversationId(id),
    conversations: conversations.data ?? [],
    items: thread.data?.items ?? [],
    actions: thread.data?.actions ?? [],
    loadingThread: thread.isLoading && Boolean(conversationId),
    pendingText,
    sending: send.isPending,
    /** Resolve false se não enviou (vazio, ocupado ou falha de rede), pra tela devolver o rascunho. */
    send: async (text: string): Promise<boolean> => {
      const t = text.trim();
      if (!t || send.isPending) return false;
      try {
        await send.mutateAsync(t);
        return true;
      } catch {
        return false;
      }
    },
    confirmAction: (id: string) => resolve.mutate({ actionId: id, decision: "confirm" }),
    cancelAction: (id: string) => resolve.mutate({ actionId: id, decision: "cancel" }),
    undoAction: (id: string) => undo.mutate(id),
    actionBusy: resolve.isPending || undo.isPending,
  };
}
