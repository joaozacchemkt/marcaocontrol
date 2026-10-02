/**
 * Laço do agente (servidor). Um "turno" = mensagem do usuário → Claude →
 * ferramentas → Claude ... até a resposta final.
 *
 * Robustez:
 * - Tudo que a API devolve é salvo como veio (inclusive blocos de thinking e
 *   fallback), pra reenviar o histórico sem alteração.
 * - O histórico é remontado de forma que a API sempre aceite: começa numa
 *   mensagem de texto do usuário e todo tool_use tem seu tool_result (se o
 *   servidor morreu no meio, completa com "interrompido").
 * - Teto de passos por turno, pra um erro nunca virar laço infinito/caro.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Db } from "@/lib/db";
import type { Json } from "@/integrations/supabase/types";
import { SYSTEM_PROMPT, buildContext } from "./prompt";
import { ToolError, getTool, parseToolInput, toolSchemas, type ToolCtx } from "./tools";
import { nowLabelSP } from "./time";

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ContentBlockParam = Anthropic.Beta.BetaContentBlockParam;
type ToolResultParam = Anthropic.Beta.BetaToolResultBlockParam;

// Padrão: o modelo mais econômico (as tarefas são CRUD simples). Pra trocar
// sem mexer no código: env ASSISTANT_MODEL (ex.: claude-sonnet-5).
const MODEL = process.env["ASSISTANT_MODEL"] || "claude-haiku-4-5";
const EFFORT = (process.env["ASSISTANT_EFFORT"] || "medium") as "low" | "medium" | "high";

/** Haiku 4.5 não tem thinking adaptativo nem `effort`; roda sem thinking. */
const IS_HAIKU = MODEL.startsWith("claude-haiku");
/** Fallback de recusa no servidor: só nos modelos que suportam. */
const HAS_FALLBACKS = MODEL.startsWith("claude-opus-5") || MODEL.startsWith("claude-fable");

/** Parâmetros que dependem do modelo (thinking, effort, fallback). */
function modelParams(effort: "low" | "medium" | "high") {
  return {
    ...(IS_HAIKU ? {} : { thinking: { type: "adaptive" as const }, output_config: { effort } }),
    ...(HAS_FALLBACKS ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  };
}
const MAX_STEPS = 10;
const HISTORY_ROWS = 80;

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: Json;
  hidden: boolean;
  created_at: string;
}

/** Erro com mensagem pronta pra mostrar ao usuário. */
export class AssistantError extends Error {}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) throw new AssistantError("O assistente ainda não foi configurado (falta a chave da API).");
  // Chave de usuário (sk-ant-usr-…) não é presa a um workspace: a API exige
  // o header com o workspace a cobrar. Chave de workspace dispensa.
  const workspaceId = process.env["ANTHROPIC_WORKSPACE_ID"];
  client ??= new Anthropic({
    apiKey,
    maxRetries: 2,
    timeout: 120_000,
    ...(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {}),
  });
  return client;
}

// ---------------------------------------------------------------------------
// Persistência
// ---------------------------------------------------------------------------

async function saveMessage(
  db: Db,
  ctx: ToolCtx,
  role: "user" | "assistant",
  content: unknown,
  hidden = false,
): Promise<void> {
  const { error } = await db.from("assistant_messages").insert({
    conversation_id: ctx.conversationId,
    user_id: ctx.userId,
    role,
    content: content as Json,
    hidden,
  });
  if (error) throw new Error(`Falha ao salvar mensagem: ${error.message}`);
}

/** Nota invisível no chat que informa o modelo (ex.: ação confirmada/desfeita). */
export async function saveSystemNote(db: Db, ctx: ToolCtx, text: string): Promise<void> {
  await saveMessage(db, ctx, "user", [{ type: "text", text: `[Nota do sistema] ${text}` }], true);
}

// ---------------------------------------------------------------------------
// Histórico → formato da API
// ---------------------------------------------------------------------------

function isToolResultOnly(content: unknown): boolean {
  return Array.isArray(content) && content.length > 0 && content.every((b) => (b as { type?: string }).type === "tool_result");
}

/**
 * Converte linhas salvas em mensagens válidas pra API. A mensagem visível do
 * usuário ganha o carimbo de data/hora de quando foi enviada (determinístico:
 * vem do `created_at`, então o prefixo do cache não muda entre turnos).
 */
const THINKING_TYPES = new Set(["thinking", "redacted_thinking", "fallback"]);

export function buildApiMessages(rows: StoredMessage[], keepThinking = !IS_HAIKU): MessageParam[] {
  // Começa numa mensagem de texto do usuário (nunca num tool_result solto).
  const start = rows.findIndex((r) => r.role === "user" && !isToolResultOnly(r.content));
  const usable = start === -1 ? [] : rows.slice(start);

  const out: MessageParam[] = [];
  for (let i = 0; i < usable.length; i++) {
    const row = usable[i]!;
    let content = row.content as unknown as ContentBlockParam[];
    // Sem thinking (Haiku) ou trocando de modelo: blocos de raciocínio de
    // outro modelo não são reenviados.
    if (!keepThinking && row.role === "assistant") {
      content = content.filter((b) => !THINKING_TYPES.has(b.type));
      if (content.length === 0) continue;
    }
    if (row.role === "user" && !row.hidden && !isToolResultOnly(content)) {
      content = content.map((b, idx) =>
        idx === 0 && b.type === "text"
          ? { type: "text" as const, text: `[${nowLabelSP(new Date(row.created_at))}]\n${b.text}` }
          : b,
      );
    }
    out.push({ role: row.role, content });

    // Todo tool_use precisa de tool_result logo em seguida.
    if (row.role === "assistant") {
      const toolUseIds = content.filter((b) => b.type === "tool_use").map((b) => (b as { id: string }).id);
      if (toolUseIds.length > 0) {
        const next = usable[i + 1];
        const answered = new Set(
          next && next.role === "user" && Array.isArray(next.content)
            ? (next.content as unknown as ContentBlockParam[])
                .filter((b) => b.type === "tool_result")
                .map((b) => (b as ToolResultParam).tool_use_id)
            : [],
        );
        const missing = toolUseIds.filter((id) => !answered.has(id));
        if (missing.length > 0 && answered.size === 0) {
          out.push({
            role: "user",
            content: missing.map((id) => ({
              type: "tool_result" as const,
              tool_use_id: id,
              is_error: true,
              content: "Execução interrompida antes de terminar. Verifique com uma busca antes de repetir.",
            })),
          });
        }
      }
    }
  }
  return out;
}

async function loadHistory(db: Db, conversationId: string): Promise<StoredMessage[]> {
  const { data, error } = await db
    .from("assistant_messages")
    .select("id, role, content, hidden, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_ROWS);
  if (error) throw new Error(`Falha ao ler histórico: ${error.message}`);
  return ((data ?? []) as StoredMessage[]).reverse();
}

// ---------------------------------------------------------------------------
// Execução de ferramentas
// ---------------------------------------------------------------------------

async function runTool(block: Anthropic.Beta.BetaToolUseBlock, ctx: ToolCtx): Promise<ToolResultParam> {
  const reply = (content: unknown, isError = false): ToolResultParam => ({
    type: "tool_result",
    tool_use_id: block.id,
    content: typeof content === "string" ? content : JSON.stringify(content),
    ...(isError ? { is_error: true } : {}),
  });

  const tool = getTool(block.name);
  if (!tool) return reply(`Ferramenta desconhecida: ${block.name}`, true);
  const parsed = parseToolInput(tool, block.input);
  if (!parsed.ok) return reply(parsed.error, true);

  const { db } = ctx;
  try {
    if (tool.kind === "read") {
      return reply(await tool.run(parsed.data, ctx));
    }

    if (tool.kind === "write") {
      const out = await tool.run(parsed.data, ctx);
      const { data: action } = await db
        .from("assistant_actions")
        .insert({
          conversation_id: ctx.conversationId,
          user_id: ctx.userId,
          tool: tool.name,
          kind: "write",
          status: "done",
          summary: out.summary,
          input: parsed.data as Json,
          undo: out.undo as Json,
        })
        .select("id")
        .single();
      return reply({ ok: true, resumo: out.summary, dados: out.result, acao_id: action?.id });
    }

    // confirm: só prepara; quem executa é o botão "Confirmar".
    const preview = await tool.prepare(parsed.data, ctx);
    const { data: action, error } = await db
      .from("assistant_actions")
      .insert({
        conversation_id: ctx.conversationId,
        user_id: ctx.userId,
        tool: tool.name,
        kind: "confirm",
        status: "pending",
        summary: preview.summary,
        input: parsed.data as Json,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Falha ao registrar pedido de confirmação: ${error.message}`);
    return reply({
      status: "aguardando_confirmacao",
      acao_id: action!.id,
      resumo: preview.summary,
      instrucao:
        "A pessoa está vendo um cartão com Confirmar/Cancelar. Não execute de novo; avise em uma frase que é só confirmar no cartão.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!(err instanceof ToolError)) console.error(`[assistente] ${tool.name} falhou:`, err);
    await db.from("assistant_actions").insert({
      conversation_id: ctx.conversationId,
      user_id: ctx.userId,
      tool: tool.name,
      kind: tool.kind === "confirm" ? "confirm" : "write",
      status: "failed",
      summary: `Falhou: ${tool.name}`,
      input: parsed.data as Json,
      error: msg,
    });
    return reply(err instanceof ToolError ? msg : `Erro interno ao executar: ${msg}`, true);
  }
}

// ---------------------------------------------------------------------------
// Turno
// ---------------------------------------------------------------------------

function friendlyApiError(err: unknown): AssistantError {
  if (err instanceof Anthropic.AuthenticationError) return new AssistantError("A chave da API do assistente é inválida.");
  if (err instanceof Anthropic.RateLimitError) return new AssistantError("Muitos pedidos agora. Tente de novo em um minuto.");
  if (err instanceof Anthropic.APIConnectionError) return new AssistantError("Não consegui falar com a IA agora. Tente de novo.");
  if (err instanceof Anthropic.APIError) {
    console.error("[assistente] erro da API:", err.status, err.message);
    if ((err.status ?? 0) >= 500) return new AssistantError("A IA está instável agora. Tente de novo em instantes.");
    return new AssistantError("Tive um problema pra processar isso. Já ficou registrado.");
  }
  if (err instanceof AssistantError) return err;
  console.error("[assistente] erro inesperado:", err);
  return new AssistantError("Algo deu errado do meu lado. Tente de novo.");
}

/** Executa um turno completo. A mensagem do usuário já deve estar salva. */
export async function runTurn(db: Db, ctx: ToolCtx): Promise<void> {
  const anthropic = getClient();
  const tools = toolSchemas();
  const context = await buildContext(db, ctx.userId);
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    { type: "text", text: context },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    const messages = buildApiMessages(await loadHistory(db, ctx.conversationId));
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        system,
        tools,
        messages,
        cache_control: { type: "ephemeral" },
        ...modelParams(EFFORT),
      });
      const u = response.usage;
      console.info(
        `[assistente] ${response.model} in=${u.input_tokens} cache_read=${u.cache_read_input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0} out=${u.output_tokens}`,
      );
    } catch (err) {
      throw friendlyApiError(err);
    }

    await saveMessage(db, ctx, "assistant", response.content);

    if (response.stop_reason === "refusal") {
      await saveMessage(db, ctx, "assistant", [
        { type: "text", text: "Não consigo ajudar com esse pedido. Pode reformular?" },
      ]);
      return;
    }
    if (response.stop_reason === "pause_turn") continue;

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) return; // end_turn / max_tokens: resposta final salva
    if (response.stop_reason === "max_tokens") {
      // tool_use cortado no meio: não executa entrada truncada.
      await saveMessage(
        db,
        ctx,
        "user",
        toolUses.map((b) => ({
          type: "tool_result",
          tool_use_id: b.id,
          is_error: true,
          content: "Resposta cortada por tamanho; a ferramenta não foi executada.",
        })),
      );
      return;
    }

    // Sequencial de propósito: escritas na ordem em que o modelo pediu.
    const results: ToolResultParam[] = [];
    for (const b of toolUses) results.push(await runTool(b, ctx));
    await saveMessage(db, ctx, "user", results);
  }

  await saveMessage(db, ctx, "assistant", [
    { type: "text", text: "Esse pedido ficou longo demais pra uma vez só. Me diga o próximo passo que eu continuo." },
  ]);
}

// ---------------------------------------------------------------------------
// Resumo ao limpar a conversa
// ---------------------------------------------------------------------------

/**
 * Resume a conversa (feito, decidido, pendente, preferências) pra entrar no
 * contexto das próximas. Usa só o texto visível + ações executadas.
 */
export async function summarizeConversation(db: Db, conversationId: string): Promise<string | null> {
  const [rows, acts] = await Promise.all([
    loadHistory(db, conversationId),
    db
      .from("assistant_actions")
      .select("summary, status")
      .eq("conversation_id", conversationId)
      .in("status", ["done", "pending"])
      .order("created_at"),
  ]);
  const lines: string[] = [];
  for (const r of rows) {
    if (r.hidden || isToolResultOnly(r.content) || !Array.isArray(r.content)) continue;
    const blocks = r.content as unknown as { type: string; text?: string }[];
    const text = (r.role === "user" ? blocks.slice(0, 1) : blocks)
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join(" ")
      .trim();
    if (text) lines.push(`${r.role === "user" ? "Pessoa" : "Assistente"}: ${text.slice(0, 600)}`);
  }
  for (const a of acts.data ?? []) lines.push(`Ação ${a.status === "pending" ? "aguardando confirmação" : "feita"}: ${a.summary}`);
  if (lines.length === 0) return null;

  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    ...modelParams("low"),
    system:
      "Você resume conversas entre o Marcus/João e o assistente do sistema Marcão Control, para o assistente lembrar depois. Escreva em português, no máximo 8 tópicos curtos ('- '), só o que vale lembrar: o que foi feito, decisões, pendências combinadas (o que ficou de fazer e quando), preferências reveladas. Atenção: 'Ação feita' foi executada; 'Ação aguardando confirmação' NÃO foi executada (escreva 'ficou pendente de confirmação'). Não repita listas de contas a vencer (isso muda todo dia). Sem preâmbulo, sem ids.",
    messages: [{ role: "user", content: lines.join("\n").slice(-30_000) }],
  });
  if (response.stop_reason === "refusal") return null;
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text || null;
}
