import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileText, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface FileData {
  id: string;
  file_name: string;
  file_size_bytes: number;
  num_parts: number;
  status: string;
  created_at: string;
}

interface FilePart {
  part_index: number;
  node_id: string;
  checksum: string;
  storage_nodes: {
    node_name: string;
  };
}

export const FileList = () => {
  const [files, setFiles] = useState<FileData[]>([]);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [fileParts, setFileParts] = useState<Record<string, FilePart[]>>({});

  useEffect(() => {
    fetchFiles();

    const channel = supabase
      .channel('files-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'files'
        },
        () => fetchFiles()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchFiles = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('files')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setFiles(data);
  };

  const fetchFileParts = async (fileId: string) => {
    if (fileParts[fileId]) {
      setExpandedFile(expandedFile === fileId ? null : fileId);
      return;
    }

    const { data } = await supabase
      .from('file_parts')
      .select('*, storage_nodes(node_name)')
      .eq('file_id', fileId)
      .order('part_index');

    if (data) {
      setFileParts(prev => ({ ...prev, [fileId]: data }));
      setExpandedFile(fileId);
    }
  };

  const handleDownload = async (file: FileData) => {
    toast.success(`Reassembling ${file.file_name} from distributed chunks...`);
    // In a real implementation, this would fetch chunks from all nodes and reassemble
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'distributed':
      case 'complete':
        return 'hsl(var(--node-online))';
      case 'uploading':
        return 'hsl(var(--node-degraded))';
      case 'error':
        return 'hsl(var(--node-offline))';
      default:
        return 'hsl(var(--muted))';
    }
  };

  return (
    <Card className="p-6 bg-card border-border" style={{ background: 'var(--gradient-card)' }}>
      <div className="flex items-center gap-2 mb-6">
        <FileText className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground">Distributed Files</h2>
      </div>

      <div className="space-y-3">
        {files.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No files uploaded yet</p>
        ) : (
          files.map((file) => (
            <div key={file.id} className="border border-border rounded-lg p-4 hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{file.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.file_size_bytes / 1024 / 1024).toFixed(2)} MB • {file.num_parts} parts
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline"
                    style={{ 
                      borderColor: getStatusColor(file.status),
                      color: getStatusColor(file.status)
                    }}
                  >
                    {file.status}
                  </Badge>
                  {file.status === 'distributed' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDownload(file)}
                      className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                  )}
                </div>
              </div>

              {file.status === 'distributed' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => fetchFileParts(file.id)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <Package className="w-3 h-3 mr-1" />
                  {expandedFile === file.id ? 'Hide' : 'Show'} chunk distribution
                </Button>
              )}

              {expandedFile === file.id && fileParts[file.id] && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Chunk Distribution Map:</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {fileParts[file.id].map((part) => (
                      <div 
                        key={part.part_index} 
                        className="text-xs p-2 bg-muted/50 rounded border border-primary/30"
                      >
                        <p className="font-mono text-primary">Part {part.part_index}</p>
                        <p className="text-muted-foreground truncate">
                          {part.storage_nodes.node_name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
