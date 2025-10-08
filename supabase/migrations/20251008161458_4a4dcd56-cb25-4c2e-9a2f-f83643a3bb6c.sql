-- Create storage nodes table
CREATE TABLE public.storage_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_name TEXT NOT NULL UNIQUE,
  node_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline', 'degraded')),
  free_space_gb INTEGER NOT NULL DEFAULT 100,
  total_space_gb INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create files table
CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  num_parts INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'distributed', 'complete', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create file parts table
CREATE TABLE public.file_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  part_index INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  node_id UUID NOT NULL REFERENCES public.storage_nodes(id) ON DELETE CASCADE,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(file_id, part_index)
);

-- Enable RLS
ALTER TABLE public.storage_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_parts ENABLE ROW LEVEL SECURITY;

-- Public read policies (for demo purposes)
CREATE POLICY "Anyone can view storage nodes" ON public.storage_nodes FOR SELECT USING (true);
CREATE POLICY "Anyone can view files" ON public.files FOR SELECT USING (true);
CREATE POLICY "Anyone can view file parts" ON public.file_parts FOR SELECT USING (true);

-- Public insert policies (for demo purposes)
CREATE POLICY "Anyone can insert storage nodes" ON public.storage_nodes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert files" ON public.files FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert file parts" ON public.file_parts FOR INSERT WITH CHECK (true);

-- Public update policies
CREATE POLICY "Anyone can update storage nodes" ON public.storage_nodes FOR UPDATE USING (true);
CREATE POLICY "Anyone can update files" ON public.files FOR UPDATE USING (true);

-- Insert demo storage nodes
INSERT INTO public.storage_nodes (node_name, node_url, status, free_space_gb, total_space_gb) VALUES
  ('Node Alpha', 'https://node-alpha.storage.local:5001', 'online', 85, 100),
  ('Node Beta', 'https://node-beta.storage.local:5002', 'online', 92, 100),
  ('Node Gamma', 'https://node-gamma.storage.local:5003', 'online', 78, 120),
  ('Node Delta', 'https://node-delta.storage.local:5004', 'degraded', 45, 80);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.storage_nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.files;
ALTER PUBLICATION supabase_realtime ADD TABLE public.file_parts;