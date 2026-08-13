
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, File, Image, FileText, Download, Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ProjectFilesProps {
  project: any;
}

export function ProjectFiles({ project }: ProjectFilesProps) {
  const [search, setSearch] = useState("");

  const mockFiles = [
    { id: 1, name: "Escopo do Projeto.pdf", type: "pdf", size: "1.2 MB", date: "2024-03-10" },
    { id: 2, name: "Orçamento Aprovado.xlsx", type: "excel", size: "450 KB", date: "2024-03-12" },
    { id: 3, name: "Referência Visual.png", type: "image", size: "4.5 MB", date: "2024-03-15" },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-5 w-5 text-blue-500" />;
      case 'pdf': return <FileText className="h-5 w-5 text-red-500" />;
      default: return <File className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Documentos e Arquivos</h3>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> Upload
        </Button>
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
        {mockFiles.map(file => (
          <Card key={file.id} className="hover:bg-accent/50 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-background rounded-lg border">
                  {getIcon(file.type)}
                </div>
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{file.size} • {file.date}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="p-8 border-2 border-dashed rounded-xl text-center">
        <p className="text-sm text-muted-foreground mb-4">Arraste e solte arquivos aqui para fazer upload</p>
        <Button variant="outline" size="sm">Selecionar Arquivos</Button>
      </div>
    </div>
  );
}
