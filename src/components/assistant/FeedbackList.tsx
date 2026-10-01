import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = { bug: "Problema", sugestao: "Sugestão", elogio: "Elogio", outro: "Recado" };

/** Problemas e sugestões registrados pelo assistente (tabela app_feedback). */
export function FeedbackList() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["app-feedback"],
    queryFn: async () => {
      const [fb, profiles] = await Promise.all([
        supabase
          .from("app_feedback")
          .select("id, kind, description, screen, status, created_at, user_id")
          .order("status")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("profiles").select("id, full_name"),
      ]);
      if (fb.error) throw fb.error;
      const names = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name]));
      return (fb.data ?? []).map((f) => ({ ...f, author: names.get(f.user_id) ?? "—" }));
    },
  });

  // Toggle reversível: sem confirmação (convenção do app).
  const toggle = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("app_feedback")
        .update({ status: status === "aberto" ? "resolvido" : "aberto" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["app-feedback"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Problemas e sugestões</CardTitle>
        <CardDescription>Relatados pelo assistente quando alguém reclama de algo ou pede uma melhoria.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando…</p>
        ) : data.length === 0 ? (
          <p className="p-6 text-sm italic text-muted-foreground">Nada relatado ainda.</p>
        ) : (
          <ul className="divide-y">
            {data.map((f) => (
              <li key={f.id} className={cn("flex items-start gap-3 p-4", f.status === "resolvido" && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                    {KIND_LABEL[f.kind] ?? f.kind} · {f.author} · {format(new Date(f.created_at), "dd/MM HH:mm")}
                    {f.screen ? ` · ${f.screen}` : ""}
                  </p>
                  <p className={cn("mt-1 whitespace-pre-wrap text-sm", f.status === "resolvido" && "line-through")}>
                    {f.description}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-xs"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: f.id, status: f.status })}
                >
                  {f.status === "aberto" ? "Resolvido" : "Reabrir"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
