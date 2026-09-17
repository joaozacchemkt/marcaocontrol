import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compara duas senhas em tempo constante.
 * Ambas são reduzidas a digests de mesmo tamanho porque timingSafeEqual
 * lança erro quando os buffers têm comprimentos diferentes (e o próprio
 * comprimento vazaria informação).
 */
function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export interface UnlockResult {
  ok: boolean;
  email?: string;
  tokenHash?: string;
}

/**
 * Cada pessoa com acesso tem seu próprio par (senha, e-mail da conta).
 * `SITE_PASSWORD`/`APP_ACCOUNT_EMAIL` é a conta original; `_PAI` é a
 * segunda pessoa. Novos pares seguem o mesmo padrão de nome de variável.
 */
function accountPairs(): { password: string; email: string }[] {
  const pairs: { password: string; email: string }[] = [];
  const primary = process.env["SITE_PASSWORD"];
  const primaryEmail = process.env["APP_ACCOUNT_EMAIL"];
  if (primary && primaryEmail) pairs.push({ password: primary, email: primaryEmail });
  const pai = process.env["SITE_PASSWORD_PAI"];
  const paiEmail = process.env["APP_ACCOUNT_EMAIL_PAI"];
  if (pai && paiEmail) pairs.push({ password: pai, email: paiEmail });
  return pairs;
}

/**
 * Valida a senha digitada contra cada conta configurada no servidor e, se
 * alguma bater, emite um token de sessão pra ELA (não uma conta única mais
 * — cada pessoa tem a sua). A senha nunca chega ao cliente. Sempre checa
 * todos os pares (não retorna no primeiro match) pra não vazar por timing
 * qual conta existe.
 */
export const unlockSite = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => ({
    password: typeof data?.password === "string" ? data.password.slice(0, 200) : "",
  }))
  .handler(async ({ data }): Promise<UnlockResult> => {
    const pairs = accountPairs();
    if (pairs.length === 0) throw new Error("Acesso não configurado no servidor.");

    let matched: { password: string; email: string } | null = null;
    for (const pair of pairs) {
      if (data.password && passwordMatches(data.password, pair.password)) matched = pair;
    }
    if (!matched) return { ok: false };
    const email = matched.email;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Garante que a conta existe (criada apenas na primeira entrada dela).
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const exists = list?.users?.some((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!exists) {
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: crypto.randomUUID() + crypto.randomUUID(),
        email_confirm: true,
      });
      if (createError) throw createError;
    }

    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error) throw error;

    return { ok: true, email, tokenHash: link.properties.hashed_token };
  });
