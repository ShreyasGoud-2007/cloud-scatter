import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, File } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const FileUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const simulateDistribution = async (fileId: string, fileName: string, fileSize: number) => {
    // Simulate file splitting into 4 parts
    const numParts = 4;
    const partSize = Math.ceil(fileSize / numParts);
    
    // Get available nodes
    const { data: nodes } = await supabase
      .from('storage_nodes')
      .select('*')
      .eq('status', 'online')
      .limit(numParts);

    if (!nodes || nodes.length < numParts) {
      throw new Error('Not enough online nodes');
    }

    // Create file parts metadata
    for (let i = 0; i < numParts; i++) {
      const checksum = `sha256_${Math.random().toString(36).substring(7)}`;
      await supabase.from('file_parts').insert({
        file_id: fileId,
        part_index: i + 1,
        checksum,
        node_id: nodes[i].id,
        size_bytes: i === numParts - 1 ? fileSize - (partSize * (numParts - 1)) : partSize
      });
      
      setProgress(((i + 1) / numParts) * 100);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Update file status
    await supabase
      .from('files')
      .update({ status: 'distributed' })
      .eq('id', fileId);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setProgress(0);

    try {
      // Create file metadata
      const { data: fileData, error: fileError } = await supabase
        .from('files')
        .insert({
          file_name: selectedFile.name,
          file_size_bytes: selectedFile.size,
          num_parts: 4,
          status: 'uploading'
        })
        .select()
        .single();

      if (fileError) throw fileError;

      // Simulate file distribution
      await simulateDistribution(fileData.id, selectedFile.name, selectedFile.size);

      toast.success('File distributed across nodes successfully!');
      setSelectedFile(null);
      setProgress(0);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to distribute file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-6 bg-card border-border" style={{ background: 'var(--gradient-card)' }}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Upload File</h2>
        </div>

        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer flex flex-col items-center gap-2"
          >
            <File className="w-12 h-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {selectedFile ? selectedFile.name : 'Click to select a file'}
            </p>
            {selectedFile && (
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </label>
        </div>

        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Distributing across nodes...</span>
              <span className="text-primary font-mono">{progress.toFixed(0)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {uploading ? 'Distributing...' : 'Upload & Distribute'}
        </Button>
      </div>
    </Card>
  );
};
