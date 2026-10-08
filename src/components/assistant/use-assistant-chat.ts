import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  archiveAssistantConversation,
  resolveAssistantAction,
  sendAssistantMessage,
  undoAssistantAction,
} from "@/lib/assistant.functions";
import { AUTO_CONTEXT_PREFIX } from "@/lib/assistant/snapshot";
import type { PreparedImage } from "./image-utils";

type Block = { type: string; text?: string; name?: string; path?: string };

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
  archived_at: string | null;
}
export type ChatItem =
  | { kind: "message"; id: string; at: string; role: "user" | "assistant"; text: string; images: string[] }
  | { kind: "action"; id: string; at: string; action: AssistantAction };

/** Texto visível de uma mensagem (sem o bloco de contexto automático). */
function textOf(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const hasImage = (content as Block[]).some((b) => b.type === "image_ref");
  return (content as Block[])
    .filter((b) => b.type === "text" && b.text && !b.text.startsWith(AUTO_CONTEXT_PREFIX))
    .map((b) => b.text!.trim())
    // Texto automático de mensagem só com imagem não aparece no balão.
    .filter((t) => t && !(hasImage && /^\(enviou (uma imagem|imagens)\)$/.test(t)))
    .join("\n\n");
}

function imagesOf(content: unknown): string[] {
  if (!Array.isArray(content)) return [];
  return (content as Block[]).filter((b) => b.type === "image_ref" && b.path).map((b) => b.path!);
}

/**
 * Estado do chat do assistente: conversa atual, histórico, ações e as
 * mutações (enviar, confirmar, desfazer, limpar). Leituras direto no banco
 * (RLS); escritas pelas server functions.
 */
export function useAssistantChat(page: string | null) {
  const queryClient = useQueryClient();
  // undefined = ainda decidindo (vai abrir a mais recente); null = conversa nova.
  const [conversationId, setConversationId] = useState<string | null | undefined>(undefined);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<string[]>([]);

  const conversations = useQuery({
    queryKey: ["assistant-conversations"],
    queryFn: async (): Promise<ConversationSummary[]> => {
      const { data, error } = await supabase
        .from("assistant_conversations")
        .select("id, title, updated_at, archived_at")
        .order("updated_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Abre a conversa mais recente que ainda não foi limpa.
  useEffect(() => {
    if (conversationId === undefined && conversations.isSuccess) {
      setConversationId(conversations.data.find((c) => !c.archived_at)?.id ?? null);
    }
  }, [conversationId, conversations.isSuccess, conversations.data]);

  const sending = pendingText !== null;

  const thread = useQuery({
    queryKey: ["assistant-conversation", conversationId],
    enabled: Boolean(conversationId),
    // Enquanto o assistente trabalha, acompanha os passos ao vivo.
    refetchInterval: sending ? 1500 : false,
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
      // Ferramentas chamadas depois da última mensagem visível do usuário
      // (pra mostrar "Consultando lançamentos…" enquanto ele trabalha).
      let steps: string[] = [];
      for (const m of msgs.data ?? []) {
        const content = (Array.isArray(m.content) ? m.content : []) as Block[];
        const text = textOf(content);
        if (m.role === "user" && text) steps = [];
        if (m.role === "assistant") steps.push(...content.filter((b) => b.type === "tool_use").map((b) => b.name ?? ""));
        const images = imagesOf(content);
        if (text || images.length)
          items.push({ kind: "message", id: m.id, at: m.created_at, role: m.role as "user" | "assistant", text, images });
      }
      for (const a of actions) items.push({ kind: "action", id: a.id, at: a.created_at, action: a });
      items.sort((a, b) => a.at.localeCompare(b.at));
      return { items, actions, steps };
    },
  });

  /** Depois de qualquer ação, o chat e as telas do app mostram o dado novo. */
  const refreshAll = () => void queryClient.invalidateQueries();

  const send = useMutation({
    mutationFn: async ({ text, images }: { text: string; images: PreparedImage[] }) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user!.id;
      // Sobe os prints direto pro Storage (pasta privada da pessoa).
      const uploaded = await Promise.all(
        images.map(async (img) => {
          const path = `${uid}/${crypto.randomUUID()}.jpg`;
          const { error } = await supabase.storage
            .from("assistant-uploads")
            .upload(path, img.blob, { contentType: img.mediaType, upsert: false });
          if (error) throw new Error(`Não consegui enviar a imagem: ${error.message}`);
          return { path, mediaType: img.mediaType };
        }),
      );
      // Conversa nova é criada antes, pra tela já acompanhar os passos ao vivo.
      let id = conversationId ?? null;
      const current = id ? conversations.data?.find((c) => c.id === id) : null;
      if (!id || current?.archived_at) {
        const { data, error } = await supabase
          .from("assistant_conversations")
          .insert({ user_id: uid, title: (text || "Imagem").slice(0, 80) })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
        setConversationId(id);
      }
      return sendAssistantMessage({ data: { conversationId: id, text, page, images: uploaded } });
    },
    onMutate: ({ text, images }) => {
      setPendingText(text);
      setPendingImages(images.map((i) => i.previewUrl));
    },
    onSuccess: (res) => {
      if (res.conversationId) setConversationId(res.conversationId);
      if (!res.ok && res.error && !res.conversationId) toast.error(res.error);
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message || "Não consegui enviar. Tente de novo."),
    onSettled: () => {
      setPendingText(null);
      setPendingImages([]);
    },
  });

  const resolve = useMutation({
    mutationFn: (v: { actionId: string; decision: "confirm" | "cancel"; scope?: "one" | "following" }) =>
      resolveAssistantAction({ data: v }),
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

  const archive = useMutation({
    mutationFn: (id: string) => archiveAssistantConversation({ data: { conversationId: id } }),
    onSuccess: (res) => {
      setConversationId(null);
      toast.success(
        res.summary
          ? "Nova conversa. Guardei um resumo da anterior pra continuar de onde paramos."
          : "Nova conversa iniciada.",
      );
      void queryClient.invalidateQueries({ queryKey: ["assistant-conversations"] });
    },
    // Mesmo se o resumo falhar, abre a conversa nova (não deixa o botão "morto").
    onError: () => {
      setConversationId(null);
      toast.success("Nova conversa iniciada.");
    },
  });

  const items = thread.data?.items ?? [];
  const current = conversations.data?.find((c) => c.id === conversationId) ?? null;
  // Some com o balão provisório assim que a mensagem real aparece no histórico.
  const lastUser = [...items].reverse().find((i) => i.kind === "message" && i.role === "user");
  const pendingShown =
    pendingText !== null &&
    !(lastUser && lastUser.kind === "message" && lastUser.text === pendingText.trim() && lastUser.images.length === pendingImages.length);

  return {
    conversationId,
    currentArchived: Boolean(current?.archived_at),
    selectConversation: (id: string | null) => setConversationId(id),
    conversations: conversations.data ?? [],
    items,
    actions: thread.data?.actions ?? [],
    steps: sending ? (thread.data?.steps ?? []) : [],
    loadingThread: thread.isLoading && Boolean(conversationId),
    pendingText: pendingShown ? pendingText : null,
    pendingImages: pendingShown ? pendingImages : [],
    sending,
    /** Resolve false se não enviou (vazio, ocupado ou falha de rede), pra tela devolver o rascunho. */
    send: async (text: string, images: PreparedImage[] = []): Promise<boolean> => {
      const t = text.trim();
      if ((!t && images.length === 0) || send.isPending) return false;
      try {
        await send.mutateAsync({ text: t, images });
        return true;
      } catch {
        return false;
      }
    },
    /**
     * "Nova conversa": encerra a atual guardando um resumo (o contexto não se
     * perde e ela não volta ao recarregar) e abre uma limpa.
     */
    newConversation: () => {
      const hasMessages = items.some((i) => i.kind === "message");
      if (conversationId && !current?.archived_at && hasMessages) {
        archive.mutate(conversationId);
      } else {
        setConversationId(null);
        toast.success("Nova conversa iniciada.");
      }
    },
    clearing: archive.isPending,
    confirmAction: (id: string, scope?: "one" | "following") =>
      resolve.mutate({ actionId: id, decision: "confirm", ...(scope ? { scope } : {}) }),
    cancelAction: (id: string) => resolve.mutate({ actionId: id, decision: "cancel" }),
    undoAction: (id: string) => undo.mutate(id),
    actionBusy: resolve.isPending || undo.isPending,
  };
}
