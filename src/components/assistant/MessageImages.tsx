import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** Miniaturas dos prints de uma mensagem (links temporários do Storage privado). */
export function MessageImages({ paths, className }: { paths: string[]; className?: string }) {
  const { data: urls } = useQuery({
    queryKey: ["assistant-images", paths],
    enabled: paths.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("assistant-uploads").createSignedUrls(paths, 3600);
      if (error) throw error;
      return (data ?? []).map((d) => d.signedUrl);
    },
  });
  if (paths.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap justify-end gap-1.5", className)}>
      {paths.map((p, i) =>
        urls?.[i] ? (
          <a key={p} href={urls[i]} target="_blank" rel="noreferrer" title="Abrir imagem">
            <img src={urls[i]} alt="Imagem enviada" className="h-28 max-w-[200px] rounded-xl border object-cover" />
          </a>
        ) : (
          <div key={p} className="h-28 w-28 animate-pulse rounded-xl border bg-muted" />
        ),
      )}
    </div>
  );
}
