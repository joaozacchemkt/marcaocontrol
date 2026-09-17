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

interface Account {
  username: string;
  password: string;
  email: string;
}

/**
 * Cada pessoa com acesso tem seu próprio usuário/senha/e-mail de conta.
 * `SITE_USERNAME`/`SITE_PASSWORD`/`APP_ACCOUNT_EMAIL` é a conta original;
 * `_PAI` é a segunda pessoa. Duas contas podem até ter a mesma senha —
 * quem decide qual conta abrir é o usuário, não a senha.
 */
function accounts(): Account[] {
  const list: Account[] = [];
  const primaryUser = process.env["SITE_USERNAME"];
  const primaryPass = process.env["SITE_PASSWORD"];
  const primaryEmail = process.env["APP_ACCOUNT_EMAIL"];
  if (primaryUser && primaryPass && primaryEmail) {
    list.push({ username: primaryUser, password: primaryPass, email: primaryEmail });
  }
  const paiUser = process.env["SITE_USERNAME_PAI"];
  const paiPass = process.env["SITE_PASSWORD_PAI"];
  const paiEmail = process.env["APP_ACCOUNT_EMAIL_PAI"];
  if (paiUser && paiPass && paiEmail) {
    list.push({ username: paiUser, password: paiPass, email: paiEmail });
  }
  return list;
}

/**
 * Acha a conta pelo usuário (comparação exata, sem diferenciar
 * maiúsculas/espaços nas pontas) e só então confere a senha dela em tempo
 * constante — evita ficar testando a senha contra contas de outras
 * pessoas.
 */
export const unlockSite = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; password: string }) => ({
    username: typeof data?.username === "string" ? data.username.trim().slice(0, 100) : "",
    password: typeof data?.password === "string" ? data.password.slice(0, 200) : "",
  }))
  .handler(async ({ data }): Promise<UnlockResult> => {
    const accountList = accounts();
    if (accountList.length === 0) throw new Error("Acesso não configurado no servidor.");

    const account = accountList.find(
      (a) => a.username.toLowerCase() === data.username.toLowerCase(),
    );
    if (!account || !data.password || !passwordMatches(data.password, account.password)) {
      return { ok: false };
    }
    const email = account.email;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Garante que a conta existe (criada apenas na primeira entrada dela).
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const exists = userList?.users?.some((u) => u.email?.toLowerCase() === email.toLowerCase());
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
