/**
 * Microsoft Graph (Outlook) — SÓ SERVIDOR. Só leitura: e-mail e agenda.
 *
 * - App registrado no Entra ID da SPKR (single-tenant). Env:
 *   MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, OUTLOOK_TOKEN_KEY
 *   (32 bytes em base64, criptografa os tokens no banco) e, opcional,
 *   OUTLOOK_REDIRECT_URI (padrão: produção).
 * - Tokens ficam criptografados (AES-256-GCM) em outlook_connections.
 * - O `state` do OAuth é assinado (HMAC) e amarrado ao usuário logado, pra
 *   ninguém conectar a caixa de e-mail de um na conta de outro.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Db } from "@/lib/db";

const SCOPES = "offline_access User.Read Mail.Read Calendars.Read";
const DEFAULT_REDIRECT = "https://marcaocontrol.vercel.app/outlook-callback";

export class OutlookError extends Error {}

function cfg() {
  const tenant = process.env["MS_TENANT_ID"];
  const clientId = process.env["MS_CLIENT_ID"];
  const secret = process.env["MS_CLIENT_SECRET"];
  const key = process.env["OUTLOOK_TOKEN_KEY"];
  if (!tenant || !clientId || !secret || !key) {
    throw new OutlookError("A integração com o Outlook ainda não foi configurada no servidor.");
  }
  const keyBuf = Buffer.from(key, "base64");
  if (keyBuf.length !== 32) throw new OutlookError("OUTLOOK_TOKEN_KEY inválida (precisa de 32 bytes em base64).");
  return { tenant, clientId, secret, key: keyBuf, redirect: process.env["OUTLOOK_REDIRECT_URI"] || DEFAULT_REDIRECT };
}

export function outlookConfigured(): boolean {
  try {
    cfg();
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Criptografia dos tokens e assinatura do state
// ---------------------------------------------------------------------------

interface Tokens {
  access_token: string;
  refresh_token: string;
}

function encrypt(tokens: Tokens, key: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([c.update(JSON.stringify(tokens), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

function decrypt(blob: string, key: Buffer): Tokens {
  const [iv, tag, data] = blob.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key, iv!);
  d.setAuthTag(tag!);
  return JSON.parse(Buffer.concat([d.update(data!), d.final()]).toString("utf8")) as Tokens;
}

function sign(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/** state = base64url(userId|expira) + "." + assinatura. Vale 15 minutos. */
function makeState(userId: string, key: Buffer): string {
  const payload = Buffer.from(`${userId}|${Date.now() + 15 * 60_000}`).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

function checkState(state: string, userId: string, key: Buffer): boolean {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return false;
  const expected = Buffer.from(sign(payload, key));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return false;
  const [uid, exp] = Buffer.from(payload, "base64url").toString().split("|");
  return uid === userId && Number(exp) > Date.now();
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

export function buildAuthUrl(userId: string): string {
  const c = cfg();
  const q = new URLSearchParams({
    client_id: c.clientId,
    response_type: "code",
    redirect_uri: c.redirect,
    response_mode: "query",
    scope: SCOPES,
    state: makeState(userId, c.key),
    prompt: "select_account",
  });
  return `https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/authorize?${q}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const c = cfg();
  const res = await fetch(`https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.secret, scope: SCOPES, ...params }),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || json.error) {
    console.error("[outlook] token:", json.error, json.error_description);
    throw new OutlookError(
      json.error === "invalid_grant"
        ? "A autorização do Outlook expirou ou foi revogada. Conecte de novo em Configurações."
        : "Não consegui autorizar com a Microsoft.",
    );
  }
  return json;
}

async function saveTokens(db: Db, userId: string, t: TokenResponse, refreshFallback: string, email?: string | null) {
  const c = cfg();
  const token_enc = encrypt(
    { access_token: t.access_token, refresh_token: t.refresh_token ?? refreshFallback },
    c.key,
  );
  const expires_at = new Date(Date.now() + (t.expires_in - 120) * 1000).toISOString();
  const { error } = await db
    .from("outlook_connections")
    .upsert({ user_id: userId, token_enc, expires_at, ...(email !== undefined ? { email } : {}) });
  if (error) throw new Error(`Falha ao salvar a conexão: ${error.message}`);
}

/** Fim do login: valida o state, troca o código e guarda os tokens. */
export async function finishConnect(db: Db, userId: string, code: string, state: string): Promise<string | null> {
  const c = cfg();
  if (!checkState(state, userId, c.key)) throw new OutlookError("Link de autorização inválido ou expirado. Tente conectar de novo.");
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: c.redirect });
  if (!t.refresh_token) throw new OutlookError("A Microsoft não devolveu acesso permanente (offline_access).");
  const me = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${t.access_token}` },
  }).then((r) => (r.ok ? (r.json() as Promise<{ mail?: string; userPrincipalName?: string }>) : null));
  const email = me?.mail || me?.userPrincipalName || null;
  await saveTokens(db, userId, t, t.refresh_token, email);
  return email;
}

/** Access token válido (renova sozinho quando expira). */
async function accessToken(db: Db, userId: string): Promise<string> {
  const c = cfg();
  const { data } = await db
    .from("outlook_connections")
    .select("token_enc, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new OutlookError("O Outlook desta conta ainda não foi conectado. Conecte em Configurações → Outlook.");
  const tokens = decrypt(data.token_enc, c.key);
  if (data.expires_at && new Date(data.expires_at).getTime() > Date.now()) return tokens.access_token;
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refresh_token });
  await saveTokens(db, userId, t, tokens.refresh_token);
  return t.access_token;
}

// ---------------------------------------------------------------------------
// Leitura de e-mails
// ---------------------------------------------------------------------------

export interface MailItem {
  id: string;
  assunto: string;
  de: string;
  recebido_em: string;
  lido: boolean;
  sinalizado: boolean;
  importancia: string;
  link: string;
  texto: string;
}

interface GraphMessage {
  id: string;
  subject: string | null;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime: string;
  isRead: boolean;
  importance: string;
  webLink: string;
  flag?: { flagStatus?: string };
  body?: { content?: string };
  bodyPreview?: string;
}

/** Corta o histórico citado ("De: ... Enviado: ...") e limita o tamanho. */
function cleanBody(text: string): string {
  const cut = text.search(/\n\s*(De|From):\s.*\n\s*(Enviado|Sent|Data|Date):/i);
  const body = (cut > 0 ? text.slice(0, cut) : text).replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();
  return body.length > 1500 ? `${body.slice(0, 1500)}…` : body;
}

export async function listRecentMail(
  db: Db,
  userId: string,
  opts: { days: number; unreadOnly: boolean; exclude: Set<string>; max: number },
): Promise<{ email: string | null; itens: MailItem[]; total_na_caixa: number }> {
  const token = await accessToken(db, userId);
  const since = new Date(Date.now() - opts.days * 86_400_000).toISOString();
  const filter = `receivedDateTime ge ${since}${opts.unreadOnly ? " and isRead eq false" : ""}`;
  const q = new URLSearchParams({
    $filter: filter,
    $orderby: "receivedDateTime desc",
    $top: "60",
    $select: "id,subject,from,receivedDateTime,isRead,importance,webLink,flag,body",
  });
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?${q}`, {
    headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.body-content-type="text"' },
  });
  if (!res.ok) {
    console.error("[outlook] messages:", res.status, await res.text().catch(() => ""));
    throw new OutlookError(res.status === 401 || res.status === 403 ? "Sem permissão pra ler o e-mail. Conecte de novo em Configurações." : "Não consegui ler o e-mail agora.");
  }
  const json = (await res.json()) as { value: GraphMessage[] };
  const { data: conn } = await db.from("outlook_connections").select("email").eq("user_id", userId).maybeSingle();
  const own = (conn?.email ?? "").toLowerCase();
  const all = json.value ?? [];
  const itens = all
    .filter((m) => !opts.exclude.has(m.id))
    .filter((m) => (m.from?.emailAddress?.address ?? "").toLowerCase() !== own)
    .slice(0, opts.max)
    .map((m) => ({
      id: m.id,
      assunto: m.subject || "(sem assunto)",
      de: [m.from?.emailAddress?.name, m.from?.emailAddress?.address && `<${m.from.emailAddress.address}>`]
        .filter(Boolean)
        .join(" "),
      recebido_em: m.receivedDateTime,
      lido: m.isRead,
      sinalizado: m.flag?.flagStatus === "flagged",
      importancia: m.importance,
      link: m.webLink,
      texto: cleanBody(m.body?.content ?? m.bodyPreview ?? ""),
    }));
  return { email: conn?.email ?? null, itens, total_na_caixa: all.length };
}

// ---------------------------------------------------------------------------
// Caixa de entrada pra tela "E-mail" (leve: só prévia, sem corpo)
// ---------------------------------------------------------------------------

export interface InboxItem {
  id: string;
  assunto: string;
  de_nome: string;
  de_email: string;
  recebido_em: string;
  lido: boolean;
  sinalizado: boolean;
  importante: boolean;
  prioritario: boolean;
  link: string;
  previa: string;
}

/** Remetentes automáticos (notificação, newsletter) — vão pro fim da lista. */
const AUTOMATED = /(no-?reply|nao-?responda|naoresponda|notifica|notification|newsletter|mailer|marketing|news@|info@|alerts?@|bounce)/i;

export async function listInbox(
  db: Db,
  userId: string,
  opts: { days: number },
): Promise<InboxItem[]> {
  const token = await accessToken(db, userId);
  const since = new Date(Date.now() - opts.days * 86_400_000).toISOString();
  const q = new URLSearchParams({
    $filter: `receivedDateTime ge ${since}`,
    $orderby: "receivedDateTime desc",
    $top: "100",
    $select: "id,subject,from,receivedDateTime,isRead,importance,webLink,flag,bodyPreview,inferenceClassification",
  });
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error("[outlook] inbox:", res.status, await res.text().catch(() => ""));
    throw new OutlookError(res.status === 401 || res.status === 403 ? "Sem permissão pra ler o e-mail. Conecte de novo em Configurações." : "Não consegui ler o e-mail agora.");
  }
  const json = (await res.json()) as { value: (GraphMessage & { inferenceClassification?: string })[] };
  return (json.value ?? []).map((m) => {
    const address = m.from?.emailAddress?.address ?? "";
    return {
      id: m.id,
      assunto: m.subject || "(sem assunto)",
      de_nome: m.from?.emailAddress?.name || address,
      de_email: address,
      recebido_em: m.receivedDateTime,
      lido: m.isRead,
      sinalizado: m.flag?.flagStatus === "flagged",
      importante: m.importance === "high",
      // "Prioritário" = caixa Focada do Outlook e remetente que não é automático.
      prioritario: m.inferenceClassification !== "other" && !AUTOMATED.test(address),
      link: m.webLink,
      previa: (m.bodyPreview ?? "").replace(/\s+/g, " ").trim().slice(0, 220),
    };
  });
}

// ---------------------------------------------------------------------------
// Agenda (só leitura)
// ---------------------------------------------------------------------------

export interface OutlookEvent {
  id: string;
  title: string;
  /** Instante ISO (UTC). Dia todo: meia-noite de SP do dia. */
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  location: string | null;
  link: string;
}

/** Hora "de parede" de SP devolvida pelo Graph → instante ISO. */
function spWallToIso(dateTime: string): string {
  return new Date(`${dateTime.slice(0, 19)}-03:00`).toISOString();
}

export async function listCalendar(db: Db, userId: string, fromIso: string, toIso: string): Promise<OutlookEvent[]> {
  const token = await accessToken(db, userId);
  const q = new URLSearchParams({
    startDateTime: fromIso,
    endDateTime: toIso,
    $select: "id,subject,start,end,isAllDay,location,webLink,isCancelled,showAs",
    $orderby: "start/dateTime",
    $top: "250",
  });
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/calendarView?${q}`, {
    headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="E. South America Standard Time"' },
  });
  if (!res.ok) {
    console.error("[outlook] calendar:", res.status, await res.text().catch(() => ""));
    throw new OutlookError(
      res.status === 401 || res.status === 403
        ? "Sem permissão pra ler a agenda do Outlook. Desconecte e conecte de novo em Configurações."
        : "Não consegui ler a agenda do Outlook agora.",
    );
  }
  type GraphEvent = {
    id: string;
    subject: string | null;
    start: { dateTime: string };
    end: { dateTime: string };
    isAllDay: boolean;
    isCancelled: boolean;
    showAs: string;
    location?: { displayName?: string };
    webLink: string;
  };
  const json = (await res.json()) as { value: GraphEvent[] };
  return (json.value ?? [])
    .filter((e) => !e.isCancelled)
    .map((e) => ({
      id: `outlook:${e.id}`,
      title: e.subject || "(sem título)",
      start_time: e.isAllDay ? spWallToIso(`${e.start.dateTime.slice(0, 10)}T00:00:00`) : spWallToIso(e.start.dateTime),
      end_time: e.isAllDay ? null : spWallToIso(e.end.dateTime),
      all_day: e.isAllDay,
      location: e.location?.displayName || null,
      link: e.webLink,
    }));
}
