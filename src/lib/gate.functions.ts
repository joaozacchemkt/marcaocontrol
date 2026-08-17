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
 * Valida a senha compartilhada no servidor e, se correta, emite um token
 * de sessão para a conta única do sistema. A senha nunca chega ao cliente.
 */
export const unlockSite = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => ({
    password: typeof data?.password === "string" ? data.password.slice(0, 200) : "",
  }))
  .handler(async ({ data }): Promise<UnlockResult> => {
    const expected = process.env["SITE_PASSWORD"];
    const email = process.env["APP_ACCOUNT_EMAIL"];
    if (!expected || !email) throw new Error("Acesso não configurado no servidor.");

    if (!data.password || !passwordMatches(data.password, expected)) {
      return { ok: false };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Garante que a conta única existe (criada apenas na primeira entrada).
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
