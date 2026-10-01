import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Cliente Supabase tipado. No navegador é o singleton de `client.ts`; no
 * servidor (assistente) é o cliente do middleware, com o token do usuário —
 * então o RLS vale igual. Os helpers de regra de negócio recebem `db` para
 * rodar nos dois lados sem duplicar lógica.
 */
export type Db = SupabaseClient<Database>;
