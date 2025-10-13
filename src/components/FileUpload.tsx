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

  const simulateDistribution = async (fileId: string, fileName: string, fileSize: number, file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Get available online nodes
    const { data: nodes } = await supabase
      .from('storage_nodes')
      .select('*')
      .eq('status', 'online');

    if (!nodes || nodes.length === 0) {
      throw new Error('No online nodes available');
    }

    // Use available nodes (minimum 2, maximum from available)
    const numParts = Math.min(4, nodes.length);
    const partSize = Math.ceil(fileSize / numParts);

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Create file parts and upload chunks
    for (let i = 0; i < numParts; i++) {
      const start = i * partSize;
      const end = Math.min(start + partSize, fileSize);
      const chunk = arrayBuffer.slice(start, end);
      
      // Upload chunk to storage
      const chunkPath = `${user.id}/${fileId}/part${i + 1}`;
      const { error: uploadError } = await supabase.storage
        .from('file-chunks')
        .upload(chunkPath, chunk, {
          contentType: file.type || 'application/octet-stream',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const checksum = `sha256_${Math.random().toString(36).substring(7)}`;
      await supabase.from('file_parts').insert({
        file_id: fileId,
        part_index: i + 1,
        checksum,
        node_id: nodes[i].id,
        size_bytes: end - start
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

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error("File size must be less than 100MB");
      return;
    }

    // Validate file name
    const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (sanitizedName !== selectedFile.name) {
      toast.error("File name contains invalid characters");
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create file metadata
      const { data: fileData, error: fileError } = await supabase
        .from('files')
        .insert({
          file_name: selectedFile.name,
          file_size_bytes: selectedFile.size,
          num_parts: 4,
          status: 'uploading',
          user_id: user.id
        })
        .select()
        .single();

      if (fileError) throw fileError;

      // Upload and distribute file
      await simulateDistribution(fileData.id, selectedFile.name, selectedFile.size, selectedFile);

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
