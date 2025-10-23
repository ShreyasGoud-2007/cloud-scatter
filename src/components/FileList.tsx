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
  size_bytes: number;
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
    try {
      toast.success(`Reassembling ${file.file_name} from distributed chunks...`);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      // Fetch file parts to get metadata
      const { data: parts } = await supabase
        .from('file_parts')
        .select('*')
        .eq('file_id', file.id)
        .order('part_index');

      if (!parts || parts.length === 0) {
        toast.error('No file parts found');
        return;
      }

      // Download all chunks from storage
      const chunks: Blob[] = [];
      for (const part of parts) {
        const chunkPath = `${user.id}/${file.id}/part${part.part_index}`;
        console.log('Downloading chunk:', chunkPath);
        
        const { data: chunkData, error } = await supabase.storage
          .from('file-chunks')
          .download(chunkPath);

        if (error) {
          console.error('Download error:', error);
          toast.error(`Failed to download chunk ${part.part_index}: ${error.message}`);
          return;
        }
        
        if (!chunkData) {
          console.error('No chunk data returned');
          toast.error(`Failed to download chunk ${part.part_index}: No data returned`);
          return;
        }

        console.log('Chunk downloaded:', chunkData.size, 'bytes');
        chunks.push(chunkData);
      }

      // Determine MIME type from file extension
      const getContentType = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
          'pdf': 'application/pdf',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'ppt': 'application/vnd.ms-powerpoint',
          'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'txt': 'text/plain',
          'html': 'text/html',
          'htm': 'text/html',
          'css': 'text/css',
          'js': 'text/javascript',
          'json': 'application/json',
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'gif': 'image/gif',
          'svg': 'image/svg+xml',
          'zip': 'application/zip',
          'rar': 'application/x-rar-compressed',
          'mp3': 'audio/mpeg',
          'mp4': 'video/mp4',
          'avi': 'video/x-msvideo'
        };
        return mimeTypes[ext || ''] || 'application/octet-stream';
      };

      // Reassemble chunks into original file with correct MIME type
      const contentType = getContentType(file.file_name);
      const blob = new Blob(chunks, { type: contentType });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`${file.file_name} downloaded successfully`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    }
  };

  const handleChunkDownload = async (fileId: string, fileName: string, partIndex: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      const chunkPath = `${user.id}/${fileId}/part${partIndex}`;
      const { data: chunkData, error } = await supabase.storage
        .from('file-chunks')
        .download(chunkPath);

      if (error || !chunkData) {
        toast.error(`Failed to download chunk ${partIndex}`);
        console.error('Chunk download error:', error);
        return;
      }
      
      // Create blob with binary data type
      const blob = new Blob([chunkData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Keep original extension to indicate source file type
      const baseFileName = fileName.replace(/\.[^/.]+$/, '');
      const extension = fileName.split('.').pop();
      a.download = `${baseFileName}.chunk${partIndex}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`Chunk ${partIndex} downloaded`);
    } catch (error) {
      console.error('Chunk download error:', error);
      toast.error('Failed to download chunk');
    }
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
                        className="text-xs p-2 bg-muted/50 rounded border border-primary/30 flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-primary">Part {part.part_index}</p>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5"
                            onClick={() => handleChunkDownload(file.id, file.file_name, part.part_index)}
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-muted-foreground truncate">
                          {part.storage_nodes.node_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(part.size_bytes / 1024).toFixed(2)} KB
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
