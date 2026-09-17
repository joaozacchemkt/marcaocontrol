import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WorkspaceMember {
  id: string;
  name: string;
}

/**
 * Membros da área de trabalho compartilhada, com nome vindo de `profiles`.
 * Não dá pra usar o embedding do PostgREST (`workspace_members` e
 * `profiles` não têm FK direta entre si — as duas referenciam
 * `auth.users`), então busca as duas tabelas e junta no cliente.
 */
export function useWorkspaceMembers() {
  return useQuery({
    queryKey: ["workspace-members"],
    queryFn: async (): Promise<WorkspaceMember[]> => {
      const [{ data: members, error: membersError }, { data: profiles, error: profilesError }] =
        await Promise.all([
          supabase.from("workspace_members" as never).select("user_id"),
          supabase.from("profiles").select("id, full_name"),
        ]);
      if (membersError) throw membersError;
      if (profilesError) throw profilesError;
      const nameById = new Map(
        ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]),
      );
      return ((members ?? []) as { user_id: string }[]).map((m) => ({
        id: m.user_id,
        name: nameById.get(m.user_id) || "Sem nome",
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Id do usuário logado agora — usado pra filtrar "minhas tarefas" e afins. */
export function useCurrentUserId() {
  return useQuery({
    queryKey: ["current-user-id"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
    staleTime: Infinity,
  });
}
