
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, File, Image, FileText, Download, Trash2, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity";
import { format } from "date-fns";

interface ProjectFilesProps {
  project: any;
}

export function ProjectFiles({ project }: ProjectFilesProps) {
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['project-files', project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as any[];
    }
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${userData.user.id}/${project.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: dbFile, error: dbError } = await supabase
        .from('project_files')
        .insert({
          project_id: project.id,
          name: file.name,
          storage_path: filePath,
          mime_type: file.type,
          size: file.size,
          user_id: userData.user.id,
          module: 'general'
        })
        .select()
        .single();

      if (dbError) throw dbError;

      if (dbFile) {
        await logActivity({
          projectId: project.id,
          type: 'file_uploaded',
          description: `Upload do arquivo: "${file.name}"`,
          entityType: 'project_file',
          entityId: dbFile.id
        });
      }

      queryClient.invalidateQueries({ queryKey: ['project-files', project.id] });
      toast.success("Arquivo enviado com sucesso!");
    } catch (error: any) {
      toast.error("Erro no upload: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file: any) => {
    try {
      const { error: storageError } = await supabase.storage
        .from('project-files')
        .remove([file.storage_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('project_files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      toast.success("Arquivo excluído");
      
      await logActivity({
        projectId: project.id,
        type: 'file_deleted',
        description: `Arquivo excluído: "${file.name}"`,
        entityType: 'project_file',
        entityId: file.id
      });

      queryClient.invalidateQueries({ queryKey: ['project-files', project.id] });
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const handleDownload = async (file: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('project-files')
        .download(file.storage_path);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
    } catch (error: any) {
      toast.error("Erro no download: " + error.message);
    }
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const getIcon = (type: string) => {
    if (type?.includes('image')) return <Image className="h-5 w-5 text-blue-500" />;
    if (type?.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Documentos e Arquivos</h3>
        <div className="relative">
          <Input
            type="file"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={handleUpload}
            disabled={uploading}
          />
          <Button disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Upload
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input 
          placeholder="Buscar nos arquivos..." 
          className="pl-9" 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando arquivos...</div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
            Nenhum arquivo encontrado.
          </div>
        ) : (
          filteredFiles.map(file => (
            <Card key={file.id} className="hover:bg-accent/50 transition-colors">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-background rounded-lg border">
                    {getIcon(file.mime_type || '')}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">
                      {formatSize(file.size || 0)} • {file.created_at ? format(new Date(file.created_at), "dd/MM/yyyy") : 'S/D'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(file)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(file)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}


