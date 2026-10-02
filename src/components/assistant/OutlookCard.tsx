import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { disconnectOutlook, getOutlookStatus, startOutlookConnect } from "@/lib/outlook.functions";

/** Conectar/desconectar o Outlook da pessoa logada (leitura de e-mail pelo assistente). */
export function OutlookCard() {
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useQuery({ queryKey: ["outlook-status"], queryFn: () => getOutlookStatus() });

  const connect = useMutation({
    mutationFn: () => startOutlookConnect(),
    onSuccess: (r) => {
      if (r.ok && r.url) window.location.href = r.url;
      else toast.error(r.error ?? "Não consegui iniciar a conexão.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const disconnect = useMutation({
    mutationFn: () => disconnectOutlook(),
    onSuccess: () => {
      toast.success("Outlook desconectado.");
      void queryClient.invalidateQueries({ queryKey: ["outlook-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" /> Outlook
        </CardTitle>
        <CardDescription>
          Deixa o assistente ler seus e-mails (só leitura) pra encontrar pendências e virar tarefas. Cada pessoa conecta
          a própria caixa.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : !status?.configured ? (
          <p className="text-sm text-muted-foreground">Integração ainda não configurada no servidor.</p>
        ) : status.connected ? (
          <>
            <p className="text-sm">
              Conectado{status.email ? <> como <strong>{status.email}</strong></> : null}.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={disconnect.isPending}>
                  Desconectar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Desconectar o Outlook?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O assistente deixa de ler seus e-mails. Dá pra conectar de novo quando quiser.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => disconnect.mutate()}>Desconectar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <Button onClick={() => connect.mutate()} disabled={connect.isPending}>
            {connect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Conectar Outlook
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
